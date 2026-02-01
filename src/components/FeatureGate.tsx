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
    return <div className="animate-pulse bg-muted border border-border/50 rounded-lg p-8" />;
  }

  if (!subscription) {
    return fallback || <UpgradePrompt feature={feature} requiredPlan={requiredPlan} />;
  }

  const { subscriptionStatus, isTrialActive, isTesterAccount, isStaffMember } = subscription;

  // TESTER BYPASS: Grant full access to all features
  if (isTesterAccount) {
    return <>{children}</>;
  }

  // STAFF: Check if owner has access - if yes, grant access; if no, show disabled prompt
  if (isStaffMember) {
    const hasAccess = 
      subscriptionStatus === requiredPlan || 
      (requiredPlan === 'basic' && subscriptionStatus === 'advanced');
    
    if (hasAccess) {
      return <>{children}</>;
    }
    // Staff doesn't have access - show the fallback if provided, otherwise show disabled upgrade prompt
    // UpgradePrompt will detect isStaff and show a disabled version
    return fallback || <UpgradePrompt feature={feature} requiredPlan={requiredPlan} />;
  }

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