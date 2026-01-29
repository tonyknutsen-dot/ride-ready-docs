import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOnlineStatus } from './useOnlineStatus';
import { useToast } from './use-toast';
import {
  offlineDb,
  getPendingChecks,
  getPendingDefects,
  markCheckSynced,
  markCheckFailed,
  clearSyncedData,
  cacheLocationAddress,
  type OfflineCheck,
  type OfflineDefect,
} from '@/lib/offlineDb';

export function useOfflineSync() {
  const { user } = useAuth();
  const { isOnline, wasOffline, acknowledgeReconnection } = useOnlineStatus();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    const checks = await getPendingChecks();
    const defects = await getPendingDefects();
    setPendingCount(checks.length + defects.length);
  }, []);

  // Resolve address from coordinates using OpenStreetMap Nominatim
  const resolveAddress = async (lat: number, lon: number): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await response.json();
      
      if (data.address) {
        const parts = [];
        if (data.address.road) parts.push(data.address.road);
        if (data.address.village || data.address.town || data.address.city) {
          parts.push(data.address.village || data.address.town || data.address.city);
        }
        if (data.address.county) parts.push(data.address.county);
        if (data.address.postcode) parts.push(data.address.postcode);
        return parts.length > 0 ? parts.join(', ') : data.display_name;
      }
    } catch (e) {
      console.error('Address resolution failed:', e);
    }
    return null;
  };

  // Sync a single check to the server
  const syncCheck = async (check: OfflineCheck): Promise<boolean> => {
    if (!user) return false;

    try {
      // Update status to syncing
      await offlineDb.offlineChecks
        .where('localId')
        .equals(check.localId)
        .modify({ syncStatus: 'syncing' });

      // Resolve address if needed
      let resolvedLocation = check.location;
      if (check.needsAddressResolution && check.rawLatitude && check.rawLongitude) {
        const address = await resolveAddress(check.rawLatitude, check.rawLongitude);
        if (address) {
          resolvedLocation = address;
          // Cache this address for future offline use
          await cacheLocationAddress(check.rawLatitude, check.rawLongitude, address);
          console.log('Address resolved and cached:', address);
        } else {
          // Keep raw coordinates as fallback
          console.log('Address resolution failed, keeping coordinates');
        }
      }

      // Insert the check
      const { data: checkData, error: checkError } = await supabase
        .from('checks')
        .insert({
          ride_id: check.rideId,
          template_id: check.templateId,
          inspector_name: check.inspectorName,
          check_date: check.checkDate,
          check_frequency: check.checkFrequency,
          status: check.status,
          notes: check.notes,
          weather_conditions: check.weatherConditions,
          location: resolvedLocation,
          signature_data: check.signatureData,
          compliance_officer: check.complianceOfficer,
          environment_notes: check.environmentNotes,
          user_id: user.id,
        })
        .select()
        .single();

      if (checkError) throw checkError;

      // Insert check results
      if (check.results.length > 0 && checkData) {
        const results = check.results.map(r => ({
          check_id: checkData.id,
          template_item_id: r.templateItemId,
          is_checked: r.isChecked,
          result: r.result || (r.isChecked ? 'pass' : 'na'), // Support old data without result field
          notes: r.notes,
        }));

        const { error: resultsError } = await supabase
          .from('check_results')
          .insert(results);

        if (resultsError) throw resultsError;
      }

      await markCheckSynced(check.localId, checkData?.id);
      return true;
    } catch (error: any) {
      console.error('Failed to sync check:', error);
      await markCheckFailed(check.localId, error.message || 'Unknown error');
      return false;
    }
  };

  // Sync a single defect to the server
  const syncDefect = async (defect: OfflineDefect): Promise<boolean> => {
    if (!user) return false;

    try {
      await offlineDb.offlineDefects
        .where('localId')
        .equals(defect.localId)
        .modify({ syncStatus: 'syncing' });

      const { error } = await supabase.from('defects').insert({
        ride_id: defect.rideId,
        description: defect.description,
        severity: defect.severity as 'urgent' | 'non_urgent' | 'safety_critical',
        location_on_ride: defect.locationOnRide,
        photo_paths: defect.photoPaths || [],
        user_id: user.id,
      } as any);

      if (error) throw error;

      await offlineDb.offlineDefects
        .where('localId')
        .equals(defect.localId)
        .modify({ syncStatus: 'synced' });

      return true;
    } catch (error: any) {
      console.error('Failed to sync defect:', error);
      await offlineDb.offlineDefects
        .where('localId')
        .equals(defect.localId)
        .modify({
          syncStatus: 'failed',
          syncError: error.message || 'Unknown error',
          syncAttempts: (defect.syncAttempts || 0) + 1,
        });
      return false;
    }
  };

  // Sync all pending items
  const syncAll = useCallback(async () => {
    if (!isOnline || !user || isSyncing) return;

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // Sync checks
      const pendingChecks = await getPendingChecks();
      for (const check of pendingChecks) {
        // Skip checks that have failed too many times
        if (check.syncAttempts >= 5) continue;
        
        const success = await syncCheck(check);
        if (success) successCount++;
        else failCount++;
      }

      // Sync defects
      const pendingDefects = await getPendingDefects();
      for (const defect of pendingDefects) {
        if (defect.syncAttempts >= 5) continue;
        
        const success = await syncDefect(defect);
        if (success) successCount++;
        else failCount++;
      }

      // Clean up old synced data
      await clearSyncedData();
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
  }, [isOnline, user, isSyncing, toast, refreshPendingCount]);

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
    syncAll,
    refreshPendingCount,
  };
}
