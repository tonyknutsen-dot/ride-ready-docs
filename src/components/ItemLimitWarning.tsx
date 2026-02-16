import { TrendingUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSubscription, RIDE_TIERS, getRideTier, getTierLabel } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface ItemLimitWarningProps {
  className?: string;
}

export const ItemLimitWarning = ({ className }: ItemLimitWarningProps) => {
  const { subscription } = useSubscription();
  const navigate = useNavigate();

  if (!subscription) return null;

  const { billableRideCount, subscriptionStatus, isTesterAccount, isStaffMember } = subscription;
  
  if (isTesterAccount || isStaffMember) return null;
  if (subscriptionStatus !== 'active') return null;

  const currentTier = getRideTier(billableRideCount);
  const tierInfo = RIDE_TIERS[currentTier];
  
  // Check if nearing tier boundary (within 1 ride of next tier)
  if (currentTier === 'enterprise') return null; // Already at highest tier
  
  const ridesUntilNextTier = tierInfo.max - billableRideCount;
  
  if (ridesUntilNextTier > 2) return null; // Not near limit

  const nextTierKey = currentTier === 'starter' ? 'operator' : currentTier === 'operator' ? 'professional' : 'enterprise';
  const nextTier = RIDE_TIERS[nextTierKey as keyof typeof RIDE_TIERS];

  if (ridesUntilNextTier <= 0) {
    // Already crossed into next tier
    return null; // Billing adjusts automatically
  }

  return (
    <Alert className={`border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 ${className}`}>
      <TrendingUp className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-800 dark:text-blue-200">
        {ridesUntilNextTier} {ridesUntilNextTier === 1 ? 'ride' : 'rides'} until {getTierLabel(nextTierKey as any)} tier
      </AlertTitle>
      <AlertDescription className="text-blue-700 dark:text-blue-300">
        You have {billableRideCount} of {tierInfo.max} rides in the {getTierLabel(currentTier)} tier (£{tierInfo.monthly}/mo). 
        Adding more will move you to the {getTierLabel(nextTierKey as any)} tier at £{nextTier.monthly}/mo.
      </AlertDescription>
    </Alert>
  );
};
