import { AlertTriangle, Clock, FlaskConical, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription, getTierLabel } from '@/hooks/useSubscription';
import { useStaff } from '@/contexts/StaffContext';

interface TrialStatusProps {
  onUpgrade?: () => void;
}

export const TrialStatus: React.FC<TrialStatusProps> = ({ onUpgrade }) => {
  const { subscription, loading, openCustomerPortal } = useSubscription();
  const { canAccessBilling } = useStaff();

  if (loading || !subscription) return null;
  const { isTrialActive, isExpired, daysRemaining, subscriptionStatus, isTesterAccount, currentTier, billableRideCount } = subscription;

  // TESTER BYPASS
  if (isTesterAccount) {
    return (
      <Card className="mb-4 md:mb-6 border-warning/50 bg-warning/5">
        <CardContent className="p-3 md:p-4">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-5 w-5 text-warning flex-shrink-0" />
            <div>
              <Badge variant="outline" className="border-warning text-warning">
                Tester Account
              </Badge>
              <span className="text-sm text-muted-foreground ml-2">
                All features unlocked
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // PAST DUE — payment failed, read-only mode
  if (subscriptionStatus === 'past_due') {
    return (
      <Card className="mb-4 md:mb-6 border-destructive/50 bg-destructive/5">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-destructive">Payment Failed</p>
                <p className="text-sm text-muted-foreground">
                  Please update your billing to continue using RideReadyDocs. Your data is safe; you can still view it.
                </p>
              </div>
            </div>
            {canAccessBilling ? (
              <Button
                onClick={() => openCustomerPortal()}
                variant="destructive"
                size="sm"
                className="flex-shrink-0 self-start sm:self-center"
              >
                Manage Billing
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground flex-shrink-0 self-start sm:self-center">
                Ask your Controller to update payment details.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (subscriptionStatus === 'active') {
    return (
      <Card className="mb-4 md:mb-6 border-primary/20">
        <CardContent className="p-3 md:p-4">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="capitalize flex-shrink-0">
              {getTierLabel(currentTier)} Plan
            </Badge>
            <span className="text-sm text-muted-foreground truncate">
              Managing {billableRideCount} {billableRideCount === 1 ? 'ride' : 'rides'}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isExpired) {
    return (
      <Card className="mb-4 md:mb-6 border-destructive/50 bg-destructive/5">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-destructive">Trial Expired</p>
                <p className="text-sm text-muted-foreground">
                  Your free trial has ended. Subscribe to continue using all features.
                </p>
              </div>
            </div>
            {canAccessBilling ? (
              <Button onClick={onUpgrade} variant="destructive" size="sm" className="flex-shrink-0 self-start sm:self-center">
                Subscribe Now
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground flex-shrink-0 self-start sm:self-center">
                Ask your Controller to manage the subscription.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isTrialActive) {
    const isLowTime = daysRemaining <= 7;
    
    return (
      <Card className={`mb-4 md:mb-6 ${isLowTime ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-primary/20'}`}>
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <Clock className={`h-5 w-5 ${isLowTime ? 'text-yellow-600' : 'text-primary'} flex-shrink-0 mt-0.5`} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  Free Trial — {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                </p>
                <p className="text-sm text-muted-foreground">
                  Full access to all compliance and operations features.
                </p>
              </div>
            </div>
            {canAccessBilling ? (
              <Button onClick={onUpgrade} variant={isLowTime ? "default" : "outline"} size="sm" className="flex-shrink-0 self-start sm:self-center">
                Choose Plan
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground flex-shrink-0 self-start sm:self-center">
                Ask your Controller to manage the subscription.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};
