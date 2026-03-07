import { useState, useCallback } from 'react';
import { useSecuritySettings } from './useSecuritySettings';

const REAUTH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Hook that provides re-authentication gating for sensitive actions.
 * Returns a guard function and dialog state.
 * 
 * Usage:
 * const { requireReAuth, reAuthProps } = useReAuth();
 * 
 * const handleDelete = () => {
 *   requireReAuth('delete this record', () => { actualDelete() });
 * };
 * 
 * <ReAuthDialog {...reAuthProps} />
 */
export function useReAuth() {
  const { settings, hasPinSet } = useSecuritySettings();
  const [open, setOpen] = useState(false);
  const [actionLabel, setActionLabel] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requireReAuth = useCallback((label: string, action: () => void) => {
    // If no PIN is set, just execute
    if (!hasPinSet || !settings.lock_pin_hash) {
      action();
      return;
    }

    // Check if recently re-authed
    const lastReAuth = sessionStorage.getItem('rrd-last-reauth');
    if (lastReAuth && Date.now() - parseInt(lastReAuth) < REAUTH_WINDOW_MS) {
      action();
      return;
    }

    // Show re-auth dialog
    setActionLabel(label);
    setPendingAction(() => action);
    setOpen(true);
  }, [hasPinSet, settings.lock_pin_hash]);

  const handleSuccess = useCallback(() => {
    pendingAction?.();
    setPendingAction(null);
  }, [pendingAction]);

  return {
    requireReAuth,
    reAuthProps: {
      open,
      onOpenChange: setOpen,
      pinHash: settings.lock_pin_hash || '',
      actionLabel,
      onSuccess: handleSuccess,
    },
  };
}
