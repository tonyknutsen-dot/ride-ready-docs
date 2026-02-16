import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Product ID to tier mapping (ride-based pricing)
const PRODUCT_TO_TIER: Record<string, string> = {
  // New ride-based tier products
  "prod_TzSQ7dF4G0dKJD": "starter",
  "prod_TzSQDJ4tk7rqMD": "operator",
  "prod_TzSQRtud9y5adH": "professional",
  "prod_TzSQUajo9gq5iY": "enterprise",
  // Legacy products - map to active status
  "prod_TlWvelEK6GafPH": "starter",
  "prod_TlWvGM8f7f2mRa": "starter",
  "prod_TlWvaItiHUq1PZ": "operator",
  "prod_TlWv8lD3Q4BCIX": "operator",
  "prod_SXfMmvFhJCpgPz": "starter",
  "prod_SXfOT7Wm2qkLzI": "starter",
  "prod_SXfOIqB5fXfmOi": "operator",
  "prod_SXfPx1nMO9nxbA": "operator",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token || token === "undefined" || token === "null") {
      return new Response(
        JSON.stringify({ subscribed: false, tier: null, subscription_end: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      const msg = userError.message || "Unknown auth error";
      if (msg.includes("Auth session missing") || msg.includes("missing sub claim") || 
          msg.includes("invalid claim") || msg.includes("invalid token")) {
        logStep("Auth error - returning safe unsubscribed state", { message: msg });
        return new Response(
          JSON.stringify({ subscribed: false, tier: null, subscription_end: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      throw new Error(`Authentication error: ${msg}`);
    }

    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      return new Response(JSON.stringify({ subscribed: false, tier: null, subscription_end: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
    const hasActiveSub = subscriptions.data.length > 0;
    let tier: string | null = null;
    let subscriptionEnd: string | null = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      const productId = subscription.items.data[0]?.price.product as string;
      tier = PRODUCT_TO_TIER[productId] || 'starter';
      logStep("Active subscription found", { subscriptionId: subscription.id, tier, productId });

      // Update database - use 'active' as the unified status
      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          subscription_status: 'active',
          subscription_plan: tier,
          billing_cycle: 'monthly',
          current_period_end: subscriptionEnd,
        })
        .eq("user_id", user.id);

      if (updateError) {
        logStep("Error updating profile", { error: updateError.message });
      }
    } else {
      logStep("No active subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      tier,
      subscription_end: subscriptionEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
