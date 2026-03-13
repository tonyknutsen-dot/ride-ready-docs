import { useState } from 'react';
import { Check, Loader2, ExternalLink, FlaskConical, Unlock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription, RIDE_TIERS, getRideTier, getTierLabel, SELF_SERVE_MAX, type RideTier } from '@/hooks/useSubscription';
import { useTester } from '@/contexts/TesterContext';
import { toast } from 'sonner';
import { StripeInstructionModal } from '@/components/StripeInstructionModal';

interface PlanSelectionProps {
  onClose?: () => void;
}

const allFeatures = [
  'Document storage & organisation',
  'Expiry alerts (30 & 7 days)',
  'Insurance & safety certificates',
  'Declaration of Compliance (DOC)',
  'Pre-use, daily, weekly, monthly & yearly checks',
  'Inspection scheduling & reminders',
  'NDT testing management',
  'Maintenance log & history',
  'Calendar dashboard',
  'Risk assessment builder',
  'Compliance reports & analytics',
  'Priority support',
];

const tiers: { key: RideTier; rides: string }[] = [
  { key: 'starter', rides: '1–5 items' },
  { key: 'operator', rides: '6–12 items' },
  { key: 'professional', rides: '13–25 items' },
  { key: 'business', rides: '26–50 items' },
];

export const PlanSelection: React.FC<PlanSelectionProps> = ({ onClose }) => {
  const { subscription, createCheckout, openCustomerPortal } = useSubscription();
  const { isTester } = useTester();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [isPortalAction, setIsPortalAction] = useState(false);

  if (isTester) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
            <FlaskConical className="h-8 w-8 text-warning" />
          </div>
          <h2 className="text-2xl font-bold">Tester Account</h2>
          <p className="text-muted-foreground mt-2">Full access without billing.</p>
        </div>
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-warning mb-2">
              <Unlock className="h-5 w-5" />
              <span className="font-semibold">All Features Unlocked</span>
            </div>
          </CardContent>
        </Card>
        <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
      </div>
    );
  }

  const hasActiveSubscription = subscription?.hasStripeSubscription && subscription?.subscriptionStatus === 'active';
  const currentTier = subscription?.currentTier;

  const handleSelectTier = () => {
    if (loadingTier) return;
    setIsPortalAction(!!hasActiveSubscription);
    setShowStripeModal(true);
  };

  const handleContinueToStripe = async () => {
    setLoadingTier('active');
    try {
      if (hasActiveSubscription) {
        await openCustomerPortal();
      } else {
        await createCheckout(currentTier || 'starter');
      }
      setShowStripeModal(false);
      onClose?.();
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to process request. Please try again.');
      setShowStripeModal(false);
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">
          {hasActiveSubscription ? 'Manage Your Plan' : 'Choose Your Plan'}
        </h2>
        <p className="text-muted-foreground mt-2">
          All-in-one compliance & operations system — priced by number of rides
        </p>
      </div>

      {/* Pricing Table */}
      <Card>
        <CardHeader>
          <CardTitle>Ride-Based Pricing</CardTitle>
          <CardDescription>Your plan adjusts automatically based on ride count</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {tiers.map(({ key, rides }) => {
              const tier = RIDE_TIERS[key];
              const isCurrent = hasActiveSubscription && currentTier === key;
              return (
                <div key={key} className={`flex items-center justify-between py-3 ${isCurrent ? 'bg-primary/5 -mx-4 px-4 rounded-lg' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {getTierLabel(key)}
                        {isCurrent && <Badge className="text-xs">Current</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">{rides}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-lg">£{tier.monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Everything Included</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {allFeatures.map((feature, i) => (
              <li key={i} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        Each registered item counts toward your plan allowance. Stalls, kiosks & generators included free.
      </p>

      <p className="text-xs text-center text-muted-foreground">
        Need more than {SELF_SERVE_MAX} items? Contact us for a larger operator plan.
      </p>

      {!hasActiveSubscription && subscription && subscription.billableRideCount > 0 && (
        <p className="text-sm text-center text-muted-foreground bg-muted/50 rounded-lg p-3">
          You currently have <strong>{subscription.billableRideCount} billable ride{subscription.billableRideCount !== 1 ? 's' : ''}</strong>, 
          so you'll be subscribed to the <strong>{subscription.tierLabel}</strong> tier (£{subscription.tierPrice.toFixed(2)}/mo).
        </p>
      )}

      <Button className="w-full" size="lg" onClick={handleSelectTier} disabled={!!loadingTier}>
        {loadingTier ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
        ) : hasActiveSubscription ? (
          <>Manage Subscription <ExternalLink className="ml-2 h-3 w-3" /></>
        ) : (
          'Subscribe Now'
        )}
      </Button>

      {subscription?.isTrialActive && (
        <div className="text-center text-sm text-muted-foreground">
          Continue your free trial or subscribe now for uninterrupted access.
        </div>
      )}

      <StripeInstructionModal
        open={showStripeModal}
        onClose={() => setShowStripeModal(false)}
        onContinue={handleContinueToStripe}
        isPortal={isPortalAction}
        loading={!!loadingTier}
      />
    </div>
  );
};
