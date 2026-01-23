import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTester } from '@/contexts/TesterContext';
import { supabase } from '@/integrations/supabase/client';

// Item limits per plan (rides, stalls, games, equipment)
export const RIDE_LIMITS = {
  trial: 5,
  basic: 5,
  advanced: 10,
  tester: 999, // Unlimited for testers
  // Additional items cost 75p/month each
  extended_basic: 50,
  extended_advanced: 50,
} as const;

// Pricing constants
export const PRICING = {
  basic: {
    monthly: 6.99,
    yearly: 69.90,
    includedItems: 5,
    additionalItemCost: 0.75,
  },
  advanced: {
    monthly: 18.99,
    yearly: 189.90,
    includedItems: 10,
    additionalItemCost: 0.75,
  },
  annualDiscount: 2, // months free
  annualBillingMonths: 10, // 12 months - 2 months free = 10 months charged
} as const;

// Stripe price IDs - Documents & Compliance = Basic, Operations & Maintenance = Advanced
export const STRIPE_PRICE_IDS = {
  basic_monthly: "price_1SnzrIAG8uIRefcZWHRZs14k",    // Documents & Compliance Monthly - £6.99
  basic_yearly: "price_1SnzrMAG8uIRefcZ6bfyMMyR",     // Documents & Compliance Yearly - £69.90
  advanced_monthly: "price_1SnzrOAG8uIRefcZHBSrVObC", // Operations & Maintenance Monthly - £18.99
  advanced_yearly: "price_1SnzrQAG8uIRefcZq3oC3vso",  // Operations & Maintenance Yearly - £189.90
  extra_item: "price_1SnzrRAG8uIRefcZRHXJlDuy",       // Extra Item - £0.75/mo
} as const;

export interface SubscriptionData {
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: 'trial' | 'basic' | 'advanced' | 'expired' | 'tester';
  subscriptionPlan: 'basic' | 'advanced' | null;
  billingCycle: 'monthly' | 'yearly' | null;
  daysRemaining: number;
  isTrialActive: boolean;
  isExpired: boolean;
  rideCount: number;
  rideLimit: number;
  canAddRide: boolean;
  extraItemsCount: number;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  isTesterAccount: boolean;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const { isTester, isLoading: testerLoading } = useTester();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptionData = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    // Wait for tester status to be determined
    if (testerLoading) {
      return;
    }

    try {
      // Fetch profile and ride count in parallel
      const [profileResult, rideCountResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('trial_started_at, trial_ends_at, subscription_status, subscription_plan, billing_cycle, extra_items_count, current_period_end, stripe_customer_id, stripe_subscription_id')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('rides')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
      ]);

      if (profileResult.error) {
        console.error('Error fetching subscription data:', profileResult.error);
        return;
      }

      const data = profileResult.data;
      const rideCount = rideCountResult.count || 0;

      if (data) {
        const now = new Date();
        const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
        const daysRemaining = trialEndsAt 
          ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        // TESTER BYPASS: Override subscription status for testers
        if (isTester) {
          const testerSubscription: SubscriptionData = {
            trialStartedAt: data.trial_started_at,
            trialEndsAt: data.trial_ends_at,
            subscriptionStatus: 'tester',
            subscriptionPlan: 'advanced', // Full access
            billingCycle: null,
            daysRemaining: 999,
            isTrialActive: false,
            isExpired: false,
            rideCount,
            rideLimit: RIDE_LIMITS.tester,
            canAddRide: true, // Always can add
            extraItemsCount: 0,
            currentPeriodEnd: null,
            stripeCustomerId: null, // No Stripe for testers
            stripeSubscriptionId: null,
            isTesterAccount: true,
          };
          setSubscription(testerSubscription);
          setLoading(false);
          return;
        }

        const status = data.subscription_status as SubscriptionData['subscriptionStatus'];
        const extraItemsCount = data.extra_items_count || 0;
        const baseLimit = RIDE_LIMITS[status] || RIDE_LIMITS.basic;
        const rideLimit = baseLimit + extraItemsCount;

        const subscriptionData: SubscriptionData = {
          trialStartedAt: data.trial_started_at,
          trialEndsAt: data.trial_ends_at,
          subscriptionStatus: status,
          subscriptionPlan: data.subscription_plan as SubscriptionData['subscriptionPlan'],
          billingCycle: data.billing_cycle as SubscriptionData['billingCycle'],
          daysRemaining,
          isTrialActive: data.subscription_status === 'trial' && daysRemaining > 0,
          isExpired: data.subscription_status === 'expired' || (data.subscription_status === 'trial' && daysRemaining === 0),
          rideCount,
          rideLimit,
          canAddRide: rideCount < rideLimit,
          extraItemsCount,
          currentPeriodEnd: data.current_period_end,
          stripeCustomerId: data.stripe_customer_id,
          stripeSubscriptionId: data.stripe_subscription_id,
          isTesterAccount: false,
        };

        setSubscription(subscriptionData);
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isTester, testerLoading]);

  useEffect(() => {
    fetchSubscriptionData();
  }, [fetchSubscriptionData]);

  // Check subscription status with Stripe (syncs database)
  const checkSubscriptionStatus = useCallback(async () => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        return null;
      }
      
      // Refresh local data after sync
      await fetchSubscriptionData();
      return data;
    } catch (error) {
      console.error('Error checking subscription:', error);
      return null;
    }
  }, [user, fetchSubscriptionData]);

  const refreshRideCount = async () => {
    if (!user || !subscription) return;
    
    const { count } = await supabase
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    
    const rideCount = count || 0;
    setSubscription(prev => prev ? {
      ...prev,
      rideCount,
      canAddRide: rideCount < prev.rideLimit,
    } : null);
  };

  // Create Stripe checkout session
  // TESTER BYPASS: Prevent testers from triggering billing
  const createCheckout = async (plan: 'basic' | 'advanced', billingCycle: 'monthly' | 'yearly', extraItems: number = 0) => {
    if (!user) throw new Error('User not authenticated');
    
    // Block billing for testers
    if (isTester) {
      console.log('[TESTER] Checkout blocked - testers have full access without billing');
      return { blocked: true, reason: 'tester_account' };
    }

    // Pass full return URL including path for reliable redirect after checkout
    const returnUrl = window.location.origin;
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { plan, billingCycle, extraItems, returnUrl },
    });

    if (error) throw error;
    
    if (data?.url) {
      // Redirect in same tab for better UX - user returns to billing page after checkout
      window.location.href = data.url;
    }
    
    return data;
  };

  // Open customer portal for subscription management
  // TESTER BYPASS: Prevent testers from accessing billing portal
  const openCustomerPortal = async () => {
    if (!user) throw new Error('User not authenticated');
    
    // Block billing portal for testers
    if (isTester) {
      console.log('[TESTER] Customer portal blocked - testers do not have billing');
      return { blocked: true, reason: 'tester_account' };
    }

    const returnUrl = window.location.origin;
    const { data, error } = await supabase.functions.invoke('customer-portal', {
      body: { returnUrl },
    });

    if (error) throw error;
    
    if (data?.url) window.location.assign(data.url);
    
    return data;
  };

  // Legacy upgrade function (for backward compatibility during trial)
  // TESTER BYPASS: Block upgrade for testers
  const upgradeSubscription = async (plan: 'basic' | 'advanced') => {
    if (isTester) {
      console.log('[TESTER] Upgrade blocked - testers have full access');
      return;
    }
    // Now redirects to Stripe checkout
    await createCheckout(plan, 'monthly');
  };

  return {
    subscription,
    loading,
    upgradeSubscription,
    refreshRideCount,
    createCheckout,
    openCustomerPortal,
    checkSubscriptionStatus,
    refreshSubscription: fetchSubscriptionData,
  };
};
