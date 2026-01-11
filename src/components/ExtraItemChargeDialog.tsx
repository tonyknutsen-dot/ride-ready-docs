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
import { PRICING } from "@/hooks/useSubscription";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";

interface ExtraItemChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  currentCount: number;
  limit: number;
  plan: 'basic' | 'advanced' | 'trial' | 'expired';
  billingCycle: 'monthly' | 'yearly';
}

export const ExtraItemChargeDialog = ({
  open,
  onOpenChange,
  onConfirm,
  currentCount,
  limit,
  plan,
  billingCycle,
}: ExtraItemChargeDialogProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const additionalItemCost = PRICING.basic.additionalItemCost; // 75p per month
  const currentExtraItems = Math.max(0, currentCount - limit);
  const newExtraItems = currentExtraItems + 1;
  
  const isYearly = billingCycle === 'yearly';
  
  // For yearly billing, we'll calculate based on remaining months (edge function does exact calc)
  // Show approximate: remaining months × £0.75
  const approximateYearlyCharge = isYearly ? 'prorated' : null;
  const monthlyCharge = additionalItemCost;
  
  // Get base price based on plan
  const basePlan = plan === 'advanced' ? PRICING.advanced : PRICING.basic;
  const basePrice = basePlan.monthly;

  const chargeLabel = isYearly ? '(prorated)' : '/month';
  const chargeDescription = isYearly 
    ? 'You\'ll be charged a prorated amount based on your remaining subscription period. This will be calculated and charged immediately.'
    : 'This will be added to your subscription and charged with your next bill.';

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
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <AlertDialogTitle>Additional Item Charge</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              <p>
                Your plan includes <strong>{limit} items</strong>. You currently have{" "}
                <strong>{currentCount} items</strong>.
              </p>
              
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Base plan cost:</span>
                  <span>£{basePrice.toFixed(2)}/month</span>
                </div>
                {currentExtraItems > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Current extra items ({currentExtraItems}):</span>
                    <span>£{(currentExtraItems * additionalItemCost).toFixed(2)}/month</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium text-amber-700 dark:text-amber-400">
                  <span>+ New item charge:</span>
                  <span>+£{monthlyCharge.toFixed(2)}{isYearly ? ' × remaining months' : '/month'}</span>
                </div>
                {!isYearly && (
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>New monthly total:</span>
                      <span>£{(basePrice + newExtraItems * additionalItemCost).toFixed(2)}/month</span>
                    </div>
                  </div>
                )}
                {isYearly && (
                  <div className="border-t pt-2 mt-2">
                    <div className="text-sm text-muted-foreground">
                      The extra item will also be included in your next annual renewal.
                    </div>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                {chargeDescription}
              </p>
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
              isYearly ? 'Add Item (Prorated Charge)' : `Add Item (+£${monthlyCharge.toFixed(2)}/mo)`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
