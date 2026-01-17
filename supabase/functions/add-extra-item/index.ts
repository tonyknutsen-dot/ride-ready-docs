import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, getSecureHeaders, getClientIp, checkIpBlocked, createBlockedIpResponse } from "../_shared/rate-limit.ts";

// Extra item price ID - £0.75/month
const EXTRA_ITEM_PRICE_ID = "price_1SnzrRAG8uIRefcZRHXJlDuy";
const EXTRA_ITEM_MONTHLY_COST = 75; // in pence

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADD-EXTRA-ITEM] ${step}${detailsStr}`);
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Rate limiting - payment endpoints get moderate limits
    const rateLimitKey = getClientIdentifier(req, "add-extra-item", user.id);
    const rateLimitResult = await checkRateLimit(rateLimitKey, "payment");
    if (!rateLimitResult.allowed) {
      logStep("Rate limit exceeded", { userId: user.id });
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    // Get user's profile with subscription info
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("stripe_subscription_id, billing_cycle, extra_items_count, current_period_end")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Could not fetch user profile");
    }

    if (!profile.stripe_subscription_id) {
      throw new Error("No active subscription found");
    }

    logStep("Profile fetched", { 
      subscriptionId: profile.stripe_subscription_id, 
      billingCycle: profile.billing_cycle,
      currentExtraItems: profile.extra_items_count 
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Fetch the subscription
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    
    if (subscription.status !== 'active') {
      throw new Error("Subscription is not active");
    }

    const currentExtraItems = profile.extra_items_count || 0;
    const newExtraItemsCount = currentExtraItems + 1;

    if (profile.billing_cycle === 'yearly') {
      // YEARLY: Calculate remaining months and create one-time charge
      const now = new Date();
      const periodEnd = new Date(profile.current_period_end!);
      const msRemaining = periodEnd.getTime() - now.getTime();
      const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
      const monthsRemaining = Math.ceil(daysRemaining / 30); // Approximate months
      
      // Calculate prorated charge (remaining months × £0.75)
      const proratedAmount = monthsRemaining * EXTRA_ITEM_MONTHLY_COST;
      
      logStep("Yearly billing - creating prorated charge", { 
        daysRemaining, 
        monthsRemaining, 
        proratedAmount 
      });

      // Create one-time invoice item for the prorated amount
      await stripe.invoiceItems.create({
        customer: subscription.customer as string,
        amount: proratedAmount,
        currency: 'gbp',
        description: `Extra Item - Prorated for ${monthsRemaining} months remaining`,
      });

      // Create and pay the invoice immediately
      const invoice = await stripe.invoices.create({
        customer: subscription.customer as string,
        auto_advance: true,
      });

      await stripe.invoices.pay(invoice.id);

      logStep("Prorated invoice created and paid", { invoiceId: invoice.id });

      // Also add the recurring item to the subscription for next renewal
      // Check if extra item already exists in subscription
      let extraItemSubscriptionItem = subscription.items.data.find(
        item => item.price.id === EXTRA_ITEM_PRICE_ID
      );

      if (extraItemSubscriptionItem) {
        // Update existing extra item quantity
        await stripe.subscriptionItems.update(extraItemSubscriptionItem.id, {
          quantity: newExtraItemsCount,
          proration_behavior: 'none', // Already charged prorated amount above
        });
      } else {
        // Add new extra item line
        await stripe.subscriptionItems.create({
          subscription: subscription.id,
          price: EXTRA_ITEM_PRICE_ID,
          quantity: newExtraItemsCount,
          proration_behavior: 'none', // Already charged prorated amount above
        });
      }

    } else {
      // MONTHLY: Add/update recurring extra item to subscription
      logStep("Monthly billing - adding recurring item");

      // Check if extra item already exists in subscription
      let extraItemSubscriptionItem = subscription.items.data.find(
        item => item.price.id === EXTRA_ITEM_PRICE_ID
      );

      if (extraItemSubscriptionItem) {
        // Update existing extra item quantity
        await stripe.subscriptionItems.update(extraItemSubscriptionItem.id, {
          quantity: newExtraItemsCount,
          proration_behavior: 'create_prorations', // Charge prorated amount for this billing period
        });
        logStep("Updated existing extra item quantity", { newQuantity: newExtraItemsCount });
      } else {
        // Add new extra item line
        await stripe.subscriptionItems.create({
          subscription: subscription.id,
          price: EXTRA_ITEM_PRICE_ID,
          quantity: newExtraItemsCount,
          proration_behavior: 'create_prorations', // Charge prorated amount for this billing period
        });
        logStep("Added new extra item to subscription", { quantity: newExtraItemsCount });
      }
    }

    // Update the profile with new extra items count
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ extra_items_count: newExtraItemsCount })
      .eq("user_id", user.id);

    if (updateError) {
      logStep("Warning: Failed to update profile extra_items_count", { error: updateError.message });
    }

    logStep("Extra item added successfully", { newExtraItemsCount });

    return new Response(JSON.stringify({ 
      success: true, 
      extraItemsCount: newExtraItemsCount,
      billingCycle: profile.billing_cycle,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
