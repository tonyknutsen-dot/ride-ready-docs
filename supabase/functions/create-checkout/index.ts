import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getSecureHeaders, getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";

// Stripe price IDs - Documents & Compliance = Basic, Operations & Maintenance = Advanced
const PRICE_IDS = {
  basic_monthly: "price_1SnzrIAG8uIRefcZWHRZs14k",    // Documents & Compliance Monthly - £6.99
  basic_yearly: "price_1SnzrMAG8uIRefcZ6bfyMMyR",     // Documents & Compliance Yearly - £69.90
  advanced_monthly: "price_1SnzrOAG8uIRefcZHBSrVObC", // Operations & Maintenance Monthly - £18.99
  advanced_yearly: "price_1SnzrQAG8uIRefcZq3oC3vso",  // Operations & Maintenance Yearly - £189.90
  extra_item: "price_1SnzrRAG8uIRefcZRHXJlDuy",       // Extra Item - £0.75/mo
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
      // Return 401 with clear message for session issues
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

    // Rate limiting - payment endpoints get moderate limits
    const rateLimitKey = getClientIdentifier(req, "create-checkout", user.id);
    const rateLimitResult = await checkRateLimit(rateLimitKey, "payment");
    if (!rateLimitResult.allowed) {
      logStep("Rate limit exceeded", { userId: user.id });
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    // Parse request body
    const { plan, billingCycle, extraItems = 0, returnUrl } = await req.json();
    logStep("Request params", { plan, billingCycle, extraItems, returnUrl });

    if (!plan || !billingCycle) {
      throw new Error("Missing required parameters: plan and billingCycle");
    }

    // Determine price ID
    const priceKey = `${plan}_${billingCycle}` as keyof typeof PRICE_IDS;
    const priceId = PRICE_IDS[priceKey];
    if (!priceId) {
      throw new Error(`Invalid plan/billing cycle combination: ${plan}/${billingCycle}`);
    }
    logStep("Price ID determined", { priceKey, priceId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: priceId, quantity: 1 }
    ];

    // Add extra items if specified
    if (extraItems > 0) {
      lineItems.push({ price: PRICE_IDS.extra_item, quantity: extraItems });
      logStep("Extra items added", { extraItems });
    }

    // Use returnUrl from request body, fallback to origin header, then referer
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
        plan,
        billing_cycle: billingCycle,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan,
          billing_cycle: billingCycle,
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
