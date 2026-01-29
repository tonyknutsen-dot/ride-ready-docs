import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
  results: {
    templateItemId: string;
    isChecked: boolean;
    result: CheckItemResult;
    notes?: string;
  }[];
}

export function useOfflineCheck() {
  const { user } = useAuth();
  const { isOnline } = useOnlineStatus();
  const { toast } = useToast();

  const submitCheck = useCallback(async (check: CheckSubmission): Promise<{ success: boolean; isOffline: boolean }> => {
    if (!user) return { success: false, isOffline: false };

    // If online, submit directly to Supabase
    if (isOnline) {
      try {
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
            location: check.location,
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
            result: r.result,
            notes: r.notes,
          }));

          const { error: resultsError } = await supabase
            .from('check_results')
            .insert(results);

          if (resultsError) throw resultsError;
        }

        return { success: true, isOffline: false };
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
  }, [user, isOnline, toast]);

  return { submitCheck, isOnline };
}
