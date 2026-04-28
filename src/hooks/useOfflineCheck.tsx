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
  finishNoticeAcknowledged?: boolean;
  finishNoticeAcknowledgedAt?: string;
  finishNoticeAcknowledgedBy?: string;
  finishNoticeSnapshot?: string;
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

  const withTimeout = async <T,>(promise: PromiseLike<T>, timeoutMs = 12000): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Save timed out')), timeoutMs);
    });
    try {
      return await Promise.race([Promise.resolve(promise), timeout]);
    } finally {
      clearTimeout(timeoutId!);
    }
  };

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
          // Forensic attribution: always record the actual logged-in user
          performed_by_user_id: user.id,
        };

        // Add start notice acknowledgement fields if present
        if (check.startNoticeAcknowledged) {
          insertPayload.start_notice_acknowledged = true;
          insertPayload.start_notice_acknowledged_at = check.startNoticeAcknowledgedAt;
          insertPayload.start_notice_acknowledged_by = check.startNoticeAcknowledgedBy;
          insertPayload.start_notice_snapshot = check.startNoticeSnapshot;
        }

        if (check.finishNoticeAcknowledged) {
          insertPayload.finish_notice_acknowledged = true;
          insertPayload.finish_notice_acknowledged_at = check.finishNoticeAcknowledgedAt;
          insertPayload.finish_notice_acknowledged_by = check.finishNoticeAcknowledgedBy;
          insertPayload.finish_notice_snapshot = check.finishNoticeSnapshot;
        }

        const { data: checkId, error: saveError } = await withTimeout(supabase.rpc('submit_check_atomic' as any, {
          p_user_id: insertPayload.user_id,
          p_ride_id: insertPayload.ride_id,
          p_template_id: insertPayload.template_id,
          p_inspector_name: insertPayload.inspector_name,
          p_check_date: insertPayload.check_date,
          p_check_frequency: insertPayload.check_frequency,
          p_status: insertPayload.status,
          p_notes: insertPayload.notes ?? null,
          p_weather_conditions: insertPayload.weather_conditions ?? null,
          p_location: insertPayload.location ?? null,
          p_signature_data: insertPayload.signature_data ?? null,
          p_compliance_officer: insertPayload.compliance_officer ?? null,
          p_environment_notes: insertPayload.environment_notes ?? null,
          p_start_notice_acknowledged: insertPayload.start_notice_acknowledged ?? false,
          p_start_notice_acknowledged_at: insertPayload.start_notice_acknowledged_at ?? null,
          p_start_notice_acknowledged_by: insertPayload.start_notice_acknowledged_by ?? null,
          p_start_notice_snapshot: insertPayload.start_notice_snapshot ?? null,
          p_finish_notice_acknowledged: insertPayload.finish_notice_acknowledged ?? false,
          p_finish_notice_acknowledged_at: insertPayload.finish_notice_acknowledged_at ?? null,
          p_finish_notice_acknowledged_by: insertPayload.finish_notice_acknowledged_by ?? null,
          p_finish_notice_snapshot: insertPayload.finish_notice_snapshot ?? null,
          p_results: check.results.map(r => ({
            template_item_id: r.templateItemId,
            is_checked: r.isChecked,
            result: r.result,
            notes: r.notes ?? null,
          })),
        }));

        if (saveError) throw saveError;

        return { success: true, isOffline: false, checkId: checkId as string };
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
        finishNoticeAcknowledged: check.finishNoticeAcknowledged,
        finishNoticeAcknowledgedAt: check.finishNoticeAcknowledgedAt,
        finishNoticeAcknowledgedBy: check.finishNoticeAcknowledgedBy,
        finishNoticeSnapshot: check.finishNoticeSnapshot,
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
