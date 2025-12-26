import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Ride limits per plan
export const RIDE_LIMITS = {
  trial: 8,
  basic: 8,
  advanced: 8,
  // Additional rides beyond the limit require higher tier
  extended_basic: 20,
  extended_advanced: 20,
} as const;

export interface SubscriptionData {
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: 'trial' | 'basic' | 'advanced' | 'expired';
  subscriptionPlan: 'basic' | 'advanced' | null;
  daysRemaining: number;
  isTrialActive: boolean;
  isExpired: boolean;
  rideCount: number;
  rideLimit: number;
  canAddRide: boolean;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    const fetchSubscriptionData = async () => {
      try {
        // Fetch profile and ride count in parallel
        const [profileResult, rideCountResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('trial_started_at, trial_ends_at, subscription_status, subscription_plan')
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

          const status = data.subscription_status as SubscriptionData['subscriptionStatus'];
          const rideLimit = RIDE_LIMITS[status] || RIDE_LIMITS.basic;

          const subscriptionData: SubscriptionData = {
            trialStartedAt: data.trial_started_at,
            trialEndsAt: data.trial_ends_at,
            subscriptionStatus: status,
            subscriptionPlan: data.subscription_plan as SubscriptionData['subscriptionPlan'],
            daysRemaining,
            isTrialActive: data.subscription_status === 'trial' && daysRemaining > 0,
            isExpired: data.subscription_status === 'expired' || (data.subscription_status === 'trial' && daysRemaining === 0),
            rideCount,
            rideLimit,
            canAddRide: rideCount < rideLimit,
          };

          setSubscription(subscriptionData);
        }
      } catch (error) {
        console.error('Error fetching subscription data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionData();
  }, [user]);

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

  const upgradeSubscription = async (plan: 'basic' | 'advanced') => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_status: plan,
          subscription_plan: plan
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Refresh subscription data
      const [profileResult, rideCountResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('trial_started_at, trial_ends_at, subscription_status, subscription_plan')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('rides')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
      ]);

      const data = profileResult.data;
      const rideCount = rideCountResult.count || 0;

      if (data) {
        const now = new Date();
        const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
        const daysRemaining = trialEndsAt 
          ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        const status = data.subscription_status as SubscriptionData['subscriptionStatus'];
        const rideLimit = RIDE_LIMITS[status] || RIDE_LIMITS.basic;

        setSubscription({
          trialStartedAt: data.trial_started_at,
          trialEndsAt: data.trial_ends_at,
          subscriptionStatus: status,
          subscriptionPlan: data.subscription_plan as SubscriptionData['subscriptionPlan'],
          daysRemaining,
          isTrialActive: data.subscription_status === 'trial' && daysRemaining > 0,
          isExpired: data.subscription_status === 'expired' || (data.subscription_status === 'trial' && daysRemaining === 0),
          rideCount,
          rideLimit,
          canAddRide: rideCount < rideLimit,
        });
      }
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      throw error;
    }
  };

  return {
    subscription,
    loading,
    upgradeSubscription,
    refreshRideCount,
  };
};