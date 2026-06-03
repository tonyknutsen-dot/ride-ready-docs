import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getSecureHeaders, getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";
import { TIER_PRICE_IDS, type RideTier } from "../_shared/stripe-pricing.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

const getStripeKeyDiagnostic = (stripeKey: string) => {
  const trimmed = stripeKey.trim();
  const keyMode = trimmed.includes("_live_") ? "live" : trimmed.includes("_test_") ? "test" : "unknown";
  const keyType = trimmed.startsWith("sk_") ? "secret" : trimmed.startsWith("rk_") ? "restricted" : "unknown";
  return { keyMode, keyType };
};

const getStripeErrorDetails = (error: unknown) => {
  if (error && typeof error === "object") {
    const stripeError = error as { message?: string; type?: string; code?: string; statusCode?: number };
    return {
      message: stripeError.message ?? String(error),
      type: stripeError.type,
      code: stripeError.code,
      statusCode: stripeError.statusCode,
    };
  }
  return { message: String(error) };
};

const logStripeDiagnostics = async (stripe: Stripe, stripeKey: string, priceId: string) => {
  const keyDiagnostic = getStripeKeyDiagnostic(stripeKey);
  logStep("Stripe diagnostic: key mode/type", keyDiagnostic);

  try {
    const account = await stripe.accounts.retrieve();
    logStep("Stripe diagnostic: account retrieved", { accountId: account.id });
  } catch (error) {
    logStep("Stripe diagnostic: account retrieve failed", getStripeErrorDetails(error));
  }

  try {
    const price = await stripe.prices.retrieve(priceId);
    logStep("Stripe diagnostic: price retrieve succeeded", {
      priceId: price.id,
      productId: typeof price.product === "string" ? price.product : price.product.id,
      active: price.active,
      livemode: price.livemode,
    });
  } catch (error) {
    logStep("Stripe diagnostic: price retrieve failed", {
      priceId,
      ...getStripeErrorDetails(error),
    });
  }
};

serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
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

    // Early diagnostic — runs before auth so we can verify the configured key
    // without requiring a signed-in user. Logs only key prefix mode, account ID,
    // and price retrieve result. Never logs the actual secret.
    let earlyBody: { diagnosticOnly?: boolean } = {};
    try {
      earlyBody = await req.clone().json();
    } catch (_) { /* ignore */ }
    if (earlyBody?.diagnosticOnly === true) {
      const stripeEarly = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
      await logStripeDiagnostics(stripeEarly, stripeKey, TIER_PRICE_IDS.starter);
      return new Response(JSON.stringify({ diagnosticOnly: true, ran: "pre-auth" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }


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

    const rateLimitKey = getClientIdentifier(req, "create-checkout", user.id);
    const rateLimitResult = await checkRateLimit(rateLimitKey, "payment");
    if (!rateLimitResult.allowed) {
      logStep("Rate limit exceeded", { userId: user.id });
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const { tier, returnUrl, diagnosticOnly } = await req.json();
    logStep("Request params", { tier, returnUrl, diagnosticOnly: Boolean(diagnosticOnly) });

    if (!tier) {
      throw new Error("Missing required parameter: tier");
    }

    const priceId = TIER_PRICE_IDS[tier as RideTier];
    if (!priceId) {
      throw new Error(`Invalid tier: ${tier}. Valid tiers: starter, operator, professional, business`);
    }
    logStep("Price ID determined", { tier, priceId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    await logStripeDiagnostics(stripe, stripeKey, TIER_PRICE_IDS.starter);

    if (diagnosticOnly === true) {
      logStep("Diagnostic-only request completed before checkout creation", { userId: user.id });
      return new Response(JSON.stringify({ diagnosticOnly: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });

      // Guard: prevent duplicate subscriptions — one customer, one active subscription
      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      if (existingSubs.data.length > 0) {
        logStep("Active subscription already exists — blocking new checkout", {
          subscriptionId: existingSubs.data[0].id,
        });
        return new Response(
          JSON.stringify({
            error: "You already have an active subscription. Use the customer portal to change your plan.",
            existingSubscription: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
        );
      }
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: priceId, quantity: 1 }
    ];

    const fallbackReturnUrl = (() => {
      const referer = req.headers.get("referer");
      if (referer) return referer;
      const reqOrigin = req.headers.get("origin");
      return reqOrigin ? `${reqOrigin}/billing` : null;
    })();

    const rawReturnUrl = typeof returnUrl === "string" ? returnUrl : fallbackReturnUrl;
    if (!rawReturnUrl) {
      throw new Error("Missing return URL");
    }

    let billingReturnUrl: URL;
    try {
      billingReturnUrl = new URL(rawReturnUrl);
    } catch {
      throw new Error("Invalid return URL");
    }

    billingReturnUrl.pathname = "/billing";
    billingReturnUrl.searchParams.delete("success");
    billingReturnUrl.searchParams.delete("canceled");

    const successUrl = new URL(billingReturnUrl.toString());
    successUrl.searchParams.set("success", "true");

    const cancelUrl = new URL(billingReturnUrl.toString());
    cancelUrl.searchParams.set("canceled", "true");

    logStep("Using redirect URLs", {
      billingReturnUrl: billingReturnUrl.toString(),
      successUrl: successUrl.toString(),
      cancelUrl: cancelUrl.toString(),
    });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: "subscription",
      allow_promotion_codes: true,
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
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
