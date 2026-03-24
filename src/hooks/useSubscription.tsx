import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTester } from '@/contexts/TesterContext';
import { useStaff } from '@/contexts/StaffContext';
import { supabase } from '@/integrations/supabase/client';

// Re-export everything from the centralised config so existing imports keep working
export {
  RIDE_TIERS,
  STRIPE_PRICE_IDS,
  STRIPE_PRODUCT_IDS,
  SELF_SERVE_MAX,
  getRideTier,
  getTierPrice,
  getTierLabel,
  getTierForRideCount,
  exceedsSelfServe,
} from '@/config/stripePricing';
export type { RideTier } from '@/config/stripePricing';

import {
  RIDE_TIERS,
  SELF_SERVE_MAX,
  getRideTier,
  getTierLabel,
  getTierPrice,
  exceedsSelfServe,
  type RideTier,
} from '@/config/stripePricing';

export interface SubscriptionData {
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'tester' | 'past_due';
  subscriptionPlan: string | null;
  billingCycle: 'monthly' | null;
  daysRemaining: number;
  isTrialActive: boolean;
  isExpired: boolean;
  rideCount: number;
  billableRideCount: number;
  freeAssetCount: number;
  rideLimit: number;
  canAddRide: boolean;
  /** @deprecated Legacy field — no longer used in tier-based billing */
  extraItemsCount: number;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
  hasStripeSubscription: boolean;
  isTesterAccount: boolean;
  isStaffMember: boolean;
  currentTier: RideTier;
  tierLabel: string;
  tierPrice: number;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  wasPaidCustomer: boolean;
  pendingSubscriptionPlan: string | null;
  pendingChangeEffectiveDate: string | null;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const { isTester, isLoading: testerLoading } = useTester();
  const { isStaff, staffMembership, loading: staffLoading } = useStaff();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  // Guard: track which user+role combo we've fetched for to prevent redundant fetches
  const [fetchedKey, setFetchedKey] = useState<string | null>(null);

  const fetchSubscriptionData = useCallback(async (force = false) => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      setFetchedKey(null);
      return;
    }

    if (testerLoading || staffLoading) {
      return;
    }

    // Build a stable key from the values that actually matter
    const key = `${user.id}:${isTester}:${isStaff}:${staffMembership?.ownerId ?? ''}`;
    if (!force && fetchedKey === key) {
      return;
    }

    try {
      const profileUserId = isStaff && staffMembership?.ownerId 
        ? staffMembership.ownerId 
        : user.id;

      // Fetch profile, total item count, and billable item count in parallel
      const [profileResult, totalRideResult, billableRideResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('trial_started_at, trial_ends_at, subscription_status, subscription_plan, billing_cycle, current_period_end, cancel_at_period_end, cancel_at, stripe_customer_id, pending_subscription_plan, pending_change_effective_date')
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
            cancelAtPeriodEnd: false,
            cancelAt: null,
            wasPaidCustomer: false,
            pendingSubscriptionPlan: null,
            pendingChangeEffectiveDate: null,
          };
          setSubscription(testerSubscription);
          setLoading(false);
          return;
        }

        // Map old basic/advanced status to appropriate states
        // past_due is now treated as a distinct restricted state
        let status = data.subscription_status as string;
        let mappedStatus: SubscriptionData['subscriptionStatus'];
        if (status === 'basic' || status === 'advanced' || status === 'active') {
          mappedStatus = 'active';
        } else if (status === 'past_due') {
          mappedStatus = 'past_due';
        } else if (status === 'trial') {
          mappedStatus = daysRemaining > 0 ? 'trial' : 'expired';
        } else {
          mappedStatus = 'expired';
        }

        // For active/past_due subscribers, use the plan stored by check-subscription (matches Stripe).
        // For trial/expired users, calculate from ride count.
        const stripeTier = data.subscription_plan as RideTier | null;
        const currentTier = (mappedStatus === 'active' || mappedStatus === 'past_due') && stripeTier && RIDE_TIERS[stripeTier]
          ? stripeTier
          : getRideTier(billableRideCount);

        const subscriptionData: SubscriptionData = {
          trialStartedAt: data.trial_started_at,
          trialEndsAt: data.trial_ends_at,
          subscriptionStatus: mappedStatus,
          subscriptionPlan: data.subscription_plan,
          billingCycle: data.billing_cycle === 'monthly' ? 'monthly' : null,
          daysRemaining,
          isTrialActive: mappedStatus === 'trial' && daysRemaining > 0,
          isExpired: mappedStatus === 'expired',
          rideCount: totalRideCount,
          billableRideCount,
          freeAssetCount,
          rideLimit: RIDE_TIERS[currentTier].max,
          canAddRide: mappedStatus === 'trial' || (mappedStatus === 'active' && billableRideCount < RIDE_TIERS[currentTier].max),
          extraItemsCount: 0,
          currentPeriodEnd: data.current_period_end,
          hasStripeCustomer: mappedStatus === 'active' || mappedStatus === 'past_due',
          hasStripeSubscription: mappedStatus === 'active' || mappedStatus === 'past_due',
          isTesterAccount: false,
          isStaffMember: isStaff,
          currentTier,
          tierLabel: getTierLabel(currentTier),
          tierPrice: getTierPrice(currentTier),
          cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
          cancelAt: data.cancel_at ?? null,
          wasPaidCustomer: !!data.stripe_customer_id,
          pendingSubscriptionPlan: data.pending_subscription_plan ?? null,
          pendingChangeEffectiveDate: data.pending_change_effective_date ?? null,
        };

        setSubscription(subscriptionData);
      }
    } finally {
      setFetchedKey(`${user.id}:${isTester}:${isStaff}:${staffMembership?.ownerId ?? ''}`);
      setLoading(false);
    }
  }, [user?.id, isTester, testerLoading, isStaff, staffMembership?.ownerId, staffLoading, fetchedKey]);

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
      await fetchSubscriptionData(true);
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

  const isLovablePreviewHost = (hostname: string) => hostname === 'lovable.app' || hostname.endsWith('.lovable.app');

  const getPreviewWrapperUrl = (): URL | null => {
    if (window.self === window.top) return null;

    try {
      const referrerUrl = new URL(document.referrer);
      if (!isLovablePreviewHost(referrerUrl.hostname)) {
        return null;
      }

      // Keep the preview shell host so return lands in the same preview context.
      return referrerUrl;
    } catch {
      return null;
    }
  };

  const getBillingReturnUrl = () => {
    const currentUrl = new URL(window.location.href);
    const previewWrapperUrl = getPreviewWrapperUrl();
    const baseUrl = previewWrapperUrl ?? currentUrl;

    const billingUrl = new URL(baseUrl.toString());
    billingUrl.pathname = '/billing';
    billingUrl.hash = '';
    billingUrl.search = '';

    const previewToken = currentUrl.searchParams.get('__lovable_token')
      ?? previewWrapperUrl?.searchParams.get('__lovable_token')
      ?? null;

    if (previewToken) {
      billingUrl.searchParams.set('__lovable_token', previewToken);
    }

    console.info('[Subscription] Resolved Stripe billing return URL', {
      returnUrl: billingUrl.toString(),
      usedPreviewWrapper: Boolean(previewWrapperUrl),
      currentHost: currentUrl.hostname,
      referrerHost: previewWrapperUrl?.hostname ?? null,
    });

    return billingUrl.toString();
  };

  const navigateToStripeUrl = (rawUrl: string) => {
    let safeUrl: string;

    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:') {
        throw new Error('invalid_protocol');
      }
      safeUrl = parsed.toString();
    } catch {
      throw new Error('Invalid Stripe redirect URL');
    }

    // In Lovable preview (embedded iframe), navigating current frame to Stripe can render a grey blocked page.
    // Force top-level navigation first, then fall back to opening a new tab.
    if (window.self !== window.top) {
      try {
        if (window.top) {
          window.top.location.href = safeUrl;
          return;
        }
      } catch (navigationError) {
        console.warn('Top-level Stripe navigation failed; falling back to new tab', navigationError);
      }

      const popup = window.open(safeUrl, '_blank', 'noopener,noreferrer');
      if (popup) return;

      throw new Error('Unable to open Stripe. Please allow pop-ups and try again.');
    }

    window.location.href = safeUrl;
  };

  // Create Stripe checkout session based on ride tier
  const createCheckout = async (tier: RideTier = 'starter') => {
    if (!user) throw new Error('User not authenticated');
    
    if (isTester) {
      console.log('[TESTER] Checkout blocked');
      return { blocked: true, reason: 'tester_account' };
    }

    // Refresh session to ensure the JWT is fresh before calling Stripe
    await supabase.auth.refreshSession();

    const returnUrl = getBillingReturnUrl();
    
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { tier, returnUrl },
    });

    if (error) throw error;

    if (!data?.url || typeof data.url !== 'string') {
      throw new Error('Checkout URL was not returned by Stripe');
    }

    navigateToStripeUrl(data.url);
    return data;
  };

  const openCustomerPortal = async () => {
    if (!user) throw new Error('User not authenticated');
    
    if (isTester) {
      console.log('[TESTER] Customer portal blocked');
      return { blocked: true, reason: 'tester_account' };
    }

    // Refresh session to ensure the JWT is fresh before calling Stripe
    await supabase.auth.refreshSession();

    const returnUrl = getBillingReturnUrl();
    
    const { data, error } = await supabase.functions.invoke('customer-portal', {
      body: { returnUrl },
    });

    if (error) throw error;

    if (!data?.url || typeof data.url !== 'string') {
      throw new Error('Customer portal URL was not returned by Stripe');
    }

    navigateToStripeUrl(data.url);
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
