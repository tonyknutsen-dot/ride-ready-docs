import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { PRODUCT_TO_TIER } from "../_shared/stripe-pricing.ts";

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

    // Get current profile state before sync for comparison
    const { data: prevProfile } = await supabaseClient
      .from("profiles")
      .select("subscription_status, subscription_plan")
      .eq("user_id", user.id)
      .maybeSingle();

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

    const [activeSubs, pastDueSubs] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
      stripe.subscriptions.list({ customer: customerId, status: "past_due", limit: 1 }),
    ]);

    const subscription = activeSubs.data[0] || pastDueSubs.data[0];
    const hasActiveSub = !!subscription;
    let tier: string | null = null;
    let subscriptionEnd: string | null = null;
    let subStatus: 'active' | 'past_due' = 'active';
    let pendingPlan: string | null = null;
    let pendingChangeDate: string | null = null;

    if (hasActiveSub) {
      subStatus = subscription.status === 'past_due' ? 'past_due' : 'active';
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      const productId = subscription.items.data[0]?.price.product as string;
      tier = PRODUCT_TO_TIER[productId] || 'starter';
      const cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
      const cancelAt = subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null;
      logStep("Subscription found", { subscriptionId: subscription.id, tier, productId, status: subStatus, cancelAtPeriodEnd });

      // Check for a scheduled plan change
      const scheduleId = subscription.schedule as string | null;
      if (scheduleId) {
        try {
          const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
          if (schedule.phases && schedule.phases.length > 1) {
            const nextPhase = schedule.phases[schedule.phases.length - 1];
            if (nextPhase.items && nextPhase.items.length > 0) {
              const nextPriceId = typeof nextPhase.items[0].price === 'string'
                ? nextPhase.items[0].price
                : nextPhase.items[0].price;
              const nextPrice = await stripe.prices.retrieve(nextPriceId as string);
              const nextProductId = typeof nextPrice.product === 'string' ? nextPrice.product : '';
              const nextTier = PRODUCT_TO_TIER[nextProductId] || null;
              if (nextTier && nextTier !== tier) {
                pendingPlan = nextTier;
                pendingChangeDate = nextPhase.start_date
                  ? new Date(nextPhase.start_date * 1000).toISOString()
                  : subscriptionEnd;
                logStep("Pending plan change detected", { pendingPlan, pendingChangeDate });
              }
            }
          }
        } catch (schedError) {
          logStep("Could not fetch subscription schedule", { error: String(schedError) });
        }
      }

      // Detect mismatch: profile state doesn't match what Stripe says
      const mismatch = prevProfile
        ? (prevProfile.subscription_status !== subStatus || prevProfile.subscription_plan !== tier)
        : false;

      const syncTimestamp = new Date().toISOString();

      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          subscription_status: subStatus,
          subscription_plan: tier,
          billing_cycle: 'monthly',
          current_period_end: subscriptionEnd,
          cancel_at_period_end: cancelAtPeriodEnd,
          cancel_at: cancelAt,
          pending_subscription_plan: pendingPlan,
          pending_change_effective_date: pendingChangeDate,
          last_billing_sync_at: syncTimestamp,
        })
        .eq("user_id", user.id);

      if (updateError) {
        logStep("Error updating profile", { error: updateError.message });
      }

      // Log the polling sync event
      if (mismatch) {
        logStep("Mismatch detected during polling sync", {
          prevStatus: prevProfile?.subscription_status,
          newStatus: subStatus,
          prevPlan: prevProfile?.subscription_plan,
          newPlan: tier,
        });
      }

      await supabaseClient.from("billing_sync_log").insert({
        user_id: user.id,
        event_type: 'polling_sync',
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        previous_status: prevProfile?.subscription_status ?? null,
        new_status: subStatus,
        previous_plan: prevProfile?.subscription_plan ?? null,
        new_plan: tier,
        stripe_status: subscription.status,
        stripe_plan: tier,
        mismatch_detected: mismatch,
        details: {
          cancel_at_period_end: cancelAtPeriodEnd,
          cancel_at: cancelAt,
          pending_plan: pendingPlan,
        },
      });
    } else {
      logStep("No active subscription found");

      await supabaseClient
        .from("profiles")
        .update({
          pending_subscription_plan: null,
          pending_change_effective_date: null,
        })
        .eq("user_id", user.id);
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      tier,
      subscription_end: subscriptionEnd,
      pending_plan: pendingPlan,
      pending_change_date: pendingChangeDate,
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
