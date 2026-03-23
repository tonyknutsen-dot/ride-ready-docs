import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { PRODUCT_TO_TIER } from "../_shared/stripe-pricing.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

/** Fetch the user's current profile status + plan so we can log the delta. */
async function getProfileState(supabase: ReturnType<typeof createClient>, key: string, value: string) {
  const { data } = await supabase
    .from("profiles")
    .select("user_id, subscription_status, subscription_plan, last_billing_sync_at")
    .eq(key, value)
    .maybeSingle();
  return data;
}

/** Write a row to billing_sync_log and stamp last_billing_sync_at on the profile. */
async function logBillingEvent(
  supabase: ReturnType<typeof createClient>,
  params: {
    userId: string | null;
    eventType: string;
    stripeEventId: string;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    previousStatus?: string | null;
    newStatus?: string | null;
    previousPlan?: string | null;
    newPlan?: string | null;
    stripeStatus?: string;
    stripePlan?: string | null;
    mismatchDetected?: boolean;
    details?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("billing_sync_log").insert({
    user_id: params.userId,
    event_type: params.eventType,
    stripe_event_id: params.stripeEventId,
    stripe_subscription_id: params.stripeSubscriptionId ?? null,
    stripe_customer_id: params.stripeCustomerId ?? null,
    previous_status: params.previousStatus ?? null,
    new_status: params.newStatus ?? null,
    previous_plan: params.previousPlan ?? null,
    new_plan: params.newPlan ?? null,
    stripe_status: params.stripeStatus ?? null,
    stripe_plan: params.stripePlan ?? null,
    mismatch_detected: params.mismatchDetected ?? false,
    details: params.details ?? {},
  });
  if (error) logStep("Failed to write billing_sync_log", { error: error.message });

  // Stamp last_billing_sync_at
  if (params.userId) {
    await supabase
      .from("profiles")
      .update({ last_billing_sync_at: new Date().toISOString() })
      .eq("user_id", params.userId);
  }
}

serve(async (req) => {
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
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          const prev = await getProfileState(supabaseAdmin, "user_id", userId);
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const productId = subscription.items.data[0]?.price.product as string;
          const tier = PRODUCT_TO_TIER[productId] || 'starter';

          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_status: 'active',
              subscription_plan: tier,
              billing_cycle: 'monthly',
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              last_billing_sync_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          if (error) {
            logStep("Error updating profile", { error: error.message });
          } else {
            logStep("Profile updated successfully", { userId, tier, customerId });
          }

          await logBillingEvent(supabaseAdmin, {
            userId,
            eventType: event.type,
            stripeEventId: event.id,
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: customerId,
            previousStatus: prev?.subscription_status,
            newStatus: 'active',
            previousPlan: prev?.subscription_plan,
            newPlan: tier,
            stripeStatus: subscription.status,
            stripePlan: tier,
            details: { session_id: session.id },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", {
          subscriptionId: subscription.id,
          cancel_at_period_end: subscription.cancel_at_period_end,
          cancel_at: subscription.cancel_at,
        });

        const productId = subscription.items.data[0]?.price.product as string;
        const tier = PRODUCT_TO_TIER[productId] || 'starter';

        const mappedStatus = subscription.status === 'active'
          ? 'active'
          : subscription.status === 'past_due'
          ? 'past_due'
          : 'expired';

        const prev = await getProfileState(supabaseAdmin, "stripe_subscription_id", subscription.id);

        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: mappedStatus,
            subscription_plan: tier,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
            cancel_at: subscription.cancel_at
              ? new Date(subscription.cancel_at * 1000).toISOString()
              : null,
            last_billing_sync_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("Error updating subscription", { error: error.message });
        } else {
          logStep("Subscription updated in database", { tier, cancel_at_period_end: subscription.cancel_at_period_end });
        }

        // Detect change type for the log
        let changeType = 'update';
        if (subscription.cancel_at_period_end && !prev?.subscription_status?.includes('cancel')) {
          changeType = 'cancellation_scheduled';
        } else if (prev?.subscription_plan && tier !== prev.subscription_plan) {
          changeType = tier > prev.subscription_plan ? 'upgrade' : 'downgrade';
        } else if (prev?.subscription_status === 'past_due' && mappedStatus === 'active') {
          changeType = 'reactivation';
        }

        await logBillingEvent(supabaseAdmin, {
          userId: prev?.user_id ?? null,
          eventType: event.type,
          stripeEventId: event.id,
          stripeSubscriptionId: subscription.id,
          previousStatus: prev?.subscription_status,
          newStatus: mappedStatus,
          previousPlan: prev?.subscription_plan,
          newPlan: tier,
          stripeStatus: subscription.status,
          stripePlan: tier,
          details: {
            change_type: changeType,
            cancel_at_period_end: subscription.cancel_at_period_end,
            cancel_at: subscription.cancel_at,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { subscriptionId: subscription.id });

        const prev = await getProfileState(supabaseAdmin, "stripe_subscription_id", subscription.id);

        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: 'expired',
            subscription_plan: null,
            last_billing_sync_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("Error marking subscription expired", { error: error.message });
        } else {
          logStep("Subscription marked as expired");
        }

        await logBillingEvent(supabaseAdmin, {
          userId: prev?.user_id ?? null,
          eventType: event.type,
          stripeEventId: event.id,
          stripeSubscriptionId: subscription.id,
          previousStatus: prev?.subscription_status,
          newStatus: 'expired',
          previousPlan: prev?.subscription_plan,
          newPlan: null,
          stripeStatus: 'canceled',
          stripePlan: null,
          details: { change_type: 'cancellation_completed' },
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice paid", { invoiceId: invoice.id });

        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const productId = subscription.items.data[0]?.price.product as string;
          const tier = PRODUCT_TO_TIER[productId] || 'starter';

          const prev = await getProfileState(supabaseAdmin, "stripe_subscription_id", invoice.subscription as string);

          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              subscription_status: 'active',
              subscription_plan: tier,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              last_billing_sync_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", invoice.subscription as string);

          if (error) {
            logStep("Error restoring active status on invoice.paid", { error: error.message });
          } else {
            logStep("Profile restored to active on invoice.paid", { tier });
          }

          const changeType = prev?.subscription_status === 'past_due' ? 'renewal_after_failure' : 'renewal';

          await logBillingEvent(supabaseAdmin, {
            userId: prev?.user_id ?? null,
            eventType: event.type,
            stripeEventId: event.id,
            stripeSubscriptionId: invoice.subscription as string,
            previousStatus: prev?.subscription_status,
            newStatus: 'active',
            previousPlan: prev?.subscription_plan,
            newPlan: tier,
            stripeStatus: 'active',
            stripePlan: tier,
            details: { change_type: changeType, invoice_id: invoice.id, amount: invoice.amount_paid },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice payment failed", { invoiceId: invoice.id, attempt: invoice.attempt_count });

        if (invoice.subscription) {
          const prev = await getProfileState(supabaseAdmin, "stripe_subscription_id", invoice.subscription as string);

          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              subscription_status: 'past_due',
              last_billing_sync_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", invoice.subscription);

          if (error) {
            logStep("Error updating profile to past_due", { error: error.message });
          } else {
            logStep("Profile marked as past_due");
          }

          await logBillingEvent(supabaseAdmin, {
            userId: prev?.user_id ?? null,
            eventType: event.type,
            stripeEventId: event.id,
            stripeSubscriptionId: invoice.subscription as string,
            previousStatus: prev?.subscription_status,
            newStatus: 'past_due',
            previousPlan: prev?.subscription_plan,
            newPlan: prev?.subscription_plan,
            stripeStatus: 'past_due',
            stripePlan: prev?.subscription_plan,
            details: {
              change_type: 'payment_failed',
              invoice_id: invoice.id,
              attempt_count: invoice.attempt_count,
              amount_due: invoice.amount_due,
            },
          });
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
