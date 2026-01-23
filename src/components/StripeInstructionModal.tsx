import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, ArrowLeft, CheckCircle, MousePointer } from "lucide-react";

interface StripeInstructionModalProps {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  isPortal?: boolean; // true for managing subscription, false for new checkout
  loading?: boolean;
}

export function StripeInstructionModal({ 
  open, 
  onClose, 
  onContinue, 
  isPortal = false,
  loading = false 
}: StripeInstructionModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ExternalLink className="w-5 h-5 text-primary" />
            {isPortal ? "Opening Stripe Portal" : "Opening Stripe Checkout"}
          </DialogTitle>
          <DialogDescription className="text-base">
            {isPortal 
              ? "You're about to manage your subscription on Stripe's secure portal."
              : "You're about to complete your payment on Stripe's secure checkout."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step 1 */}
          <div className="flex gap-3 items-start">
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
              1
            </div>
            <div>
              <p className="font-medium">Stripe opens in a new tab</p>
              <p className="text-sm text-muted-foreground">A new browser tab will open with Stripe's secure page.</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3 items-start">
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
              2
            </div>
            <div>
              <p className="font-medium">
                {isPortal ? "Make your changes" : "Complete your payment"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isPortal 
                  ? "Update your plan, payment method, or cancel your subscription."
                  : "Enter your payment details and confirm your subscription."
                }
              </p>
            </div>
          </div>

          {/* Step 3 - Different for checkout vs portal */}
          <div className="flex gap-3 items-start">
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
              3
            </div>
            <div>
              <p className="font-medium">Return to the app</p>
              {isPortal ? (
                <p className="text-sm text-muted-foreground">
                  Click the <strong>"← Return to..."</strong> link on the left side of the page.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  After payment, you'll be automatically redirected back here.
                </p>
              )}
            </div>
          </div>

          {/* Visual guide for portal */}
          {isPortal && (
            <div className="mt-4 p-4 rounded-lg border-2 border-dashed border-info/50 bg-info/5">
              <p className="text-sm font-medium text-info mb-3 flex items-center gap-2">
                <MousePointer className="w-4 h-4" />
                Where to click to return:
              </p>
              <div className="bg-white rounded-lg p-3 shadow-sm border relative">
                {/* Mock Stripe sidebar */}
                <div className="flex items-center gap-2 text-sm">
                  <ArrowLeft className="w-4 h-4 text-blue-600" />
                  <span className="text-blue-600 font-medium">Return to RideReady Docs</span>
                </div>
                {/* Animated pointer */}
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 animate-bounce">
                  <div className="bg-warning text-warning-foreground text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                    Click here! →
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This link appears on the left side of the Stripe portal page.
              </p>
            </div>
          )}

          {/* Checkout auto-redirect info */}
          {!isPortal && (
            <div className="mt-4 p-4 rounded-lg border-2 border-success/50 bg-success/5">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-success">Automatic redirect</p>
                  <p className="text-xs text-muted-foreground">
                    Once payment is complete, Stripe will automatically bring you back to the app. No action needed!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button 
            onClick={onContinue} 
            disabled={loading}
            className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            {loading ? (
              <>Opening Stripe...</>
            ) : (
              <>
                Continue to Stripe
                <ExternalLink className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
