import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ContactSupportDialog } from '@/components/ContactSupportDialog';
import { RIDE_TIERS, SELF_SERVE_MAX, getRideTier, getTierLabel, type RideTier } from '@/config/stripePricing';
import { ShieldAlert, ArrowUpRight, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type ThresholdType = 'tier_upgrade' | 'self_serve_cap';

interface TierUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBillableCount: number;
  currentTierLabel: string;
  organisationName?: string;
  userEmail?: string;
}

/**
 * Determines if adding one more billable item would cross a pricing tier boundary.
 * Returns null if no boundary is crossed.
 */
export function getTierCrossing(billableCount: number): {
  type: ThresholdType;
  fromTier: RideTier;
  toTier: RideTier | null;
  fromMax: number;
} | null {
  const currentTier = getRideTier(billableCount);
  const nextTier = getRideTier(billableCount + 1);

  // Crossing self-serve cap (50 → 51)
  if (billableCount >= SELF_SERVE_MAX) {
    return { type: 'self_serve_cap', fromTier: currentTier, toTier: null, fromMax: SELF_SERVE_MAX };
  }

  // Crossing a tier boundary
  if (currentTier !== nextTier) {
    return { type: 'tier_upgrade', fromTier: currentTier, toTier: nextTier, fromMax: RIDE_TIERS[currentTier].max };
  }

  return null;
}

export const TierUpgradeDialog = ({
  open,
  onOpenChange,
  currentBillableCount,
  currentTierLabel,
  organisationName,
  userEmail,
}: TierUpgradeDialogProps) => {
  const navigate = useNavigate();
  const [showSupport, setShowSupport] = useState(false);

  const crossing = getTierCrossing(currentBillableCount);
  if (!crossing) return null;

  const isSelfServeCap = crossing.type === 'self_serve_cap';
  const fromTier = crossing.fromTier;
  const toTier = crossing.toTier;
  const fromInfo = RIDE_TIERS[fromTier];
  const toInfo = toTier ? RIDE_TIERS[toTier] : null;

  const handleUpgrade = () => {
    onOpenChange(false);
    // Store return path so user can come back after upgrading
    sessionStorage.setItem('upgrade_return_path', window.location.pathname);
    navigate('/plan-billing');
  };

  const handleContactSupport = () => {
    onOpenChange(false);
    setShowSupport(true);
  };

  const prefillSubject = isSelfServeCap
    ? 'Larger operator plan request'
    : `Plan upgrade enquiry — ${getTierLabel(fromTier)} to ${toTier ? getTierLabel(toTier) : 'next tier'}`;
  const prefillMessage = [
    isSelfServeCap
      ? `We need support for more than ${SELF_SERVE_MAX} registered items.`
      : `Enquiry about upgrading from ${getTierLabel(fromTier)} to ${toTier ? getTierLabel(toTier) : 'next'} tier.`,
    `Current plan: ${currentTierLabel}`,
    `Current item count: ${currentBillableCount}`,
    organisationName ? `Organisation: ${organisationName}` : null,
    userEmail ? `Email: ${userEmail}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-full ${isSelfServeCap ? 'bg-destructive/15' : 'bg-primary/15'}`}>
                <ShieldAlert className={`h-5 w-5 ${isSelfServeCap ? 'text-destructive' : 'text-primary'}`} />
              </div>
              <AlertDialogTitle>
                {isSelfServeCap ? "You've reached your plan limit" : 'Plan upgrade required'}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                {isSelfServeCap ? (
                  <>
                    <p>
                      You've reached the maximum of {SELF_SERVE_MAX} items included in self-serve plans.
                    </p>
                    <p>
                      Contact us and we'll help you move onto a larger operator plan.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Your current {getTierLabel(fromTier)} plan allows up to {fromInfo.max} items.
                      Adding this item will move you to the {toTier ? getTierLabel(toTier) : 'next'} tier.
                    </p>
                  </>
                )}
                <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current plan</span>
                    <span className="font-medium">{getTierLabel(fromTier)} — £{fromInfo.monthly}/mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Registered items</span>
                    <span className="font-medium">{currentBillableCount} / {fromInfo.max}</span>
                  </div>
                  {toInfo && (
                    <div className="flex justify-between border-t border-border pt-1 mt-1">
                      <span className="text-muted-foreground">New plan</span>
                      <span className="font-medium text-primary">{getTierLabel(toTier!)} — £{toInfo.monthly}/mo</span>
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {!isSelfServeCap && (
              <Button onClick={handleUpgrade}>
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Upgrade now
              </Button>
            )}
            <Button variant={isSelfServeCap ? 'default' : 'secondary'} onClick={handleContactSupport}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Contact support
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ContactSupportDialog
        open={showSupport}
        onOpenChange={setShowSupport}
        defaultSubject={prefillSubject}
        defaultMessage={prefillMessage}
        defaultPriority="normal"
      />
    </>
  );
};
