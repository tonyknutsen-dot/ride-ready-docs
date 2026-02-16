import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getSecureHeaders, getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";

// Ride-based pricing tiers - single product, priced by ride count
const TIER_PRICE_IDS: Record<string, string> = {
  starter: "price_1T1TVLAG8uIRefcZ1nMRWRVV",      // £9.99/mo (1-5 rides)
  operator: "price_1T1TVMAG8uIRefcZKyL8XcLz",     // £19.99/mo (6-12 rides)
  professional: "price_1T1TVNAG8uIRefcZviQXUgrA",  // £34.99/mo (13-25 rides)
  enterprise: "price_1T1TVOAG8uIRefcZKAcqeqNw",    // £49.99/mo (25+ rides)
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Check if IP is blocked
    const clientIp = getClientIp(req);
    const blockResult = await checkIpBlocked(clientIp);
    if (blockResult.isBlocked) {
      logStep("Blocked IP attempted access", { ip: clientIp });
      return createBlockedIpResponse(blockResult, corsHeaders);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) throw new Error("Authorization token missing");

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      const msg = userError.message || "Unknown auth error";
      if (msg.includes("session")) {
        logStep("Session expired or invalid", { message: msg });
        return new Response(
          JSON.stringify({ error: "Session expired. Please sign in again." }),
          { status: 401, headers: { ...corsHeaders, ...getSecureHeaders(), "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Authentication error: ${msg}`);
    }
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Rate limiting
    const rateLimitKey = getClientIdentifier(req, "create-checkout", user.id);
    const rateLimitResult = await checkRateLimit(rateLimitKey, "payment");
    if (!rateLimitResult.allowed) {
      logStep("Rate limit exceeded", { userId: user.id });
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    // Parse request body - now expects tier instead of plan/billingCycle
    const { tier, returnUrl } = await req.json();
    logStep("Request params", { tier, returnUrl });

    if (!tier) {
      throw new Error("Missing required parameter: tier");
    }

    // Determine price ID from tier
    const priceId = TIER_PRICE_IDS[tier];
    if (!priceId) {
      throw new Error(`Invalid tier: ${tier}. Valid tiers: starter, operator, professional, enterprise`);
    }
    logStep("Price ID determined", { tier, priceId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    // Build line items - single tier price
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: priceId, quantity: 1 }
    ];

    // Use returnUrl from request body, fallback to origin header
    const baseUrl = returnUrl || req.headers.get("origin") || req.headers.get("referer")?.split('/').slice(0, 3).join('/') || "https://ride-ready-docs.lovable.app";
    logStep("Using base URL for redirects", { baseUrl });
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: "subscription",
      success_url: `${baseUrl}/billing?success=true`,
      cancel_url: `${baseUrl}/billing?canceled=true`,
      metadata: {
        user_id: user.id,
        tier,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          tier,
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
