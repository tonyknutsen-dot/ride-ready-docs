import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';
import { useBillingWriteGuard } from '@/hooks/useBillingWriteGuard';
import { useOfflineCheck } from '@/hooks/useOfflineCheck';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { type CheckItemResult } from '@/lib/offlineDb';
import TemplateBuilder from './TemplateBuilder';
import ChecklistLauncher from './checks/ChecklistLauncher';
import ActiveChecklistRuntime from './checks/ActiveChecklistRuntime';
import { useChecklistRecordSave } from './checks/useChecklistRecordSave';
import { useChecklistTemplate, type ChecklistRide } from './checks/useChecklistTemplate';
import { markCheckDebug, setCheckDebugValue } from '@/utils/checkDebug';

interface InspectionChecklistProps {
  ride: ChecklistRide;
  frequency: string;
  onChecklistSaved?: (inspectionRecordId?: string) => void;
  executionMode?: 'launcher' | 'execute';
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily / Pre-Opening',
  preopening: 'Pre-Opening',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const InspectionChecklist = ({ ride, frequency, onChecklistSaved, executionMode = 'launcher' }: InspectionChecklistProps) => {
  const navigate = useNavigate();
  const isExecutionMode = executionMode === 'execute';
  const { toast } = useToast();
  const { user } = useAuth();
  const { effectiveUserId, isStaff } = useEffectiveUserId();
  const queryClient = useQueryClient();
  const { guardWrite } = useBillingWriteGuard();
  const { submitCheck, isOnline } = useOfflineCheck();
  const { pendingCount, isSyncing, syncAll } = useOfflineSync();

  const {
    activeTemplate,
    setActiveTemplate,
    recentChecks,
    loading,
    usingCachedTemplate,
    loadActiveTemplate,
    loadRecentChecks,
  } = useChecklistTemplate({ ride, frequency, userId: user?.id, effectiveUserId, isStaff });

  const [itemResults, setItemResults] = useState<Record<string, CheckItemResult>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [inspectorName, setInspectorName] = useState('');
  const [inspectorNameError, setInspectorNameError] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [wizardStep, setWizardStep] = useState<'details' | 'start-notice' | 'checklist'>('details');
  const [inspectorNotes] = useState('');
  const [location, setLocation] = useState('');
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [defectRefreshKey, setDefectRefreshKey] = useState(0);
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  const [itemDefectRaised, setItemDefectRaised] = useState<Record<string, boolean>>({});
  const [itemDefects, setItemDefects] = useState<Record<string, { id: string; photoCount: number; severity: string }>>({});
  const [priorOpenDefects, setPriorOpenDefects] = useState<Record<string, { id: string; photoCount: number; severity: string }>>({});
  const [editingDefectForItem, setEditingDefectForItem] = useState<string | null>(null);
  const [reviewingPriorForItem, setReviewingPriorForItem] = useState<string | null>(null);
  const [reopeningPriorForItem, setReopeningPriorForItem] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<'idle' | 'saving' | 'record'>('idle');
  const [startNoticeAcknowledged, setStartNoticeAcknowledged] = useState(false);
  const [startNoticeAcknowledgedAt, setStartNoticeAcknowledgedAt] = useState<string | null>(null);
  const [finishNoticeAcknowledged, setFinishNoticeAcknowledged] = useState(false);
  const [finishNoticeAcknowledgedAt, setFinishNoticeAcknowledgedAt] = useState<string | null>(null);
  const [rawGpsCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [needsAddressResolution] = useState(false);

  useEffect(() => {
    if (!isExecutionMode) return;
    document.documentElement.setAttribute('data-builder-mode', 'mobile');
    return () => document.documentElement.removeAttribute('data-builder-mode');
  }, [isExecutionMode]);

  useEffect(() => {
    if (!user || inspectorName) return;
    const profileUserId = isStaff ? user.id : effectiveUserId;
    if (!profileUserId) return;
    supabase
      .from('profiles')
      .select('controller_name')
      .eq('user_id', profileUserId)
      .single()
      .then(({ data }) => {
        if (data?.controller_name && !inspectorName) setInspectorName(data.controller_name);
      });
  }, [user, effectiveUserId, isStaff, inspectorName]);

  useEffect(() => {
    if (!activeTemplate || !effectiveUserId) return;
    const failedItemIds = Object.entries(itemResults)
      .filter(([, result]) => result === 'fail')
      .map(([itemId]) => itemId)
      .filter(itemId => !itemDefects[itemId] && !priorOpenDefects[itemId]);
    if (failedItemIds.length === 0) return;

    let cancelled = false;
    (async () => {
      let query = supabase
        .from('defects')
        .select('id, template_item_id, photo_paths, severity')
        .eq('ride_id', ride.id)
        .in('template_item_id', failedItemIds)
        .neq('status', 'resolved')
        .order('updated_at', { ascending: false });
      if (!isStaff) query = query.eq('user_id', effectiveUserId);
      const { data, error } = await query;
      if (cancelled || error || !data?.length) return;
      setPriorOpenDefects(prev => {
        const next = { ...prev };
        data.forEach((defect) => {
          if (!defect.template_item_id || next[defect.template_item_id]) return;
          next[defect.template_item_id] = {
            id: defect.id,
            photoCount: Array.isArray(defect.photo_paths) ? defect.photo_paths.length : 0,
            severity: defect.severity,
          };
        });
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [activeTemplate, effectiveUserId, isStaff, itemDefects, itemResults, priorOpenDefects, ride.id]);

  const getProgress = () => {
    if (!activeTemplate?.daily_check_template_items) return 0;
    const items = activeTemplate.daily_check_template_items;
    const completedCount = items.filter(item => {
      const result = itemResults[item.id];
      if (result === 'pass' || result === 'na') return true;
      if (result === 'fail') return !!itemDefectRaised[item.id];
      return false;
    }).length;
    return items.length > 0 ? (completedCount / items.length) * 100 : 0;
  };

  const handleResultChange = (itemId: string, result: CheckItemResult) => {
    setItemResults(prev => {
      const current = prev[itemId];
      if (current === result) {
        const { [itemId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: result };
    });
  };

  const handleNoteChange = (itemId: string, note: string) => {
    setNotes(prev => ({ ...prev, [itemId]: note }));
  };

  const generatePDF = () => {
    if (!activeTemplate) return;
    const pdf = new jsPDF();
    const title = `${FREQUENCY_LABELS[frequency] || frequency} Checklist`;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(title, 14, 18);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.text(`Equipment: ${ride.ride_name}`, 14, 28);
    let y = 40;
    activeTemplate.daily_check_template_items
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .forEach((item, index) => {
        if (y > 280) { pdf.addPage(); y = 18; }
        const lines = pdf.splitTextToSize(`${index + 1}. ${item.check_item_text}`, 180);
        pdf.text(lines, 14, y);
        y += lines.length * 6 + 2;
      });
    pdf.save(`${title.replace(/[^a-z0-9]+/gi, '-')}-${ride.ride_name.replace(/[^a-z0-9]+/gi, '-')}.pdf`);
    toast({ title: 'PDF Generated', description: 'Checklist PDF has been downloaded' });
  };

  const handleSubmitChecks = useChecklistRecordSave({
    activeTemplate,
    ride,
    frequency,
    inspectorName,
    inspectorNotes,
    location,
    itemResults,
    notes,
    itemDefects,
    rawGpsCoords,
    needsAddressResolution,
    startNoticeAcknowledged,
    startNoticeAcknowledgedAt,
    finishNoticeAcknowledged,
    finishNoticeAcknowledgedAt,
    userId: user?.id,
    effectiveUserId,
    queryClient,
    submitCheck,
    guardWrite,
    toast,
    setWizardStep,
    setLocationError,
    setSubmitting,
    setSubmitPhase,
    loadRecentChecks,
    onChecklistSaved,
  });

  useEffect(() => {
    if (activeTemplate && isExecutionMode) {
      setCheckDebugValue('template query status', `finished: ${activeTemplate.daily_check_template_items.length} items`);
      markCheckDebug('execution UI ready');
    }
  }, [activeTemplate, isExecutionMode]);

  useEffect(() => {
    if (loading || isExecutionMode) return;
    const branchChosen = activeTemplate
      ? (recentChecks[0] ? 'saved checklist review' : 'existing checklist execution')
      : 'build checklist / no checklist state';
    setCheckDebugValue('branch chosen', branchChosen);
    if (!activeTemplate) markCheckDebug('no checklist state mounted');
  }, [activeTemplate, isExecutionMode, loading, recentChecks]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (showTemplateBuilder) {
    return (
      <TemplateBuilder
        ride={ride}
        template={activeTemplate}
        frequency={frequency}
        onSuccess={() => {
          setShowTemplateBuilder(false);
          loadActiveTemplate();
          toast({ title: 'Template saved', description: 'Your checklist template is ready to use.' });
          onChecklistSaved?.();
        }}
        onCancel={() => setShowTemplateBuilder(false)}
      />
    );
  }

  if (!activeTemplate || !isExecutionMode) {
    const lastDoneLabel = recentChecks[0]
      ? new Date(recentChecks[0].check_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : null;

    return (
      <ChecklistLauncher
        rideId={ride.id}
        rideName={ride.ride_name}
        frequency={frequency}
        frequencyLabel={FREQUENCY_LABELS[frequency] || frequency}
        templateName={activeTemplate?.template_name ?? null}
        itemCount={activeTemplate?.daily_check_template_items.length ?? 0}
        lastCompletedDate={lastDoneLabel}
        isStaff={isStaff}
        defectRefreshKey={defectRefreshKey}
        onBuildTemplate={() => setShowTemplateBuilder(true)}
        onEditTemplate={() => setShowTemplateBuilder(true)}
        onExportTemplate={generatePDF}
        onStartCheck={() => {
          setCheckDebugValue('branch chosen', 'existing checklist execution');
          const fromChecks = new URLSearchParams(window.location.search).get('from') === 'checks';
          const debugParam = new URLSearchParams(window.location.search).get('checkDebug') === '1';
          const params = [fromChecks ? 'from=checks' : '', debugParam ? 'checkDebug=1' : ''].filter(Boolean).join('&');
          navigate(`/checks/${ride.id}/${frequency}/execute${params ? `?${params}` : ''}`);
        }}
        onDefectRefresh={() => setDefectRefreshKey(prev => prev + 1)}
      />
    );
  }

  return (
    <ActiveChecklistRuntime
      ride={ride}
      frequency={frequency}
      activeTemplate={activeTemplate}
      itemResults={itemResults}
      notes={notes}
      inspectorName={inspectorName}
      inspectorNameError={inspectorNameError}
      locationError={locationError}
      wizardStep={wizardStep}
      location={location}
      usingCachedTemplate={usingCachedTemplate}
      defectRefreshKey={defectRefreshKey}
      declarationChecked={declarationChecked}
      highlightItemId={highlightItemId}
      itemDefectRaised={itemDefectRaised}
      itemDefects={itemDefects}
      priorOpenDefects={priorOpenDefects}
      editingDefectForItem={editingDefectForItem}
      reviewingPriorForItem={reviewingPriorForItem}
      reopeningPriorForItem={reopeningPriorForItem}
      submitting={submitting}
      submitPhase={submitPhase}
      startNoticeAcknowledged={startNoticeAcknowledged}
      finishNoticeAcknowledged={finishNoticeAcknowledged}
      isOnline={isOnline}
      pendingCount={pendingCount}
      isSyncing={isSyncing}
      syncAll={syncAll}
      getProgress={getProgress}
      handleResultChange={handleResultChange}
      handleNoteChange={handleNoteChange}
      handleSubmitChecks={handleSubmitChecks}
      onSaveExit={() => navigate(`/rides/${ride.id}?tab=checks`)}
      setInspectorName={setInspectorName}
      setInspectorNameError={setInspectorNameError}
      setLocation={setLocation}
      setLocationError={setLocationError}
      setWizardStep={setWizardStep}
      setStartNoticeAcknowledged={setStartNoticeAcknowledged}
      setStartNoticeAcknowledgedAt={setStartNoticeAcknowledgedAt}
      setDefectRefreshKey={setDefectRefreshKey}
      setItemDefectRaised={setItemDefectRaised}
      setItemDefects={setItemDefects}
      setEditingDefectForItem={setEditingDefectForItem}
      setReviewingPriorForItem={setReviewingPriorForItem}
      setReopeningPriorForItem={setReopeningPriorForItem}
      setPriorOpenDefects={setPriorOpenDefects}
      setHighlightItemId={setHighlightItemId}
      setFinishNoticeAcknowledged={setFinishNoticeAcknowledged}
      setFinishNoticeAcknowledgedAt={setFinishNoticeAcknowledgedAt}
      setDeclarationChecked={setDeclarationChecked}
    />
  );
};

export default InspectionChecklist;
