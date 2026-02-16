import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RIDE_TIERS, getRideTier, getTierLabel, getTierPrice } from "@/hooks/useSubscription";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";

interface ExtraItemChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  currentCount: number;
  limit: number;
  billingCycle: 'monthly' | 'yearly';
}

export const ExtraItemChargeDialog = ({
  open,
  onOpenChange,
  onConfirm,
  currentCount,
  limit,
  billingCycle,
}: ExtraItemChargeDialogProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const currentTier = getRideTier(currentCount);
  const newTier = getRideTier(currentCount + 1);
  const tierChanging = currentTier !== newTier;
  const currentPrice = getTierPrice(currentTier);
  const newPrice = getTierPrice(newTier);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-warning/20 rounded-full">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <AlertDialogTitle>
              {tierChanging ? 'Plan Tier Change' : 'Add Equipment'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              <p>
                You currently have <strong>{currentCount} billable rides</strong> on the{" "}
                <strong>{getTierLabel(currentTier)}</strong> tier.
              </p>
              
              {tierChanging ? (
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Current tier ({getTierLabel(currentTier)}):</span>
                    <span>£{currentPrice.toFixed(2)}/month</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium text-warning">
                    <span>New tier ({getTierLabel(newTier)}):</span>
                    <span>£{newPrice.toFixed(2)}/month</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <p className="text-sm text-muted-foreground">
                      Adding this ride will move you to the {getTierLabel(newTier)} tier. Your billing will adjust automatically.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    This ride fits within your current {getTierLabel(currentTier)} tier (up to {RIDE_TIERS[currentTier].max} rides). No pricing change.
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              tierChanging ? `Add Ride (moves to ${getTierLabel(newTier)})` : 'Add Ride'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
