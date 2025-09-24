import { AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';

interface TrialStatusProps {
  onUpgrade?: () => void;
}

export const TrialStatus: React.FC<TrialStatusProps> = ({ onUpgrade }) => {
  const { subscription, loading } = useSubscription();

  if (loading || !subscription) return null;

  const { isTrialActive, isExpired, daysRemaining, subscriptionStatus, subscriptionPlan } = subscription;

  if (subscriptionStatus === 'basic' || subscriptionStatus === 'advanced') {
    return (
      <Card className="mb-6 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="capitalize">
              {subscriptionPlan} Plan
            </Badge>
            <span className="text-sm text-muted-foreground">
              Active subscription
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isExpired) {
    return (
      <Card className="mb-6 border-destructive/50 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">Trial Expired</p>
                <p className="text-sm text-muted-foreground">
                  Your free trial has ended. Upgrade to continue using all features.
                </p>
              </div>
            </div>
            <Button onClick={onUpgrade} variant="destructive">
              Upgrade Now
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isTrialActive) {
    const isLowTime = daysRemaining <= 7;
    
    return (
      <Card className={`mb-6 ${isLowTime ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-primary/20'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className={`h-5 w-5 ${isLowTime ? 'text-yellow-600' : 'text-primary'}`} />
              <div>
                <p className="font-semibold">
                  Free Trial - {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                </p>
                <p className="text-sm text-muted-foreground">
                  You have access to basic file storage during your trial period.
                </p>
              </div>
            </div>
            <Button onClick={onUpgrade} variant={isLowTime ? "default" : "outline"}>
              Choose Plan
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};