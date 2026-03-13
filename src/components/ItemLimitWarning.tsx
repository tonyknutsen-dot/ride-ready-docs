import { TrendingUp, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSubscription, RIDE_TIERS, getRideTier, getTierLabel, SELF_SERVE_MAX } from '@/hooks/useSubscription';
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
  if (subscriptionStatus !== 'active' && subscriptionStatus !== 'trial') return null;

  const currentTier = getRideTier(billableRideCount);
  const tierInfo = RIDE_TIERS[currentTier];
  
  // ── Over self-serve cap ──────────────────────────────────────────────
  if (billableRideCount >= SELF_SERVE_MAX) {
    return (
      <Alert className={`border-destructive/40 bg-destructive/5 ${className}`}>
        <ShieldAlert className="h-4 w-4 text-destructive" />
        <AlertTitle className="text-destructive">
          Plan limit reached
        </AlertTitle>
        <AlertDescription className="text-destructive/80">
          You have {billableRideCount} of {SELF_SERVE_MAX} items.
          Contact us for a larger operator plan.
        </AlertDescription>
      </Alert>
    );
  }

  // ── Business tier: near self-serve cap ────────────────────────────────
  if (currentTier === 'business') {
    const ridesUntilCap = SELF_SERVE_MAX - billableRideCount;
    if (ridesUntilCap <= 2 && ridesUntilCap > 0) {
      return (
        <Alert className={`border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 ${className}`}>
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800 dark:text-blue-200">
            {ridesUntilCap} {ridesUntilCap === 1 ? 'item' : 'items'} until plan limit
          </AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            You have {billableRideCount} of {SELF_SERVE_MAX} items in the {getTierLabel(currentTier)} tier (£{tierInfo.monthly}/mo). 
            Need more than {SELF_SERVE_MAX} items? Contact us for a larger operator plan.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  }
  
  const ridesUntilNextTier = tierInfo.max - billableRideCount;

  const nextTierKey = currentTier === 'starter' ? 'operator' : currentTier === 'operator' ? 'professional' : 'business';
  const nextTier = RIDE_TIERS[nextTierKey as keyof typeof RIDE_TIERS];

  // ── At tier limit (exactly 0 remaining) ──────────────────────────────
  if (ridesUntilNextTier <= 0) {
    return (
      <Alert className={`border-warning/40 bg-warning/5 ${className}`}>
        <ShieldAlert className="h-4 w-4 text-warning" />
        <AlertTitle className="text-warning">
          {getTierLabel(currentTier)} plan limit reached
        </AlertTitle>
        <AlertDescription className="text-warning/80 space-y-2">
          <p>
            You have reached the {tierInfo.max}-item limit for the {getTierLabel(currentTier)} plan (£{tierInfo.monthly}/mo).
            Adding more items will move you to the {getTierLabel(nextTierKey as any)} tier at £{nextTier.monthly}/mo.
          </p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => navigate('/plan-billing')}>
              Upgrade plan
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // ── Near tier limit (within 2) ───────────────────────────────────────
  if (ridesUntilNextTier > 2) return null;

  return (
    <Alert className={`border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 ${className}`}>
      <TrendingUp className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-800 dark:text-blue-200">
        {ridesUntilNextTier} {ridesUntilNextTier === 1 ? 'item' : 'items'} until {getTierLabel(nextTierKey as any)} tier
      </AlertTitle>
      <AlertDescription className="text-blue-700 dark:text-blue-300">
        You have {billableRideCount} of {tierInfo.max} items in the {getTierLabel(currentTier)} tier (£{tierInfo.monthly}/mo). 
        Adding more will move you to the {getTierLabel(nextTierKey as any)} tier at £{nextTier.monthly}/mo.
      </AlertDescription>
    </Alert>
  );
};
