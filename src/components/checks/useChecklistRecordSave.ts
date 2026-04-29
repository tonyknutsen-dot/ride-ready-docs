import { useCallback } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createInspectionRecord, findInspectionRecordIdByCheckId, type ItemResultSnapshot } from '@/utils/inspectionRecordService';
import { invalidateCheckRecordQueries } from '@/utils/queryInvalidation';
import { type CheckItemResult } from '@/lib/offlineDb';
import { type ChecklistRide, type ChecklistTemplate } from './useChecklistTemplate';
import { logCheckSavePath, markCheckDebug, setCheckDebugValue } from '@/utils/checkDebug';

interface UseChecklistRecordSaveParams {
  activeTemplate: ChecklistTemplate | null;
  ride: ChecklistRide;
  frequency: string;
  inspectorName: string;
  inspectorNotes: string;
  location: string;
  itemResults: Record<string, CheckItemResult>;
  notes: Record<string, string>;
  itemDefects: Record<string, { id: string; photoCount: number; severity: string }>;
  rawGpsCoords: { lat: number; lon: number } | null;
  needsAddressResolution: boolean;
  startNoticeAcknowledged: boolean;
  startNoticeAcknowledgedAt: string | null;
  finishNoticeAcknowledged: boolean;
  finishNoticeAcknowledgedAt: string | null;
  userId?: string | null;
  effectiveUserId?: string | null;
  queryClient: QueryClient;
  submitCheck: (payload: CheckSubmissionPayload) => Promise<{ success: boolean; isOffline?: boolean; checkId?: string }>;
  guardWrite: () => boolean;
  toast: (args: ToastPayload) => void;
  setWizardStep: (step: 'details' | 'start-notice' | 'checklist') => void;
  setLocationError: (value: boolean) => void;
  setSubmitting: (value: boolean) => void;
  setSubmitPhase: (phase: 'idle' | 'saving' | 'record') => void;
  loadRecentChecks: () => Promise<void>;
  onChecklistSaved?: (inspectionRecordId?: string) => void;
}

type ToastPayload = { title: string; description?: string; variant?: 'default' | 'destructive' };

type CheckSubmissionPayload = {
  rideId: string;
  templateId: string;
  inspectorName: string;
  checkDate: string;
  checkFrequency: string;
  status: string;
  notes?: string;
  location?: string;
  rawLatitude?: number;
  rawLongitude?: number;
  needsAddressResolution?: boolean;
  startNoticeAcknowledged?: boolean;
  startNoticeAcknowledgedAt?: string;
  startNoticeAcknowledgedBy?: string;
  startNoticeSnapshot?: string;
  finishNoticeAcknowledged?: boolean;
  finishNoticeAcknowledgedAt?: string;
  finishNoticeAcknowledgedBy?: string;
  finishNoticeSnapshot?: string;
  results: { templateItemId: string; isChecked: boolean; result: CheckItemResult; notes?: string }[];
};

type OverviewCache = {
  stats: { recentChecks: number; [key: string]: unknown };
  recentActivity: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

type LinkedDefect = { id: string; severity: string };

const withSaveStageTimeout = async <T,>(promise: PromiseLike<T>, stage: string, timeoutMs = 12000): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${stage} timed out`)), timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const findInspectionRecordIdWithRetry = async (checkId: string, attempts = 5, delayMs = 700): Promise<string | null> => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const recordId = await withSaveStageTimeout(
      findInspectionRecordIdByCheckId(checkId),
      `inspection record lookup attempt ${attempt}`,
      4000
    );
    if (recordId) return recordId;
    if (attempt < attempts) await wait(delayMs);
  }
  return null;
};

export function useChecklistRecordSave(params: UseChecklistRecordSaveParams) {
  return useCallback(async () => {
    const {
      activeTemplate, ride, frequency, inspectorName, inspectorNotes, location, itemResults, notes,
      itemDefects, rawGpsCoords, needsAddressResolution, startNoticeAcknowledged, startNoticeAcknowledgedAt,
      finishNoticeAcknowledged, finishNoticeAcknowledgedAt, userId, effectiveUserId, queryClient,
      submitCheck, guardWrite, toast, setWizardStep, setLocationError, setSubmitting, setSubmitPhase,
      loadRecentChecks, onChecklistSaved,
    } = params;

    if (guardWrite()) return;
    if (!activeTemplate) return;

    if (!inspectorName.trim()) {
      toast({ title: 'Name required', description: 'Please enter the name of the person performing this check', variant: 'destructive' });
      return;
    }

    if (!location.trim()) {
      setWizardStep('details');
      setLocationError(true);
      toast({ title: 'Location required', description: 'Please enter the location before completing this check', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    setSubmitPhase('saving');
    markCheckDebug('save started');
    logCheckSavePath('save started', { 'save path final outcome': 'in progress' });
    const previousOverview = queryClient.getQueryData(['overview', userId]);
    let savedCheckId: string | undefined;
    queryClient.setQueryData(['overview', userId], (old: OverviewCache | undefined) => {
      if (!old) return old;
      return {
        ...old,
        stats: { ...old.stats, recentChecks: old.stats.recentChecks + 1 },
        recentActivity: [
          { type: 'check', title: `Check completed - ${ride.ride_name}`, time: new Date().toLocaleDateString('en-GB'), _optimistic: true },
          ...old.recentActivity.slice(0, 3),
        ],
      };
    });

    try {
      const failedItems = Object.values(itemResults).filter(r => r === 'fail').length;
      const passedItems = Object.values(itemResults).filter(r => r === 'pass').length;
      const totalItems = activeTemplate.daily_check_template_items.length;
      const checkStatus = failedItems > 0 ? 'failed' : passedItems === totalItems ? 'passed' : 'partial';

      const { success, isOffline, checkId } = await submitCheck({
        rideId: ride.id,
        templateId: activeTemplate.id,
        inspectorName: inspectorName.trim(),
        checkDate: new Date().toISOString().split('T')[0],
        checkFrequency: frequency,
        status: checkStatus,
        notes: inspectorNotes.trim() || undefined,
        location: location.trim() || undefined,
        rawLatitude: rawGpsCoords?.lat,
        rawLongitude: rawGpsCoords?.lon,
        needsAddressResolution,
        startNoticeAcknowledged: startNoticeAcknowledged || undefined,
        startNoticeAcknowledgedAt: startNoticeAcknowledgedAt || undefined,
        startNoticeAcknowledgedBy: startNoticeAcknowledged ? userId : undefined,
        startNoticeSnapshot: startNoticeAcknowledged ? activeTemplate.start_notice_text : undefined,
        finishNoticeAcknowledged: finishNoticeAcknowledged || undefined,
        finishNoticeAcknowledgedAt: finishNoticeAcknowledgedAt || undefined,
        finishNoticeAcknowledgedBy: finishNoticeAcknowledged ? inspectorName.trim() : undefined,
        finishNoticeSnapshot: finishNoticeAcknowledged ? activeTemplate.finish_notice_text : undefined,
        results: activeTemplate.daily_check_template_items.map(item => ({
          templateItemId: item.id,
          isChecked: (itemResults[item.id] || 'na') === 'pass',
          result: itemResults[item.id] || 'na',
          notes: notes[item.id]?.trim() || undefined,
        })),
      });

      if (!success) throw new Error('Failed to submit check');
      savedCheckId = checkId;
      logCheckSavePath('source check save finished', { 'created check id': checkId ?? 'none' });

      setSubmitPhase('record');
      setCheckDebugValue('created check id', checkId ?? 'none');
      setCheckDebugValue('save stage', 'check row created');
      await invalidateCheckRecordQueries(queryClient);

      if (isOffline || !checkId) {
        toast({ title: 'Saved offline', description: 'This check is waiting to sync. The check record will appear once the device is online.' });
        setSubmitting(false);
        setSubmitPhase('idle');
        return;
      }

      const overallResult = failedItems > 0 ? 'failed' : passedItems === totalItems ? 'passed' : 'partial';
      const itemResultSnapshots: ItemResultSnapshot[] = activeTemplate.daily_check_template_items.map(item => ({
        template_item_id: item.id,
        check_item_text: item.check_item_text,
        category: item.category || null,
        result: (itemResults[item.id] || 'na') as 'pass' | 'fail' | 'na',
        notes: notes[item.id]?.trim() || null,
        is_required: item.is_required ?? false,
      }));

      const linkedDefectIds = Object.values(itemDefects).map(defect => defect.id);
      if (linkedDefectIds.length > 0) {
        setCheckDebugValue('save stage', 'linking defects');
        await withSaveStageTimeout(
          supabase.from('defects').update({ check_id: checkId }).in('id', linkedDefectIds).is('check_id', null),
          'defect link'
        );
      }

      setCheckDebugValue('save stage', 'loading linked defects');
      const { data: linkedDefects } = await withSaveStageTimeout(
        supabase
          .from('defects')
          .select('id, severity')
          .or(`check_id.eq.${checkId},id.in.(${linkedDefectIds.join(',') || '00000000-0000-0000-0000-000000000000'})`),
        'linked defects fetch'
      );
      const defectIds = (linkedDefects || []).map(d => d.id);

      setCheckDebugValue('save stage', 'creating inspection record');
      logCheckSavePath('inspection record create started', { 'created check id': checkId });
      let inspectionRecordId: string | null = null;
      try {
        inspectionRecordId = await withSaveStageTimeout(createInspectionRecord({
          checkId,
          rideId: ride.id,
          userId: effectiveUserId!,
          inspectorName: inspectorName.trim() || 'Inspector',
          checkDate: new Date().toISOString().split('T')[0],
          checkFrequency: frequency,
          templateId: activeTemplate.id,
          templateName: activeTemplate.template_name,
          overallResult,
          itemResults: itemResultSnapshots,
          notes: inspectorNotes.trim() || null,
          weatherConditions: null,
          location: location.trim() || null,
          environmentNotes: null,
          complianceOfficer: null,
          signatureData: null,
          defectIds,
        }), 'inspection record create');
        logCheckSavePath('inspection record create finished', { 'created inspection record id': inspectionRecordId ?? 'none' });
      } catch (recordError) {
        logCheckSavePath('inspection record create failed', {
          'any blocking error text': recordError instanceof Error ? recordError.message : 'inspection record create failed',
        });
      }

      logCheckSavePath('fallback lookup started', { 'created check id': checkId });
      let fallbackRecordId: string | null = null;
      try {
        fallbackRecordId = inspectionRecordId ? inspectionRecordId : await findInspectionRecordIdWithRetry(checkId);
        logCheckSavePath('fallback lookup finished', { 'created inspection record id': fallbackRecordId ?? 'none' });
      } catch (lookupError) {
        logCheckSavePath('fallback lookup failed', {
          'any blocking error text': lookupError instanceof Error ? lookupError.message : 'inspection record lookup failed',
        });
      }

      const resolvedRecordId = inspectionRecordId ?? fallbackRecordId;

      if (!resolvedRecordId) {
        invalidateCheckRecordQueries(queryClient);
        setCheckDebugValue('save stage', 'check saved without record detail');
        setSubmitting(false);
        setSubmitPhase('idle');
        logCheckSavePath('UI save state cleared', { 'save path final outcome': 'checks list refresh fallback' });
        onChecklistSaved?.();
        logCheckSavePath('navigate called / checks list refresh called', { 'any redirect target': 'checks page refresh fallback' });
        toast({
          title: 'Check saved',
          description: 'The check was saved and the records list has been refreshed.',
        });
        return;
      }

      setCheckDebugValue('created inspection record id', resolvedRecordId);
      markCheckDebug('inspection record created');

      await invalidateCheckRecordQueries(queryClient);
      setCheckDebugValue('save stage', 'navigating to record detail');
      setSubmitting(false);
      setSubmitPhase('idle');
      logCheckSavePath('UI save state cleared', { 'save path final outcome': 'record detail navigation' });
      onChecklistSaved?.(resolvedRecordId);
      logCheckSavePath('navigate called / checks list refresh called', { 'any redirect target': `inspection-record/${resolvedRecordId}` });
      void withSaveStageTimeout(loadRecentChecks(), 'recent checks refresh', 5000).catch((refreshError) => {
        console.warn('Recent checks refresh skipped after save:', refreshError);
        setCheckDebugValue('any blocking error text', refreshError instanceof Error ? refreshError.message : 'recent checks refresh failed');
      });

      const criticalDefectCount = (linkedDefects || []).filter((d: LinkedDefect) => d.severity === 'stop_operation').length;
      const totalDefectCount = (linkedDefects || []).length;
      if (failedItems > 0) {
        const defectSummary = totalDefectCount > 0
          ? `${totalDefectCount} defect${totalDefectCount !== 1 ? 's' : ''}${criticalDefectCount > 0 ? ` (${criticalDefectCount} critical)` : ''}`
          : '';
        toast({
          title: '⚠️ Check completed with failures',
          description: `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} check saved for ${ride.ride_name}. ${failedItems} failed item${failedItems !== 1 ? 's' : ''}${defectSummary ? ` • ${defectSummary}` : ''}`,
          variant: criticalDefectCount > 0 ? 'destructive' : 'default',
        });
      } else {
        toast({ title: 'Check completed ✓', description: `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} check record is ready` });
      }
    } catch (error) {
      if (savedCheckId) {
        const recoveredRecordId = await withSaveStageTimeout(
          findInspectionRecordIdByCheckId(savedCheckId),
          'inspection record recovery lookup',
          5000
        ).catch(() => null);

        if (recoveredRecordId) {
          invalidateCheckRecordQueries(queryClient);
          setCheckDebugValue('created inspection record id', recoveredRecordId);
          setCheckDebugValue('save stage', 'recovered record detail navigation');
          setSubmitting(false);
          setSubmitPhase('idle');
          onChecklistSaved?.(recoveredRecordId);
          return;
        }

        invalidateCheckRecordQueries(queryClient);
        setCheckDebugValue('save stage', 'check saved, returning to records');
        setSubmitting(false);
        setSubmitPhase('idle');
        onChecklistSaved?.();
        toast({ title: 'Check saved', description: 'The check was saved and the records list has been refreshed.' });
        return;
      }

      if (previousOverview) queryClient.setQueryData(['overview', userId], previousOverview);
      console.error('Error submitting checks:', error);
      setCheckDebugValue('any blocking error text', error instanceof Error ? error.message : 'check save failed');
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save check', variant: 'destructive' });
      setSubmitting(false);
      setSubmitPhase('idle');
    }
  }, [params]);
}
