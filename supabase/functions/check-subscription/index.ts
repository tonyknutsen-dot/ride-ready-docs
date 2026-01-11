import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Product ID to plan mapping
const PRODUCT_TO_PLAN: Record<string, 'basic' | 'advanced'> = {
  "prod_SXfMmvFhJCpgPz": "basic",   // Documents & Compliance - Monthly
  "prod_SXfOT7Wm2qkLzI": "basic",   // Documents & Compliance - Yearly  
  "prod_SXfOIqB5fXfmOi": "advanced", // Operations & Maintenance - Monthly
  "prod_SXfPx1nMO9nxbA": "advanced", // Operations & Maintenance - Yearly
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight
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
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      return new Response(JSON.stringify({ 
        subscribed: false,
        plan: null,
        subscription_end: null,
        extra_items: 0,
        billing_cycle: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let plan: 'basic' | 'advanced' | null = null;
    let subscriptionEnd: string | null = null;
    let extraItems = 0;
    let billingCycle: 'monthly' | 'yearly' | null = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
      
      // Determine plan from product
      const productId = subscription.items.data[0]?.price.product as string;
      plan = PRODUCT_TO_PLAN[productId] || 'basic';
      logStep("Determined subscription plan", { productId, plan });

      // Check billing interval
      const interval = subscription.items.data[0]?.price.recurring?.interval;
      billingCycle = interval === 'year' ? 'yearly' : 'monthly';

      // Count extra items
      for (const item of subscription.items.data) {
        if (item.price.id === "price_1RXcIzRsp1KGo6dTTFGhIcDr") {
          extraItems = item.quantity || 0;
        }
      }
      
      // Update database with latest subscription info
      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          subscription_status: plan,
          subscription_plan: plan,
          billing_cycle: billingCycle,
          extra_items_count: extraItems,
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
      plan,
      subscription_end: subscriptionEnd,
      extra_items: extraItems,
      billing_cycle: billingCycle,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
