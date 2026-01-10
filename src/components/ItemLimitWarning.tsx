import { AlertTriangle, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSubscription, PRICING } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface ItemLimitWarningProps {
  className?: string;
}

export const ItemLimitWarning = ({ className }: ItemLimitWarningProps) => {
  const { subscription } = useSubscription();
  const navigate = useNavigate();

  if (!subscription) return null;

  const { rideCount, rideLimit, subscriptionStatus } = subscription;
  const remaining = rideLimit - rideCount;
  const isAtLimit = rideCount >= rideLimit;
  const isNearLimit = remaining <= 2 && remaining > 0;
  const isOverLimit = rideCount > rideLimit;

  // Get the pricing info based on plan
  const planPricing = subscriptionStatus === 'advanced' ? PRICING.advanced : PRICING.basic;
  const additionalCost = PRICING.basic.additionalItemCost; // 75p per item

  // Calculate extra charges if over limit
  const extraItems = Math.max(0, rideCount - rideLimit);
  const extraCharge = (extraItems * additionalCost).toFixed(2);

  // Don't show anything if well under limit
  if (!isNearLimit && !isAtLimit && !isOverLimit) return null;

  // Over limit - show cost info
  if (isOverLimit) {
    return (
      <Alert className={`border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 ${className}`}>
        <TrendingUp className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">
          {extraItems} extra {extraItems === 1 ? 'item' : 'items'} added
        </AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300">
          <p className="mb-2">
            Your plan includes {rideLimit} items. You have {rideCount} items, so you're paying an additional{' '}
            <strong>£{extraCharge}/month</strong> (75p per extra item).
          </p>
          {subscriptionStatus !== 'advanced' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/billing')}
              className="mt-1 border-amber-600 text-amber-700 hover:bg-amber-100 dark:border-amber-400 dark:text-amber-300"
            >
              Upgrade for more included items
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // At limit
  if (isAtLimit) {
    return (
      <Alert className={`border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 ${className}`}>
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">
          Item limit reached
        </AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300">
          <p className="mb-2">
            You've used all {rideLimit} items included in your plan. Additional items cost{' '}
            <strong>75p/month each</strong>.
          </p>
          {subscriptionStatus !== 'advanced' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/billing')}
              className="mt-1 border-amber-600 text-amber-700 hover:bg-amber-100 dark:border-amber-400 dark:text-amber-300"
            >
              Upgrade for 10 included items
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Near limit (1-2 remaining)
  return (
    <Alert className={`border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 ${className}`}>
      <TrendingUp className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-800 dark:text-blue-200">
        {remaining} {remaining === 1 ? 'item' : 'items'} remaining
      </AlertTitle>
      <AlertDescription className="text-blue-700 dark:text-blue-300">
        You have {rideCount} of {rideLimit} included items. Additional items cost <strong>75p/month each</strong>.
        {subscriptionStatus !== 'advanced' && (
          <span> <Button variant="link" size="sm" onClick={() => navigate('/billing')} className="h-auto p-0 text-blue-700 dark:text-blue-300 underline">Upgrade</Button> for more included items.</span>
        )}
      </AlertDescription>
    </Alert>
  );
};
