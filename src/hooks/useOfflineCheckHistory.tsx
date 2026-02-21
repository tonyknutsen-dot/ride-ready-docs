import { useState, useEffect, useCallback } from 'react';
import { getPendingChecks, getPendingDefects, type OfflineCheck, type OfflineDefect } from '@/lib/offlineDb';

export interface OfflineCheckDisplay {
  localId: string;
  rideId: string;
  inspectorName: string;
  checkDate: string;
  checkFrequency: string;
  status: string;
  notes?: string;
  weatherConditions?: string;
  location?: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncError?: string;
  resultCount: number;
  hasLinkedDefects: boolean;
  defectsSynced: boolean;
}

export function useOfflineCheckHistory(rideId: string, frequency?: string) {
  const [offlineChecks, setOfflineChecks] = useState<OfflineCheckDisplay[]>([]);

  const refresh = useCallback(async () => {
    const [checks, defects] = await Promise.all([getPendingChecks(), getPendingDefects()]);

    const filtered = checks
      .filter(c => c.rideId === rideId && (!frequency || c.checkFrequency === frequency))
      .map(c => {
        const linkedDefects = defects.filter(d => d.checkLocalId === c.localId);
        const allDefectsSynced = linkedDefects.length === 0 || linkedDefects.every(d => d.syncStatus === 'synced');

        return {
          localId: c.localId,
          rideId: c.rideId,
          inspectorName: c.inspectorName,
          checkDate: c.checkDate,
          checkFrequency: c.checkFrequency,
          status: c.status,
          notes: c.notes,
          weatherConditions: c.weatherConditions,
          location: c.location,
          syncStatus: c.syncStatus,
          syncError: c.syncError,
          resultCount: c.results.length,
          hasLinkedDefects: linkedDefects.length > 0,
          defectsSynced: allDefectsSynced,
        } as OfflineCheckDisplay;
      });

    setOfflineChecks(filtered);
  }, [rideId, frequency]);

  useEffect(() => {
    refresh();
    // Poll every 3 seconds to catch sync status changes
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { offlineChecks, refresh };
}
