import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { useOnlineStatus } from './useOnlineStatus';
import { useToast } from './use-toast';
import {
  offlineDb,
  getPendingChecks,
  getPendingDefects,
  getPendingComplianceCompletions,
  markCheckSynced,
  markCheckFailed,
  clearSyncedData,
  cacheLocationAddress,
  type OfflineCheck,
  type OfflineDefect,
  type OfflineComplianceCompletion,
} from '@/lib/offlineDb';
import { format } from 'date-fns';
import { createComplianceDocument, categoryToDocTypeCode } from '@/utils/complianceDocumentCreator';
import { generateDocumentId } from '@/utils/pdfTemplate';

export function useOfflineSync() {
  const { user } = useAuth();
  const { isOnline, wasOffline, acknowledgeReconnection } = useOnlineStatus();
  const { subscription } = useSubscription();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const MAX_SYNC_ATTEMPTS = 5;

  // Determine if billing restrictions block syncing writes
  const isBillingBlocked = useMemo(() => {
    if (!subscription) return false;
    const { subscriptionStatus, currentPeriodEnd } = subscription;
    if (subscriptionStatus === 'expired') return true;
    if (subscriptionStatus === 'past_due') {
      if (!currentPeriodEnd) return true;
      return new Date(currentPeriodEnd) <= new Date();
    }
    return false;
  }, [subscription]);

  const getSyncableQueue = useCallback(async () => {
    await Promise.all([
      offlineDb.offlineChecks
        .where('syncStatus')
        .equals('failed')
        .filter(check => (check.syncAttempts || 0) >= MAX_SYNC_ATTEMPTS)
        .delete(),
      offlineDb.offlineDefects
        .where('syncStatus')
        .equals('failed')
        .filter(defect => (defect.syncAttempts || 0) >= MAX_SYNC_ATTEMPTS)
        .delete(),
      offlineDb.offlineComplianceCompletions
        .where('syncStatus')
        .equals('failed')
        .filter(completion => (completion.syncAttempts || 0) >= MAX_SYNC_ATTEMPTS)
        .delete(),
    ]);

    const [checks, defects, completions] = await Promise.all([
      getPendingChecks(),
      getPendingDefects(),
      getPendingComplianceCompletions(),
    ]);

    return {
      checks: checks.filter(check => (check.syncAttempts || 0) < MAX_SYNC_ATTEMPTS),
      defects: defects.filter(defect => (defect.syncAttempts || 0) < MAX_SYNC_ATTEMPTS),
      completions: completions.filter(completion => (completion.syncAttempts || 0) < MAX_SYNC_ATTEMPTS),
    };
  }, []);

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    if (!user) {
      setPendingCount(0);
      return;
    }

    const { checks, defects, completions } = await getSyncableQueue();
    setPendingCount(checks.length + defects.length + completions.length);
  }, [getSyncableQueue, user]);
...
  // Sync all pending items
  const syncAll = useCallback(async () => {
    if (!isOnline || !user || isSyncing) return;

    await refreshPendingCount();

    if (isBillingBlocked) {
      toast({
        title: 'Sync blocked — subscription required',
        description: 'Pending items cannot be synced until your subscription is active. Please visit the Billing page.',
        variant: 'destructive',
      });
      return;
    }

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const {
        checks: pendingChecks,
        defects: pendingDefects,
        completions: pendingCompletions,
      } = await getSyncableQueue();

      for (const check of pendingChecks) {
        const success = await syncCheck(check);
        if (success) successCount++;
        else failCount++;
      }

      for (const defect of pendingDefects) {
        const success = await syncDefect(defect);
        if (success) successCount++;
        else failCount++;
      }

      for (const completion of pendingCompletions) {
        const success = await syncComplianceCompletion(completion);
        if (success) successCount++;
        else failCount++;
      }

      // Clean up old synced data
      await clearSyncedData();

      // Clean up old synced compliance completions
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      await offlineDb.offlineComplianceCompletions
        .where('syncStatus')
        .equals('synced')
        .filter(c => c.createdAt < cutoff.toISOString())
        .delete();

      await refreshPendingCount();

      if (successCount > 0) {
        toast({
          title: 'Sync complete',
          description: `${successCount} item${successCount > 1 ? 's' : ''} synced successfully`,
        });
      }

      if (failCount > 0) {
        toast({
          title: 'Some items failed to sync',
          description: `${failCount} item${failCount > 1 ? 's' : ''} will retry later`,
          variant: 'destructive',
        });
      }
    } finally {
      setIsSyncing(false);
    }
  }, [getSyncableQueue, isOnline, user, isSyncing, isBillingBlocked, toast, refreshPendingCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (wasOffline && isOnline) {
      acknowledgeReconnection();
      syncAll();
    }
  }, [wasOffline, isOnline, acknowledgeReconnection, syncAll]);

  // Initial pending count
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    isBillingBlocked,
    syncAll,
    refreshPendingCount,
  };
}
