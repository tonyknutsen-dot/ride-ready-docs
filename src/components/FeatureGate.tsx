import { ReactNode } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradePrompt } from './UpgradePrompt';

interface FeatureGateProps {
  children: ReactNode;
  requiredPlan: 'basic' | 'advanced';
  feature: string;
  fallback?: ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ 
  children, 
  requiredPlan, 
  feature,
  fallback 
}) => {
  const { subscription, loading } = useSubscription();

  if (loading) {
    return <div className="animate-pulse bg-muted rounded-lg p-8" />;
  }

  if (!subscription) {
    return fallback || <UpgradePrompt feature={feature} requiredPlan={requiredPlan} />;
  }

  const { subscriptionStatus, isTrialActive } = subscription;

  // During trial, allow basic features only
  if (isTrialActive && requiredPlan === 'basic') {
    return <>{children}</>;
  }

  // Check if user has required plan
  const hasAccess = 
    subscriptionStatus === requiredPlan || 
    (requiredPlan === 'basic' && subscriptionStatus === 'advanced');

  if (!hasAccess) {
    return fallback || <UpgradePrompt feature={feature} requiredPlan={requiredPlan} />;
  }

  return <>{children}</>;
};