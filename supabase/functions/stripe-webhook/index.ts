import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Product ID to plan mapping
const PRODUCT_TO_PLAN: Record<string, 'basic' | 'advanced'> = {
  "prod_TlWvelEK6GafPH": "basic",   // Documents & Compliance - Monthly
  "prod_TlWvGM8f7f2mRa": "basic",   // Documents & Compliance - Yearly
  "prod_TlWvaItiHUq1PZ": "advanced", // Operations & Maintenance - Monthly
  "prod_TlWv8lD3Q4BCIX": "advanced", // Operations & Maintenance - Yearly
};

// Extra item price ID for counting
const EXTRA_ITEM_PRICE_ID = "price_1SnzrRAG8uIRefcZRHXJlDuy";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("No stripe-signature header");

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logStep("Webhook signature verification failed", { error: message });
      return new Response(JSON.stringify({ error: `Webhook Error: ${message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Event received", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", { sessionId: session.id });
        
        const userId = session.metadata?.user_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        
        if (userId && customerId && subscriptionId) {
          // Fetch subscription details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const productId = subscription.items.data[0]?.price.product as string;
          const plan = PRODUCT_TO_PLAN[productId] || 'basic';
          const billingCycle = session.metadata?.billing_cycle || 'monthly';
          
          // Count extra items
          let extraItemsCount = 0;
          for (const item of subscription.items.data) {
            const price = item.price;
            if (price.id === EXTRA_ITEM_PRICE_ID) {
              extraItemsCount = item.quantity || 0;
            }
          }
          
          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_status: plan,
              subscription_plan: plan,
              billing_cycle: billingCycle,
              extra_items_count: extraItemsCount,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq("user_id", userId);

          if (error) {
            logStep("Error updating profile", { error: error.message });
          } else {
            logStep("Profile updated successfully", { userId, plan, customerId });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", { subscriptionId: subscription.id });
        
        const productId = subscription.items.data[0]?.price.product as string;
        const plan = PRODUCT_TO_PLAN[productId] || 'basic';
        
        // Count extra items
        let extraItemsCount = 0;
        for (const item of subscription.items.data) {
          const price = item.price;
          if (price.id === EXTRA_ITEM_PRICE_ID) {
            extraItemsCount = item.quantity || 0;
          }
        }
        
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: subscription.status === 'active' ? plan : 'expired',
            subscription_plan: plan,
            extra_items_count: extraItemsCount,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("Error updating subscription", { error: error.message });
        } else {
          logStep("Subscription updated in database");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { subscriptionId: subscription.id });
        
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: 'expired',
            subscription_plan: null,
            extra_items_count: 0,
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("Error marking subscription expired", { error: error.message });
        } else {
          logStep("Subscription marked as expired");
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice paid", { invoiceId: invoice.id });
        
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          
          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq("stripe_subscription_id", invoice.subscription);

          if (error) {
            logStep("Error updating period end", { error: error.message });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice payment failed", { invoiceId: invoice.id });
        // Could send notification to user here
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
