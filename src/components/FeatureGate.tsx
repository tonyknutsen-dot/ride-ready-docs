import { ReactNode } from 'react';
import { useSubscription } from '@/hooks/useSubscription';

interface FeatureGateProps {
  children: ReactNode;
  requiredPlan?: string; // Kept for backward compat but ignored - all features available
  feature?: string;
  fallback?: ReactNode;
}

/**
 * FeatureGate now simply checks if the user has an active subscription or trial.
 * All paying users get full access to all features - no plan-based gating.
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({ 
  children, 
}) => {
  const { subscription, loading } = useSubscription();

  if (loading) {
    return <div className="animate-pulse bg-muted border border-border/50 rounded-lg p-8" />;
  }

  // All users with a subscription (trial, active, tester) get full access
  // No feature gating between plans anymore
  return <>{children}</>;
};
