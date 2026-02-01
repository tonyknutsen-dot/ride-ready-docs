import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin role
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    
    if (!userData.user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin using the has_role function
    const { data: isAdmin } = await supabaseClient.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      throw new Error("Unauthorized - Admin access required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Fetch various Stripe data
    const now = new Date();
    const thirtyDaysAgo = Math.floor((now.getTime() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const sixtyDaysAgo = Math.floor((now.getTime() - 60 * 24 * 60 * 60 * 1000) / 1000);

    // Get recent payments
    const [
      recentPayments,
      failedPayments,
      subscriptions,
      invoicesUpcoming,
      balance
    ] = await Promise.all([
      stripe.paymentIntents.list({ 
        limit: 50,
        created: { gte: thirtyDaysAgo }
      }),
      stripe.paymentIntents.list({ 
        limit: 50,
        created: { gte: sixtyDaysAgo }
      }).then(res => res.data.filter(pi => 
        pi.status === 'requires_payment_method' || 
        pi.status === 'canceled' ||
        pi.last_payment_error !== null
      )),
      stripe.subscriptions.list({ 
        limit: 100,
        status: 'all'
      }),
      // Get upcoming invoices (subscriptions due for renewal)
      stripe.invoices.list({
        limit: 50,
        status: 'draft'
      }),
      stripe.balance.retrieve()
    ]);

    // Calculate metrics
    const successfulPayments = recentPayments.data.filter(p => p.status === 'succeeded');
    const totalRevenue = successfulPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const activeSubscriptions = subscriptions.data.filter(s => s.status === 'active');
    const trialingSubscriptions = subscriptions.data.filter(s => s.status === 'trialing');
    const canceledSubscriptions = subscriptions.data.filter(s => s.status === 'canceled');
    const pastDueSubscriptions = subscriptions.data.filter(s => s.status === 'past_due');

    // Monthly Recurring Revenue (MRR)
    const mrr = activeSubscriptions.reduce((sum, sub) => {
      const item = sub.items.data[0];
      if (!item?.price?.unit_amount) return sum;
      const amount = item.price.unit_amount;
      const interval = item.price.recurring?.interval;
      if (interval === 'year') return sum + Math.round(amount / 12);
      return sum + amount;
    }, 0);

    // Forecast next 30 days revenue based on upcoming renewals
    const upcomingRevenue = invoicesUpcoming.data.reduce((sum, inv) => sum + (inv.amount_due || 0), 0);

    // Churn data (canceled in last 30 days)
    const recentCancellations = canceledSubscriptions.filter(s => {
      const canceledAt = s.canceled_at;
      return canceledAt && canceledAt > thirtyDaysAgo;
    });

    // Format failed payments for display
    const formattedFailedPayments = failedPayments.slice(0, 20).map(pi => ({
      id: pi.id,
      amount: pi.amount,
      currency: pi.currency,
      status: pi.status,
      error: pi.last_payment_error?.message || 'Payment failed',
      created: pi.created,
      customer: pi.customer,
      metadata: pi.metadata
    }));

    // Format recent successful payments
    const formattedRecentPayments = successfulPayments.slice(0, 20).map(pi => ({
      id: pi.id,
      amount: pi.amount,
      currency: pi.currency,
      status: pi.status,
      created: pi.created,
      customer: pi.customer
    }));

    // Get customer emails for context
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
      } catch {
        // Skip if customer retrieval fails
      }
    }

    // Add emails to payments
    const failedWithEmails = formattedFailedPayments.map(p => ({
      ...p,
      email: p.customer ? customerMap[p.customer as string] : undefined
    }));

    const recentWithEmails = formattedRecentPayments.map(p => ({
      ...p,
      email: p.customer ? customerMap[p.customer as string] : undefined
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
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
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
