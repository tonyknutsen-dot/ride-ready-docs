import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { PRODUCT_TO_TIER } from "../_shared/stripe-pricing.ts";

serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    if (!userData.user) throw new Error("Unauthorized");

    const { data: isAdmin } = await supabaseClient.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin'
    });
    if (!isAdmin) throw new Error("Unauthorized - Admin access required");

    // Parse request body for action
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* no body is fine */ }
    const action = (body.action as string) || 'dashboard';

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // ── ACTION: manual_resync ──
    if (action === 'manual_resync') {
      const targetUserId = body.user_id as string;
      if (!targetUserId) throw new Error("user_id required for manual_resync");

      // Get profile
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id, subscription_status, subscription_plan, stripe_customer_id, stripe_subscription_id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (!profile) throw new Error("Profile not found");

      let newStatus = profile.subscription_status;
      let newPlan = profile.subscription_plan;
      let mismatch = false;
      let stripeStatus = 'unknown';
      let stripePlan: string | null = null;

      if (profile.stripe_subscription_id) {
        try {
          const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
          stripeStatus = sub.status;
          const productId = sub.items.data[0]?.price.product as string;
          stripePlan = PRODUCT_TO_TIER[productId] || 'starter';

          const mappedStatus = sub.status === 'active' ? 'active'
            : sub.status === 'past_due' ? 'past_due'
            : sub.status === 'canceled' ? 'expired'
            : profile.subscription_status;

          mismatch = mappedStatus !== profile.subscription_status || stripePlan !== profile.subscription_plan;
          newStatus = mappedStatus;
          newPlan = sub.status === 'canceled' ? null : stripePlan;

          await supabaseAdmin
            .from("profiles")
            .update({
              subscription_status: newStatus,
              subscription_plan: newPlan,
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              cancel_at_period_end: sub.cancel_at_period_end ?? false,
              cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
              last_billing_sync_at: new Date().toISOString(),
            })
            .eq("user_id", targetUserId);
        } catch (stripeErr) {
          stripeStatus = 'retrieval_failed';
          mismatch = true;
        }
      }

      // Log the manual resync
      await supabaseAdmin.from("billing_sync_log").insert({
        user_id: targetUserId,
        event_type: 'manual_resync',
        stripe_subscription_id: profile.stripe_subscription_id,
        stripe_customer_id: profile.stripe_customer_id,
        previous_status: profile.subscription_status,
        new_status: newStatus,
        previous_plan: profile.subscription_plan,
        new_plan: newPlan,
        stripe_status: stripeStatus,
        stripe_plan: stripePlan,
        mismatch_detected: mismatch,
        details: { resynced_by: userData.user.id },
      });

      return new Response(JSON.stringify({ success: true, mismatch, newStatus, newPlan }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // ── ACTION: dashboard (default) ──

    const now = new Date();
    const thirtyDaysAgo = Math.floor((now.getTime() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const sixtyDaysAgo = Math.floor((now.getTime() - 60 * 24 * 60 * 60 * 1000) / 1000);

    const [
      recentPayments,
      failedPayments,
      subscriptions,
      invoicesUpcoming,
      balance
    ] = await Promise.all([
      stripe.paymentIntents.list({ limit: 50, created: { gte: thirtyDaysAgo } }),
      stripe.paymentIntents.list({ limit: 50, created: { gte: sixtyDaysAgo } })
        .then(res => res.data.filter(pi =>
          pi.status === 'requires_payment_method' ||
          pi.status === 'canceled' ||
          pi.last_payment_error !== null
        )),
      stripe.subscriptions.list({ limit: 100, status: 'all' }),
      stripe.invoices.list({ limit: 50, status: 'draft' }),
      stripe.balance.retrieve()
    ]);

    // ── Per-user billing health ──
    // Get all profiles with Stripe data
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, controller_name, company_name, subscription_status, subscription_plan, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end, cancel_at, last_billing_sync_at, pending_subscription_plan, pending_change_effective_date")
      .not("stripe_customer_id", "is", null);

    // Build Stripe subscription lookup by subscription ID
    const stripeSubMap: Record<string, Stripe.Subscription> = {};
    for (const sub of subscriptions.data) {
      stripeSubMap[sub.id] = sub;
    }

    // Build per-user health rows
    const userHealthRows = (profiles || []).map(profile => {
      const stripeSub = profile.stripe_subscription_id
        ? stripeSubMap[profile.stripe_subscription_id]
        : null;

      const stripeStatus = stripeSub?.status ?? null;
      const stripeProductId = stripeSub?.items?.data?.[0]?.price?.product as string | undefined;
      const stripePlan = stripeProductId ? (PRODUCT_TO_TIER[stripeProductId] || 'unknown') : null;
      const stripeCurrentPeriodEnd = stripeSub
        ? new Date(stripeSub.current_period_end * 1000).toISOString()
        : null;
      const stripeCancelAtPeriodEnd = stripeSub?.cancel_at_period_end ?? null;

      // Mismatch detection
      const appStatus = profile.subscription_status;
      const appPlan = profile.subscription_plan;

      // Map Stripe status to our app status for comparison
      const expectedAppStatus = stripeStatus === 'active' ? 'active'
        : stripeStatus === 'past_due' ? 'past_due'
        : stripeStatus === 'canceled' ? 'expired'
        : stripeStatus === 'trialing' ? 'trial'
        : null;

      const statusMismatch = expectedAppStatus !== null && appStatus !== expectedAppStatus;
      const planMismatch = stripePlan !== null && stripeStatus !== 'canceled' && appPlan !== stripePlan;
      const periodEndMismatch = stripeCurrentPeriodEnd && profile.current_period_end
        ? Math.abs(new Date(stripeCurrentPeriodEnd).getTime() - new Date(profile.current_period_end).getTime()) > 60000
        : false;

      const hasMismatch = statusMismatch || planMismatch || periodEndMismatch;

      // Classify problem severity
      let problemType: string | null = null;
      if (hasMismatch) problemType = 'mismatch';
      else if (appStatus === 'past_due') problemType = 'past_due';
      else if (stripeSub?.cancel_at_period_end) problemType = 'cancelling';

      // Sync freshness
      const syncAgeMs = profile.last_billing_sync_at
        ? now.getTime() - new Date(profile.last_billing_sync_at).getTime()
        : null;
      const syncStale = syncAgeMs !== null && syncAgeMs > 24 * 60 * 60 * 1000; // >24h

      if (syncStale && !problemType) problemType = 'stale_sync';

      return {
        user_id: profile.user_id,
        full_name: profile.full_name,
        company_name: profile.company_name,
        app_status: appStatus,
        app_plan: appPlan,
        stripe_status: stripeStatus,
        stripe_plan: stripePlan,
        stripe_customer_id: profile.stripe_customer_id,
        stripe_subscription_id: profile.stripe_subscription_id,
        current_period_end: profile.current_period_end,
        stripe_current_period_end: stripeCurrentPeriodEnd,
        cancel_at_period_end: profile.cancel_at_period_end,
        stripe_cancel_at_period_end: stripeCancelAtPeriodEnd,
        cancel_at: profile.cancel_at,
        last_billing_sync_at: profile.last_billing_sync_at,
        pending_subscription_plan: profile.pending_subscription_plan,
        pending_change_effective_date: profile.pending_change_effective_date,
        status_mismatch: statusMismatch,
        plan_mismatch: planMismatch,
        period_end_mismatch: periodEndMismatch,
        has_mismatch: hasMismatch,
        problem_type: problemType,
        sync_stale: syncStale,
      };
    });

    // Sort: problem users first, then by last sync
    userHealthRows.sort((a, b) => {
      const problemOrder = (t: string | null) => {
        if (t === 'mismatch') return 0;
        if (t === 'past_due') return 1;
        if (t === 'stale_sync') return 2;
        if (t === 'cancelling') return 3;
        return 4;
      };
      const diff = problemOrder(a.problem_type) - problemOrder(b.problem_type);
      if (diff !== 0) return diff;
      // Secondary: most recently synced last (stale at top)
      const aTime = a.last_billing_sync_at ? new Date(a.last_billing_sync_at).getTime() : 0;
      const bTime = b.last_billing_sync_at ? new Date(b.last_billing_sync_at).getTime() : 0;
      return aTime - bTime;
    });

    // ── Recent billing event log (last 50) ──
    const { data: recentSyncLog } = await supabaseAdmin
      .from("billing_sync_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    // ── Aggregate metrics (existing) ──
    const successfulPayments = recentPayments.data.filter(p => p.status === 'succeeded');
    const totalRevenue = successfulPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const activeSubscriptions = subscriptions.data.filter(s => s.status === 'active');
    const trialingSubscriptions = subscriptions.data.filter(s => s.status === 'trialing');
    const canceledSubscriptions = subscriptions.data.filter(s => s.status === 'canceled');
    const pastDueSubscriptions = subscriptions.data.filter(s => s.status === 'past_due');

    const mrr = activeSubscriptions.reduce((sum, sub) => {
      const item = sub.items.data[0];
      if (!item?.price?.unit_amount) return sum;
      const amount = item.price.unit_amount;
      const interval = item.price.recurring?.interval;
      if (interval === 'year') return sum + Math.round(amount / 12);
      return sum + amount;
    }, 0);

    const upcomingRevenue = invoicesUpcoming.data.reduce((sum, inv) => sum + (inv.amount_due || 0), 0);

    const recentCancellations = canceledSubscriptions.filter(s => {
      const canceledAt = s.canceled_at;
      return canceledAt && canceledAt > thirtyDaysAgo;
    });

    const formattedFailedPayments = failedPayments.slice(0, 20).map(pi => ({
      id: pi.id, amount: pi.amount, currency: pi.currency, status: pi.status,
      error: pi.last_payment_error?.message || 'Payment failed',
      created: pi.created, customer: pi.customer, metadata: pi.metadata
    }));

    const formattedRecentPayments = successfulPayments.slice(0, 20).map(pi => ({
      id: pi.id, amount: pi.amount, currency: pi.currency, status: pi.status,
      created: pi.created, customer: pi.customer
    }));

    // Get customer emails
    const customerIds = [...new Set([
      ...formattedFailedPayments.map(p => p.customer).filter(Boolean),
      ...formattedRecentPayments.map(p => p.customer).filter(Boolean)
    ])];

    const customerMap: Record<string, string> = {};
    for (const customerId of customerIds.slice(0, 20)) {
      try {
        const customer = await stripe.customers.retrieve(customerId as string);
        if (customer && !customer.deleted && 'email' in customer) {
          customerMap[customerId as string] = customer.email || 'No email';
        }
      } catch { /* skip */ }
    }

    const failedWithEmails = formattedFailedPayments.map(p => ({
      ...p, email: p.customer ? customerMap[p.customer as string] : undefined
    }));
    const recentWithEmails = formattedRecentPayments.map(p => ({
      ...p, email: p.customer ? customerMap[p.customer as string] : undefined
    }));

    const response = {
      summary: {
        totalRevenue30Days: totalRevenue,
        mrr,
        upcomingRevenue30Days: upcomingRevenue,
        activeSubscriptions: activeSubscriptions.length,
        trialingSubscriptions: trialingSubscriptions.length,
        pastDueSubscriptions: pastDueSubscriptions.length,
        recentCancellations: recentCancellations.length,
        failedPaymentsCount: failedPayments.length,
        balance: {
          available: balance.available.reduce((sum, b) => sum + b.amount, 0),
          pending: balance.pending.reduce((sum, b) => sum + b.amount, 0),
          currency: balance.available[0]?.currency || 'gbp'
        }
      },
      failedPayments: failedWithEmails,
      recentPayments: recentWithEmails,
      subscriptionBreakdown: {
        active: activeSubscriptions.length,
        trialing: trialingSubscriptions.length,
        pastDue: pastDueSubscriptions.length,
        canceled: canceledSubscriptions.length
      },
      // Phase 2 additions
      userHealth: userHealthRows,
      billingEventLog: recentSyncLog || [],
      problemUserCount: userHealthRows.filter(u => u.problem_type !== null).length,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (error) {
    console.error("Error fetching Stripe data:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: error.message.includes("Unauthorized") ? 403 : 500,
      }
    );
  }
});
