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
import { SELF_SERVE_MAX } from '@/hooks/useSubscription';
import { ShieldAlert, MessageCircle } from 'lucide-react';

interface OverLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: string;
  currentItemCount: number;
  attemptedItemCount: number;
  organisationName?: string;
  userEmail?: string;
  userName?: string;
}

export const OverLimitDialog = ({
  open,
  onOpenChange,
  currentPlan,
  currentItemCount,
  attemptedItemCount,
  organisationName,
  userEmail,
  userName,
}: OverLimitDialogProps) => {
  const [showSupport, setShowSupport] = useState(false);

  const prefillSubject = 'Larger operator plan request';
  const prefillMessage = [
    `We need support for more than ${SELF_SERVE_MAX} registered items.`,
    `Current plan: ${currentPlan}`,
    `Current item count: ${currentItemCount}`,
    `Attempted item count: ${attemptedItemCount}`,
    organisationName ? `Organisation: ${organisationName}` : null,
    userName ? `User: ${userName}` : null,
    userEmail ? `Email: ${userEmail}` : null,
    '',
    'Please contact us about a larger operator / enterprise plan.',
  ]
    .filter(Boolean)
    .join('\n');

  const handleContactSupport = () => {
    onOpenChange(false);
    setShowSupport(true);
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-warning/20 rounded-full">
                <ShieldAlert className="h-5 w-5 text-warning" />
              </div>
              <AlertDialogTitle>You've reached your plan limit</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <p>
                  You've reached the maximum number of items included in
                  self-serve plans.
                </p>
                <p>
                  If you need more than {SELF_SERVE_MAX} items, contact us and
                  we'll help you move onto a larger operator plan.
                </p>
                <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current plan</span>
                    <span className="font-medium">{currentPlan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Registered items</span>
                    <span className="font-medium">{currentItemCount} / {SELF_SERVE_MAX}</span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleContactSupport}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Contact Support
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
