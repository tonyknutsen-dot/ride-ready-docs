import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuditLog } from '@/hooks/useAuditLog';

/**
 * Support Access Grant enforcement — single source of truth.
 *
 * WHO can use a grant:
 *   Only platform admins (user_roles.role = 'admin') who have been
 *   assigned (claimed) the grant via granted_to_admin, OR unclaimed
 *   grants that any admin may claim.
 *
 * WHAT scope a grant applies to:
 *   A grant is scoped to a single customer user_id. It permits the
 *   admin to read that customer's operational data (rides, documents,
 *   checks, defects, maintenance, wind logs, risk assessments, etc.).
 *
 * READ-ONLY vs EDITABLE:
 *   access_scope = 'read_only' → view only (default)
 *   access_scope = 'edit' → reserved for future use, currently treated as read_only
 *
 * CLAIMED meaning:
 *   When an admin "claims" a grant, granted_to_admin is set to their user ID.
 *   Only the claiming admin (or any admin if unclaimed) can use the grant.
 *   Claiming is NOT required for access — it's a coordination mechanism.
 *
 * REVOKED / EXPIRED:
 *   status = 'revoked' → immediately blocks access, revoked_at timestamp set
 *   status = 'expired' OR expires_at <= now() → blocks access
 *   Both are checked in real-time by this hook and by the DB function
 *   admin_has_support_access().
 */

export interface ActiveSupportGrant {
  id: string;
  user_id: string;
  reason: string;
  access_scope: string;
  expires_at: string;
  granted_to_admin: string | null;
  granted_at: string;
}

interface SupportAccessState {
  /** All active grants the current admin can use */
  activeGrants: ActiveSupportGrant[];
  /** Currently selected target user_id for support viewing */
  activeTargetUserId: string | null;
  /** The grant being used for the active target */
  activeGrant: ActiveSupportGrant | null;
  /** Loading state */
  loading: boolean;
  /** Whether the current user is an admin who can use support access */
  canUseSupportAccess: boolean;
  /** Check if admin has a valid grant for a specific user */
  hasGrantForUser: (targetUserId: string) => boolean;
  /** Resolve the active grant for a target user (returns null if none) */
  resolveGrantForUser: (targetUserId: string) => ActiveSupportGrant | null;
  /** Select a target user to view via support access */
  selectTarget: (targetUserId: string) => Promise<boolean>;
  /** Clear the active support view session */
  clearTarget: () => void;
  /** Refresh grants from DB */
  refresh: () => Promise<void>;
  /** Log a support access usage event */
  logAccess: (resource: string, resourceId?: string) => Promise<void>;
  /** Log a blocked access attempt */
  logBlocked: (resource: string, targetUserId: string, reason: string) => Promise<void>;
}

export function useSupportAccess(): SupportAccessState {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { logEvent } = useAuditLog();
  const [activeGrants, setActiveGrants] = useState<ActiveSupportGrant[]>([]);
  const [activeTargetUserId, setActiveTargetUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canUseSupportAccess = isAdmin && !!user;

  const fetchActiveGrants = useCallback(async () => {
    if (!user || !isAdmin) {
      setActiveGrants([]);
      setLoading(false);
      return;
    }

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('support_access_grants')
        .select('id, user_id, reason, access_scope, expires_at, granted_to_admin, granted_at')
        .eq('status', 'active')
        .gt('expires_at', now)
        .or(`granted_to_admin.is.null,granted_to_admin.eq.${user.id}`);

      if (error) throw error;
      setActiveGrants((data || []) as ActiveSupportGrant[]);
    } catch (err) {
      console.error('[SupportAccess] Failed to fetch grants:', err);
      setActiveGrants([]);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    fetchActiveGrants();
  }, [fetchActiveGrants]);

  // Re-check grants every 60 seconds to catch expiry
  useEffect(() => {
    if (!canUseSupportAccess) return;
    const interval = setInterval(fetchActiveGrants, 60_000);
    return () => clearInterval(interval);
  }, [canUseSupportAccess, fetchActiveGrants]);

  // If the active target's grant expires/revokes, clear the target
  useEffect(() => {
    if (!activeTargetUserId) return;
    const grant = activeGrants.find(g => g.user_id === activeTargetUserId);
    if (!grant || new Date(grant.expires_at) <= new Date()) {
      setActiveTargetUserId(null);
    }
  }, [activeGrants, activeTargetUserId]);

  const hasGrantForUser = useCallback((targetUserId: string): boolean => {
    return activeGrants.some(
      g => g.user_id === targetUserId && new Date(g.expires_at) > new Date()
    );
  }, [activeGrants]);

  const resolveGrantForUser = useCallback((targetUserId: string): ActiveSupportGrant | null => {
    return activeGrants.find(
      g => g.user_id === targetUserId && new Date(g.expires_at) > new Date()
    ) || null;
  }, [activeGrants]);

  const selectTarget = useCallback(async (targetUserId: string): Promise<boolean> => {
    const grant = resolveGrantForUser(targetUserId);
    if (!grant) {
      await logEvent('support_view', 'support_access', undefined, {
        target_user_id: targetUserId,
        result: 'blocked',
        reason: 'no_valid_grant',
      }, { contextHint: 'Blocked: no valid support access grant' });
      setActiveTargetUserId(null);
      return false;
    }

    // Log the access session start
    await logEvent('support_view', 'support_access', grant.id as any, {
      target_user_id: targetUserId,
      grant_id: grant.id,
      access_scope: grant.access_scope,
      result: 'allowed',
    }, { contextHint: `Support view started for user ${targetUserId.slice(0, 8)}…` });

    setActiveTargetUserId(targetUserId);
    return true;
  }, [resolveGrantForUser, logEvent]);

  const clearTarget = useCallback(() => {
    if (activeTargetUserId) {
      logEvent('support_view', 'support_access', undefined, {
        target_user_id: activeTargetUserId,
        action: 'session_ended',
      }, { contextHint: 'Support view session ended' });
    }
    setActiveTargetUserId(null);
  }, [activeTargetUserId, logEvent]);

  const logAccess = useCallback(async (resource: string, resourceId?: string) => {
    if (!activeTargetUserId) return;
    const grant = resolveGrantForUser(activeTargetUserId);
    await logEvent('support_view', 'support_access', resourceId as any, {
      target_user_id: activeTargetUserId,
      grant_id: grant?.id,
      access_scope: grant?.access_scope,
      viewed_resource: resource,
    }, { contextHint: `Support viewed ${resource}` });
  }, [activeTargetUserId, resolveGrantForUser, logEvent]);

  const logBlocked = useCallback(async (resource: string, targetUserId: string, reason: string) => {
    await logEvent('support_view', resource, undefined, {
      target_user_id: targetUserId,
      result: 'blocked',
      reason,
    }, {
      contextHint: `Blocked: ${reason}`,
    });
  }, [logEvent]);

  const activeGrant = useMemo(() => {
    if (!activeTargetUserId) return null;
    return resolveGrantForUser(activeTargetUserId);
  }, [activeTargetUserId, resolveGrantForUser]);

  return {
    activeGrants,
    activeTargetUserId,
    activeGrant,
    loading,
    canUseSupportAccess,
    hasGrantForUser,
    resolveGrantForUser,
    selectTarget,
    clearTarget,
    refresh: fetchActiveGrants,
    logAccess,
    logBlocked,
  };
}
