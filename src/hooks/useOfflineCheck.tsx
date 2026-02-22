import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from './useEffectiveUserId';
import { useOnlineStatus } from './useOnlineStatus';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  offlineDb,
  type OfflineCheck,
  type OfflineCheckResult,
} from '@/lib/offlineDb';

import type { CheckItemResult } from '@/lib/offlineDb';

interface CheckSubmission {
  rideId: string;
  templateId: string;
  inspectorName: string;
  checkDate: string;
  checkFrequency: string;
  status: string;
  notes?: string;
  weatherConditions?: string;
  location?: string;
  signatureData?: string;
  complianceOfficer?: string;
  environmentNotes?: string;
  // GPS coordinate fields for deferred address resolution
  rawLatitude?: number;
  rawLongitude?: number;
  needsAddressResolution?: boolean;
  // Start notice acknowledgement
  startNoticeAcknowledged?: boolean;
  startNoticeAcknowledgedAt?: string;
  startNoticeAcknowledgedBy?: string;
  startNoticeSnapshot?: string;
  results: {
    templateItemId: string;
    isChecked: boolean;
    result: CheckItemResult;
    notes?: string;
  }[];
}

export function useOfflineCheck() {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { isOnline } = useOnlineStatus();
  const { toast } = useToast();

  const submitCheck = useCallback(async (check: CheckSubmission): Promise<{ success: boolean; isOffline: boolean; checkId?: string }> => {
    if (!user || !effectiveUserId) return { success: false, isOffline: false };

    // If online, submit directly to Supabase
    if (isOnline) {
      try {
        // Use effectiveUserId (operator's ID) so staff data syncs with operator
        const insertPayload: any = {
          ride_id: check.rideId,
          template_id: check.templateId,
          inspector_name: check.inspectorName,
          check_date: check.checkDate,
          check_frequency: check.checkFrequency,
          status: check.status,
          notes: check.notes,
          weather_conditions: check.weatherConditions,
          location: check.location,
          signature_data: check.signatureData,
          compliance_officer: check.complianceOfficer,
          environment_notes: check.environmentNotes,
          user_id: effectiveUserId,
        };

        // Add start notice acknowledgement fields if present
        if (check.startNoticeAcknowledged) {
          insertPayload.start_notice_acknowledged = true;
          insertPayload.start_notice_acknowledged_at = check.startNoticeAcknowledgedAt;
          insertPayload.start_notice_acknowledged_by = check.startNoticeAcknowledgedBy;
          insertPayload.start_notice_snapshot = check.startNoticeSnapshot;
        }

        const { data: checkData, error: checkError } = await supabase
          .from('checks')
          .insert(insertPayload)
          .select()
          .single();

        if (checkError) throw checkError;

        // Insert check results
        if (check.results.length > 0 && checkData) {
          const results = check.results.map(r => ({
            check_id: checkData.id,
            template_item_id: r.templateItemId,
            is_checked: r.isChecked,
            result: r.result,
            notes: r.notes,
          }));

          const { error: resultsError } = await supabase
            .from('check_results')
            .insert(results);

          if (resultsError) throw resultsError;
        }

        return { success: true, isOffline: false, checkId: checkData?.id };
      } catch (error: any) {
        console.error('Failed to submit check online:', error);
        // Fall through to offline storage
      }
    }

    // Store offline
    try {
      const localId = crypto.randomUUID();
      const offlineCheck: OfflineCheck = {
        localId,
        rideId: check.rideId,
        templateId: check.templateId,
        inspectorName: check.inspectorName,
        checkDate: check.checkDate,
        checkFrequency: check.checkFrequency,
        status: check.status,
        notes: check.notes,
        weatherConditions: check.weatherConditions,
        location: check.location,
        signatureData: check.signatureData,
        complianceOfficer: check.complianceOfficer,
        environmentNotes: check.environmentNotes,
        // GPS coordinate fields for deferred address resolution
        rawLatitude: check.rawLatitude,
        rawLongitude: check.rawLongitude,
        needsAddressResolution: check.needsAddressResolution,
        // Start notice acknowledgement
        startNoticeAcknowledged: check.startNoticeAcknowledged,
        startNoticeAcknowledgedAt: check.startNoticeAcknowledgedAt,
        startNoticeAcknowledgedBy: check.startNoticeAcknowledgedBy,
        startNoticeSnapshot: check.startNoticeSnapshot,
        results: check.results.map(r => ({
          templateItemId: r.templateItemId,
          isChecked: r.isChecked,
          result: r.result,
          notes: r.notes,
        })),
        createdAt: new Date().toISOString(),
        syncStatus: 'pending',
        syncAttempts: 0,
      };

      await offlineDb.offlineChecks.add(offlineCheck);

      toast({
        title: 'Saved offline',
        description: 'Check saved locally. Will sync when online.',
      });

      return { success: true, isOffline: true };
    } catch (error: any) {
      console.error('Failed to save check offline:', error);
      toast({
        title: 'Failed to save',
        description: error.message || 'Could not save check',
        variant: 'destructive',
      });
      return { success: false, isOffline: false };
    }
  }, [user, effectiveUserId, isOnline, toast]);

  return { submitCheck, isOnline };
}
