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
import { AlertTriangle } from "lucide-react";

interface ExtraItemChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  currentCount: number;
  limit: number;
  plan: 'basic' | 'advanced' | 'trial' | 'expired';
}

export const ExtraItemChargeDialog = ({
  open,
  onOpenChange,
  onConfirm,
  currentCount,
  limit,
  plan,
}: ExtraItemChargeDialogProps) => {
  const additionalItemCost = PRICING.basic.additionalItemCost; // 75p
  const currentExtraItems = Math.max(0, currentCount - limit);
  const newExtraItems = currentExtraItems + 1;
  const currentExtraCharge = (currentExtraItems * additionalItemCost).toFixed(2);
  const newExtraCharge = (newExtraItems * additionalItemCost).toFixed(2);

  // Get base price based on plan
  const basePlan = plan === 'advanced' ? PRICING.advanced : PRICING.basic;
  const basePrice = basePlan.monthly;
  const newTotalMonthly = (basePrice + newExtraItems * additionalItemCost).toFixed(2);

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
                    <span>£{currentExtraCharge}/month</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium text-amber-700 dark:text-amber-400">
                  <span>+ New item charge:</span>
                  <span>+£{additionalItemCost.toFixed(2)}/month</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>New monthly total:</span>
                    <span>£{newTotalMonthly}/month</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Each additional item beyond your included {limit} costs 75p/month.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Add Item (+75p/month)
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
