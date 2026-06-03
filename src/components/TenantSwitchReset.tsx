import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { clearAllCache } from '@/lib/offlineCache';

/**
 * Watches the effective tenant (logged-in user.id + organisation owner id).
 * When it changes (sign-out, sign-in as different user, or staff membership
 * switch), clear React Query cache and the generic offline cache store so
 * no stale data from the previous tenant leaks into the new session.
 *
 * Identity cache (IndexedDB) is cleared in AuthContext.signOut().
 */
export function TenantSwitchReset() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { staffMembership } = useStaff();

  // Effective tenant key = logged-in user + (org owner if staff)
  const tenantKey = user
    ? `${user.id}:${staffMembership?.ownerId ?? user.id}`
    : null;

  const lastTenantRef = useRef<string | null>(null);

  useEffect(() => {
    const previous = lastTenantRef.current;

    // First mount: just record the current tenant — no reset needed.
    if (previous === null) {
      lastTenantRef.current = tenantKey;
      return;
    }

    if (previous !== tenantKey) {
      console.log('[TENANT-RESET] tenant changed', { from: previous, to: tenantKey });
      lastTenantRef.current = tenantKey;

      // Clear all React Query data — forces every hook to refetch under
      // the new tenant scope.
      queryClient.clear();

      // Clear generic offline cache (overview, defect lists, etc.)
      clearAllCache().catch(err => {
        console.warn('[TENANT-RESET] Failed to clear offline cache:', err);
      });
    }
  }, [tenantKey, queryClient]);

  return null;
}
