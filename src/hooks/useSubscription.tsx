import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTester } from '@/contexts/TesterContext';
import { useStaff } from '@/contexts/StaffContext';
import { supabase } from '@/integrations/supabase/client';

// Ride-based pricing tiers
export const RIDE_TIERS = {
  starter: { min: 1, max: 5, monthly: 9.99, label: 'Starter' },
  operator: { min: 6, max: 12, monthly: 19.99, label: 'Operator' },
  professional: { min: 13, max: 25, monthly: 34.99, label: 'Professional' },
  enterprise: { min: 26, max: Infinity, monthly: 49.99, label: 'Enterprise' },
} as const;

export type RideTier = keyof typeof RIDE_TIERS;

// Legacy RIDE_LIMITS export for backward compat
export const RIDE_LIMITS = {
  trial: 5,
  active: 999,
  tester: 999,
} as const;

// Stripe price IDs for ride-based tiers
export const STRIPE_PRICE_IDS = {
  starter_monthly: "price_1T1TVLAG8uIRefcZ1nMRWRVV",      // Starter £9.99/mo (1-5 rides)
  operator_monthly: "price_1T1TVMAG8uIRefcZKyL8XcLz",     // Operator £19.99/mo (6-12 rides)
  professional_monthly: "price_1T1TVNAG8uIRefcZviQXUgrA",  // Professional £34.99/mo (13-25 rides)
  enterprise_monthly: "price_1T1TVOAG8uIRefcZKAcqeqNw",    // Enterprise £49.99/mo (25+ rides)
} as const;

export const STRIPE_PRODUCT_IDS = {
  starter: "prod_TzSQ7dF4G0dKJD",
  operator: "prod_TzSQDJ4tk7rqMD",
  professional: "prod_TzSQRtud9y5adH",
  enterprise: "prod_TzSQUajo9gq5iY",
} as const;

export const getRideTier = (billableRideCount: number): RideTier => {
  if (billableRideCount <= 5) return 'starter';
  if (billableRideCount <= 12) return 'operator';
  if (billableRideCount <= 25) return 'professional';
  return 'enterprise';
};

export const getTierPrice = (tier: RideTier): number => {
  return RIDE_TIERS[tier].monthly;
};

export const getTierLabel = (tier: RideTier): string => {
  return RIDE_TIERS[tier].label;
};

export const getTierForRideCount = (count: number) => {
  const tier = getRideTier(count);
  return {
    tier,
    ...RIDE_TIERS[tier],
  };
};

export interface SubscriptionData {
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'tester';
  subscriptionPlan: string | null; // No longer used for feature gating
  billingCycle: 'monthly' | 'yearly' | null;
  daysRemaining: number;
  isTrialActive: boolean;
  isExpired: boolean;
  rideCount: number; // Total equipment count
  billableRideCount: number; // Only rides/inflatables that count toward pricing
  freeAssetCount: number; // Stalls, generators etc
  rideLimit: number;
  canAddRide: boolean;
  extraItemsCount: number;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
  hasStripeSubscription: boolean;
  isTesterAccount: boolean;
  isStaffMember: boolean;
  currentTier: RideTier;
  tierLabel: string;
  tierPrice: number;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const { isTester, isLoading: testerLoading } = useTester();
  const { isStaff, staffMembership, loading: staffLoading } = useStaff();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptionData = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    if (testerLoading || staffLoading) {
      return;
    }

    try {
      const profileUserId = isStaff && staffMembership?.ownerId 
        ? staffMembership.ownerId 
        : user.id;

      // Fetch profile, total ride count, and billable ride count in parallel
      const [profileResult, totalRideResult, billableRideResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('trial_started_at, trial_ends_at, subscription_status, subscription_plan, billing_cycle, extra_items_count, current_period_end')
          .eq('user_id', profileUserId)
          .maybeSingle(),
        supabase
          .from('rides')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profileUserId),
        supabase
          .from('rides')
          .select('id, ride_categories!inner(is_billable)', { count: 'exact' })
          .eq('user_id', profileUserId)
          .eq('ride_categories.is_billable', true),
      ]);

      if (profileResult.error) {
        console.error('Error fetching subscription data:', profileResult.error);
        return;
      }

      const data = profileResult.data;
      const totalRideCount = totalRideResult.count || 0;
      const billableRideCount = billableRideResult.count || 0;
      const freeAssetCount = totalRideCount - billableRideCount;

      if (data) {
        const now = new Date();
        const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
        const daysRemaining = trialEndsAt 
          ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        // TESTER BYPASS
        if (isTester) {
          const currentTier = getRideTier(billableRideCount);
          const testerSubscription: SubscriptionData = {
            trialStartedAt: data.trial_started_at,
            trialEndsAt: data.trial_ends_at,
            subscriptionStatus: 'tester',
            subscriptionPlan: null,
            billingCycle: null,
            daysRemaining: 999,
            isTrialActive: false,
            isExpired: false,
            rideCount: totalRideCount,
            billableRideCount,
            freeAssetCount,
            rideLimit: 999,
            canAddRide: true,
            extraItemsCount: 0,
            currentPeriodEnd: null,
            hasStripeCustomer: false,
            hasStripeSubscription: false,
            isTesterAccount: true,
            isStaffMember: false,
            currentTier,
            tierLabel: getTierLabel(currentTier),
            tierPrice: getTierPrice(currentTier),
          };
          setSubscription(testerSubscription);
          setLoading(false);
          return;
        }

        // Map old basic/advanced status to new 'active' status
        let status = data.subscription_status as string;
        let mappedStatus: SubscriptionData['subscriptionStatus'];
        if (status === 'basic' || status === 'advanced' || status === 'active') {
          mappedStatus = 'active';
        } else if (status === 'trial') {
          mappedStatus = daysRemaining > 0 ? 'trial' : 'expired';
        } else {
          mappedStatus = 'expired';
        }

        const currentTier = getRideTier(billableRideCount);

        const subscriptionData: SubscriptionData = {
          trialStartedAt: data.trial_started_at,
          trialEndsAt: data.trial_ends_at,
          subscriptionStatus: mappedStatus,
          subscriptionPlan: data.subscription_plan,
          billingCycle: data.billing_cycle as SubscriptionData['billingCycle'],
          daysRemaining,
          isTrialActive: mappedStatus === 'trial' && daysRemaining > 0,
          isExpired: mappedStatus === 'expired',
          rideCount: totalRideCount,
          billableRideCount,
          freeAssetCount,
          rideLimit: RIDE_TIERS[currentTier].max === Infinity ? 999 : RIDE_TIERS[currentTier].max,
          canAddRide: mappedStatus === 'trial' || (mappedStatus === 'active' && billableRideCount < (RIDE_TIERS[currentTier].max === Infinity ? 999 : RIDE_TIERS[currentTier].max)),
          extraItemsCount: data.extra_items_count || 0,
          currentPeriodEnd: data.current_period_end,
          hasStripeCustomer: mappedStatus === 'active',
          hasStripeSubscription: mappedStatus === 'active',
          isTesterAccount: false,
          isStaffMember: isStaff,
          currentTier,
          tierLabel: getTierLabel(currentTier),
          tierPrice: getTierPrice(currentTier),
        };

        setSubscription(subscriptionData);
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isTester, testerLoading, isStaff, staffMembership, staffLoading]);

  useEffect(() => {
    fetchSubscriptionData();
  }, [fetchSubscriptionData]);

  const checkSubscriptionStatus = useCallback(async () => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) {
        console.error('Error checking subscription:', error);
        return null;
      }
      await fetchSubscriptionData();
      return data;
    } catch (error) {
      console.error('Error checking subscription:', error);
      return null;
    }
  }, [user, fetchSubscriptionData]);

  const refreshRideCount = async () => {
    if (!user || !subscription) return;
    await fetchSubscriptionData();
  };

  // Create Stripe checkout session based on ride tier
  const createCheckout = async (tier: RideTier = 'starter') => {
    if (!user) throw new Error('User not authenticated');
    
    if (isTester) {
      console.log('[TESTER] Checkout blocked');
      return { blocked: true, reason: 'tester_account' };
    }

    const currentOrigin = window.location.origin;
    const returnUrl = currentOrigin.includes('localhost') || currentOrigin.includes('lovableproject.com')
      ? 'https://ride-ready-docs.lovable.app'
      : currentOrigin;
    
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { tier, returnUrl },
    });

    if (error) throw error;
    
    if (data?.url) {
      window.open(data.url, '_blank');
    }
    
    return data;
  };

  const openCustomerPortal = async () => {
    if (!user) throw new Error('User not authenticated');
    
    if (isTester) {
      console.log('[TESTER] Customer portal blocked');
      return { blocked: true, reason: 'tester_account' };
    }

    const currentOrigin = window.location.origin;
    const returnUrl = currentOrigin.includes('localhost') || currentOrigin.includes('lovableproject.com')
      ? 'https://ride-ready-docs.lovable.app'
      : currentOrigin;
    
    const { data, error } = await supabase.functions.invoke('customer-portal', {
      body: { returnUrl },
    });

    if (error) throw error;
    
    if (data?.url) {
      window.open(data.url, '_blank');
    }

    return data;
  };

  const upgradeSubscription = async (tier: RideTier = 'starter') => {
    if (isTester) {
      console.log('[TESTER] Upgrade blocked');
      return;
    }
    await createCheckout(tier);
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
