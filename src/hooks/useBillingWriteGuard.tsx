import { useCallback } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';

/**
 * Guards write actions when billing state blocks them.
 *
 * Two scenarios block writes:
 *  1. `past_due` with grace expired (current_period_end in the past)
 *  2. `expired` (trial or subscription ended)
 *
 * Usage:
 *   const { guardWrite, isWriteBlocked } = useBillingWriteGuard();
 *   // Returns true if blocked — caller should abort
 *   if (guardWrite()) return;
 */
export function useBillingWriteGuard() {
  const { subscription } = useSubscription();

  const isWriteBlocked = (() => {
    if (!subscription) return false;
    const { subscriptionStatus, currentPeriodEnd } = subscription;

    // Expired trial or subscription
    if (subscriptionStatus === 'expired') return true;

    // Past-due with grace expired
    if (subscriptionStatus === 'past_due') {
      if (!currentPeriodEnd) return true;
      return new Date(currentPeriodEnd) <= new Date();
    }

    return false;
  })();

  const blockReason: 'payment_failed' | 'expired' | null = (() => {
    if (!subscription || !isWriteBlocked) return null;
    if (subscription.subscriptionStatus === 'past_due') return 'payment_failed';
    return 'expired';
  })();

  /**
   * Call at the top of any write handler.
   * Returns `true` if the action was blocked.
   */
  const guardWrite = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!isWriteBlocked) return false;

      if (!opts?.silent) {
        if (blockReason === 'payment_failed') {
          toast.error('Access restricted — payment failed', {
            description:
              'Your payment method has failed and the grace period has ended. Please update your payment method on the Billing page to restore access.',
            duration: 6000,
          });
        } else {
          toast.error('Subscription required', {
            description:
              'Your subscription has expired. Please subscribe or renew on the Billing page to continue.',
            duration: 6000,
          });
        }
      }

      return true;
    },
    [isWriteBlocked, blockReason],
  );

  return { guardWrite, isWriteBlocked, blockReason };
}
