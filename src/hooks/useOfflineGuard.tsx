import { useCallback } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { toast } from 'sonner';

/**
 * Shared offline guard helpers.
 *
 * Usage:
 *   const { guardOnline, isOnline } = useOfflineGuard();
 *   // Returns true if action was blocked (offline), false if OK to proceed
 *   if (guardOnline()) return;
 */
export function useOfflineGuard() {
  const { isOnline } = useOnlineStatus();

  /**
   * Call before any action that requires a network connection.
   * Returns `true` (blocked) if offline, `false` if online.
   *
   * @param opts.toast  – custom toast message (default: "Not available offline")
   * @param opts.silent – if true, don't show any feedback
   */
  const guardOnline = useCallback(
    (opts?: { toast?: string; silent?: boolean }) => {
      if (isOnline) return false; // not blocked
      if (!opts?.silent) {
        showOfflineToast(opts?.toast);
      }
      return true; // blocked
    },
    [isOnline],
  );

  return { isOnline, guardOnline };
}

/** Toast for actions that are queued offline */
export function showOfflineSyncToast(message?: string) {
  toast.info(message ?? 'Saved offline — will sync when online', {
    duration: 3000,
  });
}

/** Toast for actions that are completely blocked offline */
export function showOfflineToast(message?: string) {
  toast.info('Not available offline', {
    description:
      message ??
      "This item hasn't been saved on this device yet. Reconnect to view it.",
    duration: 4000,
  });
}

/** Toast for actions that need a connection (downloads etc.) */
export function showRequiresConnectionToast() {
  toast.info('Requires connection', {
    description: 'This action is unavailable while offline.',
    duration: 3000,
  });
}
