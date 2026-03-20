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

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    const [checks, defects, completions] = await Promise.all([
      getPendingChecks(),
      getPendingDefects(),
      getPendingComplianceCompletions(),
    ]);
    setPendingCount(checks.length + defects.length + completions.length);
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

  // Sync a single offline compliance completion
  const syncComplianceCompletion = async (completion: OfflineComplianceCompletion): Promise<boolean> => {
    if (!user) return false;

    try {
      await offlineDb.offlineComplianceCompletions
        .where('localId')
        .equals(completion.localId)
        .modify({ syncStatus: 'syncing' });

      // 1. Get profile data for snapshot
      const { data: profileData } = await supabase
        .from('profiles')
        .select('controller_name, company_name')
        .eq('user_id', user.id)
        .single();

      const { data: memberData } = await supabase
        .from('organisation_members')
        .select('permission_level')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      const completedByName = profileData?.controller_name || user.email || 'Unknown';
      const completedByRole = memberData ? 'Staff' : 'Controller';

      // 2. Upload evidence files from stored blobs
      const evidenceUrls: string[] = [];
      for (const blob of completion.evidenceBlobs) {
        const ext = blob.name.split('.').pop() || 'jpg';
        const path = `${user.id}/evidence/${completion.eventId}/${crypto.randomUUID()}.${ext}`;
        const file = new File([blob.data], blob.name, { type: blob.type });
        const { error } = await supabase.storage.from('ride-documents').upload(path, file);
        if (error) throw error;
        evidenceUrls.push(path);
      }

      // 3. Generate document ID
      let fullDocumentId: string | undefined;
      const completionDate = new Date(completion.completionDate);
      if (completion.rideId) {
        const docTypeCode = categoryToDocTypeCode(completion.eventCategory || 'compliance', completion.eventType);
        try {
          fullDocumentId = await generateDocumentId(completion.rideId, docTypeCode, completionDate.getFullYear());
        } catch (e) {
          console.warn('Could not generate document ID during sync:', e);
        }
      }

      // 4. Complete the event via RPC
      const { data, error } = await supabase.rpc('complete_event', {
        p_event_id: completion.eventId,
        p_completion_date: completion.completionDate,
        p_completion_notes: completion.notes || null,
        p_evidence_urls: evidenceUrls,
        p_completed_by_name: completedByName,
        p_completed_by_role: completedByRole,
      });
      if (error) throw error;

      // 5. Update event with inspector/reference/document ID + offline flags
      const eventUpdate: Record<string, any> = {
        completion_status: 'synced',
        completed_offline: true,
        synced_at: new Date().toISOString(),
      };
      if (completion.inspectorCompany) eventUpdate.inspector_company = completion.inspectorCompany;
      if (completion.certificateReference) eventUpdate.certificate_reference = completion.certificateReference;
      if (fullDocumentId) eventUpdate.full_document_id = fullDocumentId;

      await supabase
        .from('compliance_events')
        .update(eventUpdate)
        .eq('id', completion.eventId);

      // 6. Generate PDF + create document record
      await createComplianceDocument({
        eventId: completion.eventId,
        eventName: completion.eventName,
        eventCategory: completion.eventCategory,
        eventType: completion.eventType,
        rideId: completion.rideId,
        rideName: completion.rideName,
        dueDate: completion.dueDate,
        completionDate,
        completedByUserId: user.id,
        completedByName,
        completedByRole,
        notes: completion.notes,
        evidenceUrls,
        inspectorCompany: completion.inspectorCompany,
        certificateReference: completion.certificateReference,
        fullDocumentId,
      });

      // 7. Mark synced
      await offlineDb.offlineComplianceCompletions
        .where('localId')
        .equals(completion.localId)
        .modify({ syncStatus: 'synced' });

      return true;
    } catch (error: any) {
      console.error('Failed to sync compliance completion:', error);
      await offlineDb.offlineComplianceCompletions
        .where('localId')
        .equals(completion.localId)
        .modify({
          syncStatus: 'failed',
          syncError: error.message || 'Unknown error',
          syncAttempts: (completion.syncAttempts || 0) + 1,
          lastSyncAttempt: new Date().toISOString(),
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

      // Sync compliance completions
      const pendingCompletions = await getPendingComplianceCompletions();
      for (const completion of pendingCompletions) {
        if (completion.syncAttempts >= 5) continue;
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
