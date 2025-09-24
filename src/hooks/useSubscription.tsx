import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionData {
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  subscriptionStatus: 'trial' | 'basic' | 'advanced' | 'expired';
  subscriptionPlan: 'basic' | 'advanced' | null;
  daysRemaining: number;
  isTrialActive: boolean;
  isExpired: boolean;
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
        const { data, error } = await supabase
          .from('profiles')
          .select('trial_started_at, trial_ends_at, subscription_status, subscription_plan')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching subscription data:', error);
          return;
        }

        if (data) {
          const now = new Date();
          const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
          const daysRemaining = trialEndsAt 
            ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

          const subscriptionData: SubscriptionData = {
            trialStartedAt: data.trial_started_at,
            trialEndsAt: data.trial_ends_at,
            subscriptionStatus: data.subscription_status as SubscriptionData['subscriptionStatus'],
            subscriptionPlan: data.subscription_plan as SubscriptionData['subscriptionPlan'],
            daysRemaining,
            isTrialActive: data.subscription_status === 'trial' && daysRemaining > 0,
            isExpired: data.subscription_status === 'expired' || (data.subscription_status === 'trial' && daysRemaining === 0)
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
      const { data } = await supabase
        .from('profiles')
        .select('trial_started_at, trial_ends_at, subscription_status, subscription_plan')
        .eq('user_id', user.id)
        .single();

      if (data) {
        const now = new Date();
        const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
        const daysRemaining = trialEndsAt 
          ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        setSubscription({
          trialStartedAt: data.trial_started_at,
          trialEndsAt: data.trial_ends_at,
          subscriptionStatus: data.subscription_status as SubscriptionData['subscriptionStatus'],
          subscriptionPlan: data.subscription_plan as SubscriptionData['subscriptionPlan'],
          daysRemaining,
          isTrialActive: data.subscription_status === 'trial' && daysRemaining > 0,
          isExpired: data.subscription_status === 'expired' || (data.subscription_status === 'trial' && daysRemaining === 0)
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
    upgradeSubscription
  };
};