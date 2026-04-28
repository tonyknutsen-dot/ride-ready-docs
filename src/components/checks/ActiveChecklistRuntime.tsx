import { AlertTriangle, CheckCircle, CloudOff, Loader2, RefreshCw, WifiOff, XCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type CheckItemResult } from '@/lib/offlineDb';
import DefectReportDialog from '@/components/DefectReportDialog';
import DefectsList from '@/components/DefectsList';
import PriorDefectReviewDialog from '@/components/PriorDefectReviewDialog';
import { ChecklistItemRow, normalizeChecklistSource, type ChecklistRowResult } from './ChecklistItemRow';
import { type ChecklistRide, type ChecklistTemplate } from './useChecklistTemplate';

type WizardStep = 'details' | 'start-notice' | 'checklist';

interface ActiveChecklistRuntimeProps {
  ride: ChecklistRide;
  frequency: string;
  activeTemplate: ChecklistTemplate;
  itemResults: Record<string, CheckItemResult>;
  notes: Record<string, string>;
  inspectorName: string;
  inspectorNameError: boolean;
  locationError: boolean;
  wizardStep: WizardStep;
  location: string;
  usingCachedTemplate: boolean;
  defectRefreshKey: number;
  declarationChecked: boolean;
  highlightItemId: string | null;
  itemDefectRaised: Record<string, boolean>;
  itemDefects: Record<string, { id: string; photoCount: number; severity: string }>;
  priorOpenDefects: Record<string, { id: string; photoCount: number; severity: string }>;
  editingDefectForItem: string | null;
  reviewingPriorForItem: string | null;
  reopeningPriorForItem: string | null;
  submitting: boolean;
  submitPhase: 'idle' | 'saving' | 'record';
  startNoticeAcknowledged: boolean;
  finishNoticeAcknowledged: boolean;
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncAll: () => void;
  getProgress: () => number;
  handleResultChange: (itemId: string, result: CheckItemResult) => void;
  handleNoteChange: (itemId: string, note: string) => void;
  handleSubmitChecks: () => void;
  onSaveExit: () => void;
  setInspectorName: (value: string) => void;
  setInspectorNameError: (value: boolean) => void;
  setLocation: (value: string) => void;
  setLocationError: (value: boolean) => void;
  setWizardStep: (step: WizardStep) => void;
  setStartNoticeAcknowledged: (value: boolean) => void;
  setStartNoticeAcknowledgedAt: (value: string | null) => void;
  setDefectRefreshKey: React.Dispatch<React.SetStateAction<number>>;
  setItemDefectRaised: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setItemDefects: React.Dispatch<React.SetStateAction<Record<string, { id: string; photoCount: number; severity: string }>>>;
  setEditingDefectForItem: (value: string | null) => void;
  setReviewingPriorForItem: (value: string | null) => void;
  setReopeningPriorForItem: (value: string | null) => void;
  setPriorOpenDefects: React.Dispatch<React.SetStateAction<Record<string, { id: string; photoCount: number; severity: string }>>>;
  setHighlightItemId: (value: string | null) => void;
  setFinishNoticeAcknowledged: (value: boolean) => void;
  setFinishNoticeAcknowledgedAt: (value: string | null) => void;
  setDeclarationChecked: React.Dispatch<React.SetStateAction<boolean>>;
}

export function ActiveChecklistRuntime({
  ride, frequency, activeTemplate, itemResults, notes, inspectorName, inspectorNameError, locationError, wizardStep,
  location, usingCachedTemplate, defectRefreshKey, declarationChecked, highlightItemId, itemDefectRaised, itemDefects,
  priorOpenDefects, editingDefectForItem, reviewingPriorForItem, reopeningPriorForItem, submitting, submitPhase,
  startNoticeAcknowledged, finishNoticeAcknowledged, isOnline, pendingCount, isSyncing, syncAll, getProgress,
  handleResultChange, handleNoteChange, handleSubmitChecks, onSaveExit, setInspectorName, setInspectorNameError,
  setLocation, setLocationError, setWizardStep, setStartNoticeAcknowledged, setStartNoticeAcknowledgedAt,
  setDefectRefreshKey, setItemDefectRaised, setItemDefects, setEditingDefectForItem, setReviewingPriorForItem,
  setReopeningPriorForItem, setPriorOpenDefects, setHighlightItemId, setFinishNoticeAcknowledged,
  setFinishNoticeAcknowledgedAt, setDeclarationChecked,
}: ActiveChecklistRuntimeProps) {
  return (
    <>
    <div id="inspection-checklist-form" className="checksWrap -mx-4 pb-32 bg-muted/30">

      {/* ── Offline / sync banner ── */}
      {(!isOnline || usingCachedTemplate || pendingCount > 0) && (
        <div className={`mx-4 mt-3 flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs border ${
          !isOnline ? 'bg-warning/8 border-warning/30 text-warning' : pendingCount > 0 ? 'bg-info/8 border-info/30 text-info' : 'bg-muted border-muted-foreground/20 text-muted-foreground'
        }`}>
          <div className="flex items-center gap-1.5">
            {!isOnline ? <CloudOff className="h-3.5 w-3.5 shrink-0" /> : pendingCount > 0 ? <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} /> : <WifiOff className="h-3.5 w-3.5 shrink-0" />}
            <span>
              {!isOnline ? 'Offline — saved locally, synced when online' : pendingCount > 0 ? `${pendingCount} check${pendingCount > 1 ? 's' : ''} pending sync` : 'Using cached template'}
            </span>
          </div>
          {isOnline && pendingCount > 0 && !isSyncing && (
            <button onClick={syncAll} className="font-semibold underline underline-offset-2 shrink-0">Sync</button>
          )}
        </div>
      )}

      {/* ── WIZARD STEP 1: Check Details ── */}
      {wizardStep === 'details' && (
        <div className="mx-4 mt-3">
          <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Step 1 of 2</p>
              <h2 className="text-[15px] font-bold text-slate-900 mt-0.5">Check Details</h2>
              <p className="text-[12px] text-slate-500 mt-0.5">Complete before starting the check.</p>
            </div>
              <div className="px-4 pb-4 pt-2 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="checkedBy" className="text-[11px] font-bold text-slate-700">Checked By <span className="text-red-500">*</span></Label>
                <Input
                  id="checkedBy"
                  value={inspectorName}
                  onChange={(e) => { setInspectorName(e.target.value); setInspectorNameError(false); }}
                  placeholder="Your name"
                  className={`h-11 text-sm ${inspectorNameError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
                />
                {inspectorNameError && (
                  <p className="text-[11px] font-semibold text-red-600">Name is required to start this check.</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="checkLocation" className="text-[11px] font-bold text-slate-700">Location <span className="text-red-500">*</span></Label>
                <Input
                  id="checkLocation"
                  value={location}
                  onChange={(e) => { setLocation(e.target.value); setLocationError(false); }}
                  placeholder="e.g. Main fairground, Gate A"
                  className={`h-11 text-sm ${locationError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
                />
                {locationError && (
                  <p className="text-[11px] font-semibold text-red-600">Location is required to start this check.</p>
                )}
              </div>
              <button
                type="button"
                className="t-btn-primary w-full rounded-md py-3 text-[13px] mt-1"
                onClick={() => {
                  const hasName = !!inspectorName.trim();
                  const hasLocation = !!location.trim();

                  setInspectorNameError(!hasName);
                  setLocationError(!hasLocation);

                  if (!hasName || !hasLocation) {
                    return;
                  }

                  // If template has a start notice, show it before proceeding
                  const tmpl = activeTemplate as any;
                  if (tmpl?.start_notice_required && tmpl?.start_notice_text?.trim()) {
                    setWizardStep('start-notice');
                  } else {
                    setWizardStep('checklist');
                  }
                }}
              >
                {(() => {
                  const tmpl = activeTemplate as any;
                  return tmpl?.start_notice_required && tmpl?.start_notice_text?.trim() ? 'Continue' : 'Start Check';
                })()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── START NOTICE GATE ── */}
      {wizardStep === 'start-notice' && activeTemplate && (
        <div className="mx-4 mt-3">
          <div className="bg-white border border-warning/40 rounded-md shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-1">
              <p className="text-[10px] font-bold text-warning uppercase tracking-widest">⚠️ Important Notice</p>
              <h2 className="text-[15px] font-bold text-slate-900 mt-0.5">Start Notice</h2>
              <p className="text-[12px] text-slate-500 mt-0.5">You must acknowledge the following before starting this check.</p>
            </div>
            <div className="px-4 pb-4 pt-3 space-y-4">
              <div className="rounded-lg bg-warning/5 border border-warning/20 p-4">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {(activeTemplate as any).start_notice_text}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="startNoticeAck"
                  checked={startNoticeAcknowledged}
                  onCheckedChange={(checked) => setStartNoticeAcknowledged(!!checked)}
                  className="mt-0.5"
                />
                <label htmlFor="startNoticeAck" className="text-[12px] text-slate-700 cursor-pointer leading-relaxed">
                  I have read and understood this notice and confirm I will comply with the above requirements.
                </label>
              </div>
              <button
                type="button"
                className="t-btn-primary w-full rounded-md py-3 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!startNoticeAcknowledged}
                onClick={() => {
                  setStartNoticeAcknowledgedAt(new Date().toISOString());
                  setWizardStep('checklist');
                }}
              >
                Start Check
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WIZARD STEP 2: Checklist ── */}
      {wizardStep === 'checklist' && (
        <>
          {/* Header card */}
          <div className="sticky top-0 z-30 mx-4 mt-2">
            <div className="rounded-lg px-4 py-3 shadow-sm border border-border bg-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                   <h2 className="text-[14.5px] font-semibold text-foreground leading-tight truncate">
                     {frequency === 'preopening' ? 'Pre-Opening Check' : frequency === 'daily' ? 'Daily Check' : frequency === 'weekly' ? 'Weekly Check' : frequency === 'monthly' ? 'Monthly Check' : frequency === 'yearly' ? 'Yearly Check' : `${frequency} Check`}
                   </h2>
                    <p className="text-[12px] font-normal text-muted-foreground truncate mt-0.5">
                     {ride.ride_name}{ride.ride_code ? ` – ${ride.ride_code}` : ''}
                   </p>
                    <p className="text-[9.5px] font-normal text-muted-foreground mt-0.5">
                      Checked by <span className="font-medium text-muted-foreground">{inspectorName}</span>
                     {location ? ` · ${location}` : ''}
                   </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWizardStep('details')}
                  className="text-[11px] font-bold text-primary shrink-0 hover:underline mt-1"
                >
                  Edit
                </button>
              </div>
              {/* Progress bar */}
              <div className="mt-2.5">
                <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-normal text-muted-foreground">
                    {activeTemplate.daily_check_template_items.filter(item => { const r = itemResults[item.id]; return r === 'pass' || r === 'na' || (r === 'fail' && itemDefectRaised[item.id]); }).length} of {activeTemplate.daily_check_template_items.length} items completed
                  </p>
                  {getProgress() === 100 && (
                    <span className="text-[10px] font-bold text-success">✓ Done</span>
                  )}
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${getProgress() === 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${Math.round(getProgress())}%` }} />
                </div>
              </div>
            </div>
          </div>

      {/* ── Item cards ── */}
      <div className="mx-4 mt-2 space-y-2">
        {activeTemplate.daily_check_template_items
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((item, index) => {
            const v = itemResults[item.id];
            const isFail = v === 'fail';
            const isPass = v === 'pass';
            const isNA = v === 'na';
            const hasResult = isPass || isFail || isNA;

            const rowResult: ChecklistRowResult = isPass ? 'pass' : isFail ? 'fail' : isNA ? 'na' : 'pending';

            return (
              <ChecklistItemRow
                key={item.id}
                dataItemId={item.id}
                text={item.check_item_text}
                source={normalizeChecklistSource(item.category)}
                rideTypeName={ride.ride_categories?.name}
                result={rowResult}
                index={index}
                className={highlightItemId === item.id ? 'ring-2 ring-primary/50' : undefined}
              >
                {/* Row 2: Segmented control (joined buttons) */}
                <div>
                  <div className="flex overflow-hidden rounded-lg border border-border bg-card">
                    <button
                      type="button"
                      onClick={() => handleResultChange(item.id, 'pass')}
                      className={`flex-1 h-11 text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] focus:outline-none ${
                        isPass
                          ? 'bg-success text-success-foreground'
                          : hasResult
                          ? 'bg-secondary text-muted-foreground border-r border-border'
                          : 'bg-card text-foreground hover:bg-secondary border-r border-border'
                      }`}
                    >
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      Pass
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResultChange(item.id, 'fail')}
                      className={`flex-1 h-11 text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] focus:outline-none ${
                        isFail
                          ? 'bg-destructive text-destructive-foreground'
                          : hasResult
                          ? 'bg-secondary text-muted-foreground border-r border-border'
                          : 'bg-card text-foreground hover:bg-secondary border-r border-border'
                      }`}
                    >
                      <XCircle className="h-4 w-4 shrink-0" />
                      Fail
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResultChange(item.id, 'na')}
                      className={`flex-1 h-11 text-[13px] font-bold flex items-center justify-center transition-all active:scale-[0.98] focus:outline-none ${
                        isNA
                          ? 'bg-warning text-warning-foreground'
                          : hasResult
                          ? 'bg-secondary text-muted-foreground'
                          : 'bg-card text-foreground hover:bg-secondary'
                      }`}
                    >
                      N/A
                    </button>
                   </div>

                   {/* Fail: expanded action section */}
                   {isFail && (
                     <div className="mt-2 space-y-2">
                       <p className="font-bold text-red-700 text-xs flex items-center gap-1.5">
                         <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                         Action required
                       </p>

                       <Textarea
                         placeholder="Describe the failure…"
                         value={notes[item.id] || ''}
                         onChange={(e) => handleNoteChange(item.id, e.target.value)}
                          className="min-h-[56px] text-sm resize-none rounded-md bg-background border-border"
                         rows={2}
                       />

                       <div className="flex gap-2">
                          {!itemDefects[item.id] ? (
                            <DefectReportDialog
                              rideId={ride.id}
                              rideName={ride.ride_name}
                              checkFrequency={frequency}
                              templateItemId={item.id}
                              defaultDescription={notes[item.id] || ''}
                              onDefectReported={(info) => {
                                setDefectRefreshKey(prev => prev + 1);
                                setItemDefectRaised(prev => ({ ...prev, [item.id]: true }));
                                if (info) {
                                  setItemDefects(prev => ({ ...prev, [item.id]: { id: info.defectId, photoCount: info.photoCount, severity: info.severity } }));
                                }
                              }}
                              trigger={
                                 <button type="button" className="h-9 rounded-md border border-destructive/40 text-xs font-bold flex items-center justify-center gap-1.5 text-destructive hover:bg-destructive/5 flex-1 transition-colors">
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  Raise Defect
                                </button>
                              }
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingDefectForItem(item.id)}
                              className="h-9 rounded-md border border-success/40 bg-success/10 text-xs font-bold flex items-center justify-center gap-1.5 text-success hover:bg-success/15 flex-1 transition-colors"
                            >
                              <CheckCircle className="h-3 w-3 shrink-0" />
                              View / Edit defect
                              {itemDefects[item.id].photoCount > 0 && (
                                <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-card border border-success/30 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                                  📷 {itemDefects[item.id].photoCount}
                                </span>
                              )}
                            </button>
                          )}
                       </div>

                        {/* Edit-defect dialog (controlled, hydrates the existing defect) */}
                        {editingDefectForItem === item.id && itemDefects[item.id] && (
                          <DefectReportDialog
                            rideId={ride.id}
                            rideName={ride.ride_name}
                            checkFrequency={frequency}
                            templateItemId={item.id}
                            editDefectId={itemDefects[item.id].id}
                            open={true}
                            onOpenChange={(v) => { if (!v) setEditingDefectForItem(null); }}
                            onDefectReported={(info) => {
                              setDefectRefreshKey(prev => prev + 1);
                              if (info) {
                                setItemDefects(prev => ({ ...prev, [item.id]: { id: info.defectId, photoCount: info.photoCount, severity: info.severity } }));
                              }
                              setEditingDefectForItem(null);
                            }}
                          />
                        )}

                       {/* Defect status */}
                       {!itemDefectRaised[item.id] && (
                          <p className="text-[11px] font-semibold text-destructive flex items-center gap-1">
                           <AlertTriangle className="h-3 w-3 shrink-0" />
                           Raise a defect to record evidence and complete this item
                         </p>
                       )}
                       {itemDefectRaised[item.id] && (
                          <p className="text-[11px] font-semibold text-success flex items-center gap-1">
                           <CheckCircle className="h-3 w-3 shrink-0" />
                           Defect linked{itemDefects[item.id]?.photoCount ? ` · ${itemDefects[item.id].photoCount} photo${itemDefects[item.id].photoCount === 1 ? '' : 's'}` : ''}
                         </p>
                       )}

                       {/* Prior open defect — display-only, explicit review/reopen */}
                       {!itemDefects[item.id] && priorOpenDefects[item.id] && (
                         <div className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 flex items-start gap-2">
                           <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700 mt-0.5" />
                           <div className="flex-1 min-w-0">
                             <p className="text-[11px] font-bold text-amber-900">
                               Previous open defect exists
                             </p>
                             <p className="text-[10px] text-amber-800 mt-0.5">
                               Recorded on an earlier check of this item{priorOpenDefects[item.id].photoCount ? ` · ${priorOpenDefects[item.id].photoCount} photo${priorOpenDefects[item.id].photoCount === 1 ? '' : 's'}` : ''}. <span className="font-semibold">Not linked to this run.</span>
                             </p>
                             <button
                               type="button"
                               onClick={() => setReviewingPriorForItem(item.id)}
                               className="mt-1.5 h-7 px-2.5 rounded border border-amber-400 bg-white text-[11px] font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                             >
                               Review previous defect
                             </button>
                           </div>
                         </div>
                       )}

                       {/* Prior defect REVIEW dialog (read-only summary + explicit choice) */}
                       {reviewingPriorForItem === item.id && priorOpenDefects[item.id] && (
                         <PriorDefectReviewDialog
                           open={true}
                           onOpenChange={(v) => { if (!v) setReviewingPriorForItem(null); }}
                           defectId={priorOpenDefects[item.id].id}
                           onReopen={() => {
                             setReviewingPriorForItem(null);
                             setReopeningPriorForItem(item.id);
                           }}
                           onRaiseNew={() => {
                             setReviewingPriorForItem(null);
                             // Drop the prior chip so the standard "Raise Defect" path is used
                             setPriorOpenDefects(prev => { const { [item.id]: _, ...rest } = prev; return rest; });
                           }}
                         />
                       )}

                       {/* Reopen-prior dialog (only mounts after explicit Reopen click) */}
                       {reopeningPriorForItem === item.id && priorOpenDefects[item.id] && (
                         <DefectReportDialog
                           rideId={ride.id}
                           rideName={ride.ride_name}
                           checkFrequency={frequency}
                           templateItemId={item.id}
                           editDefectId={priorOpenDefects[item.id].id}
                           open={true}
                           onOpenChange={(v) => { if (!v) setReopeningPriorForItem(null); }}
                           onDefectReported={(info) => {
                             setDefectRefreshKey(prev => prev + 1);
                             if (info) {
                               setItemDefects(prev => ({ ...prev, [item.id]: { id: info.defectId, photoCount: info.photoCount, severity: info.severity } }));
                               setItemDefectRaised(prev => ({ ...prev, [item.id]: true }));
                               setPriorOpenDefects(prev => { const { [item.id]: _, ...rest } = prev; return rest; });
                             }
                             setReopeningPriorForItem(null);
                           }}
                         />
                       )}
                     </div>
                   )}

                   {/* Pass/N/A: compact — optional note only */}
                   {!isFail && (
                     notes[item.id] !== undefined ? (
                       <div className="mt-1.5">
                         <Textarea
                           placeholder="Add a note…"
                           value={notes[item.id] || ''}
                           onChange={(e) => handleNoteChange(item.id, e.target.value)}
                           className="min-h-[44px] text-xs resize-none rounded-md bg-white border-slate-300"
                           rows={1}
                         />
                       </div>
                     ) : (
                       <button
                         type="button"
                         onClick={() => handleNoteChange(item.id, '')}
                         className="mt-0.5 text-[11px] font-medium text-slate-500 hover:text-primary"
                       >
                         + Add note
                       </button>
                     )
                   )}
                 </div>
              </ChecklistItemRow>
            );
          })}
      </div>

      {/* ── Defects (slim section) ── */}
       <div className="mx-4 mt-1.5">
          <div className="bg-card border border-border rounded-md p-3 shadow-sm">
           <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold text-foreground uppercase">Defects</p>
             <DefectReportDialog
               rideId={ride.id}
               rideName={ride.ride_name}
               checkFrequency={frequency}
               onDefectReported={() => setDefectRefreshKey(prev => prev + 1)}
               
               trigger={
                 <button type="button" className="text-[11px] font-bold text-primary hover:underline">
                   + Raise defect
                 </button>
               }
             />
          </div>
          <DefectsList
            key={defectRefreshKey}
            rideId={ride.id}
            rideName={ride.ride_name}
            showResolved={false}
            onDefectUpdated={() => setDefectRefreshKey(prev => prev + 1)}
          />
        </div>
      </div>

      {/* ── Confirmation Card ── */}
        <div className="mx-4 mt-3">
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm space-y-3">
           <h3 className="text-[13px] font-semibold text-foreground uppercase">Confirmation</h3>

          {/* Warning: unanswered items */}
           {getProgress() < 100 && (
             <button
               type="button"
               className="w-full text-left"
               onClick={() => {
                 const sorted = activeTemplate.daily_check_template_items
                   .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                 const firstIncomplete = sorted.find(item => {
                   const r = itemResults[item.id];
                   if (!r) return true;
                   if (r === 'fail' && !itemDefectRaised[item.id]) return true;
                   return false;
                 });
                 if (firstIncomplete) {
                   const el = document.querySelector(`[data-item-id="${firstIncomplete.id}"]`);
                   if (el) {
                     el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                     setHighlightItemId(firstIncomplete.id);
                     setTimeout(() => setHighlightItemId(null), 1500);
                   }
                 }
               }}
             >
                 <p className="text-[11px] text-destructive font-semibold leading-snug hover:underline">
                  ⚠ {activeTemplate.daily_check_template_items.filter(item => { const r = itemResults[item.id]; return !r || (r === 'fail' && !itemDefectRaised[item.id]); }).length} items remaining — answer all items and raise defects for failures. Tap to view.
               </p>
             </button>
           )}

           {getProgress() === 100 && (
               <p className="text-[11px] text-success font-semibold leading-snug">
                ✓ All items completed. Ready to confirm.
              </p>
           )}

            {(activeTemplate as any).finish_notice_required && (activeTemplate as any).finish_notice_text?.trim() && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
                <p className="text-[11px] font-bold text-warning uppercase">Before you finish</p>
                <p className="text-[12px] text-foreground whitespace-pre-wrap leading-relaxed">{(activeTemplate as any).finish_notice_text}</p>
                <label className="flex items-start gap-2 text-[12px] font-medium text-foreground cursor-pointer">
                  <Checkbox
                    checked={finishNoticeAcknowledged}
                    onCheckedChange={(checked) => {
                      setFinishNoticeAcknowledged(!!checked);
                      setFinishNoticeAcknowledgedAt(checked ? new Date().toISOString() : null);
                    }}
                    className="mt-0.5"
                    disabled={getProgress() < 100}
                  />
                  I have completed these close-out checks.
                </label>
              </div>
            )}

          <div className="border-t border-slate-100 pt-3">
             <label className={`flex items-start gap-2.5 group ${
               getProgress() < 100
                 ? 'opacity-40 pointer-events-none'
                 : 'cursor-pointer'
             }`}>
                <div
                  className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                    declarationChecked ? 'bg-primary border-primary' :
                    getProgress() < 100
                      ? 'border-slate-300 bg-slate-100'
                      : 'border-slate-400 group-hover:border-primary'
                  }`}
                 onClick={() => {
                   if (getProgress() === 100) setDeclarationChecked(prev => !prev);
                 }}
               >
                 {declarationChecked && <CheckCircle className="h-3.5 w-3.5 text-primary-foreground" />}
               </div>
               <span
                 className="text-[12px] text-slate-700 leading-snug select-none font-medium"
                 onClick={() => {
                   if (getProgress() === 100) setDeclarationChecked(prev => !prev);
                 }}
               >
                I confirm this check is complete, accurate, and the results recorded truthfully.
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* ── Sticky footer ── */}
      <div className="fixed left-0 right-0 bottom-0 z-30 border-t border-slate-300 bg-white/95 backdrop-blur-sm shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
        <div className="max-w-xl mx-auto px-4 py-2 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-md border border-slate-300 py-2.5 text-[13px] font-bold bg-white hover:bg-slate-50 text-slate-700 transition-colors"
            onClick={() => {
              if (Object.keys(itemResults).length > 0) {
                setWizardStep('details');
              } else {
                onSaveExit();
              }
            }}
          >
            Save & Exit
          </button>
          <button
            type="button"
            disabled={submitting || !inspectorName.trim() || !declarationChecked || getProgress() < 100 || (!!(activeTemplate as any).finish_notice_required && !!(activeTemplate as any).finish_notice_text?.trim() && !finishNoticeAcknowledged)}
            onClick={handleSubmitChecks}
            className="flex-1 t-btn-primary rounded-md py-2.5 text-[13px]"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin shrink-0" />{submitPhase === 'record' ? 'Creating record…' : 'Saving…'}</>
            ) : (
              <>Complete Check</>
            )}
          </button>
        </div>
      </div>
        </>
      )}
    </div>

    </>
  );

}

export default ActiveChecklistRuntime;
