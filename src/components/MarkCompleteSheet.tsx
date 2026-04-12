import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { openDocumentById } from '@/utils/documentOpen';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CheckCircle2, Calendar as CalendarIcon, Repeat, Camera, Upload, X, FileText, Image as ImageIcon, ArrowLeft, ExternalLink, Building2, Hash, CloudOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBillingWriteGuard } from '@/hooks/useBillingWriteGuard';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateComplianceQueries } from '@/utils/queryInvalidation';
import { format } from 'date-fns';
import { compressImage, isLikelyCameraPhoto } from '@/utils/imageCompression';
import { createComplianceDocument, categoryToDocTypeCode } from '@/utils/complianceDocumentCreator';
import { generateDocumentId } from '@/utils/pdfTemplate';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { addOfflineComplianceCompletion } from '@/lib/offlineDb';
import { maybeCreateRecurringEvent } from '@/utils/autoRecurrenceEvent';

interface MarkCompleteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  eventCategory?: string;
  eventType?: string;
  rideId?: string | null;
  rideName?: string;
  dueDate?: string;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  onCompleted?: () => void;
}

interface EvidenceFile {
  file: File;
  preview?: string;
  type: 'photo' | 'file';
}

interface CompletionResult {
  documentId: string;
  documentName: string;
  nextDueDate?: string;
}

const MarkCompleteSheet = ({
  open,
  onOpenChange,
  eventId,
  eventName,
  eventCategory = 'inspection',
  eventType,
  rideId,
  rideName = 'Unknown',
  dueDate,
  isRecurring,
  recurrenceRule,
  onCompleted,
}: MarkCompleteSheetProps) => {
  const { toast } = useToast();
  const { guardWrite } = useBillingWriteGuard();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isOnline } = useOnlineStatus();
  const [completionDate, setCompletionDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');
  const [inspectorCompany, setInspectorCompany] = useState('');
  const [certificateReference, setCertificateReference] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [completionResult, setCompletionResult] = useState<CompletionResult | null>(null);
  const [offlineCompleted, setOfflineCompleted] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      let processed = file;
      if (isLikelyCameraPhoto(file)) {
        try { processed = await compressImage(file, 1920, 1920, 0.8); } catch { /* use original */ }
      }
      const preview = URL.createObjectURL(processed);
      setEvidenceFiles(prev => [...prev, { file: processed, preview, type: 'photo' }]);
    }
    e.target.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      const preview = isImage ? URL.createObjectURL(file) : undefined;
      setEvidenceFiles(prev => [...prev, { file, preview, type: isImage ? 'photo' : 'file' }]);
    }
    e.target.value = '';
  };

  const removeEvidence = (index: number) => {
    setEvidenceFiles(prev => {
      const removed = prev[index];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadEvidence = async (): Promise<string[]> => {
    if (evidenceFiles.length === 0) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const urls: string[] = [];
    for (const ev of evidenceFiles) {
      const ext = ev.file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/evidence/${eventId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('ride-documents').upload(path, ev.file);
      if (error) throw error;
      urls.push(path);
    }
    return urls;
  };

  const isInspectionCategory = eventCategory === 'inspection' || eventCategory === 'ndt';

  const handleConfirm = async () => {
    if (guardWrite()) return;
    if (isInspectionCategory && !inspectorCompany.trim()) {
      toast({ title: "Inspector / Company required", description: "Please enter the inspector or company name for this inspection.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    // ── OFFLINE PATH ──
    if (!isOnline) {
      try {
        // Convert evidence files to ArrayBuffers for IndexedDB storage
        const evidenceBlobs: { name: string; type: string; data: ArrayBuffer }[] = [];
        for (const ev of evidenceFiles) {
          const data = await ev.file.arrayBuffer();
          evidenceBlobs.push({ name: ev.file.name, type: ev.file.type, data });
        }

        await addOfflineComplianceCompletion({
          localId: crypto.randomUUID(),
          eventId,
          eventName,
          eventCategory: eventCategory || 'inspection',
          eventType,
          rideId: rideId || null,
          rideName,
          dueDate: dueDate || format(completionDate, 'yyyy-MM-dd'),
          completionDate: format(completionDate, 'yyyy-MM-dd'),
          notes: notes || undefined,
          inspectorCompany: inspectorCompany || undefined,
          certificateReference: certificateReference || undefined,
          isRecurring: isRecurring || false,
          recurrenceRule,
          evidenceBlobs,
          createdAt: new Date().toISOString(),
          syncStatus: 'pending',
          syncAttempts: 0,
        });

        // Optimistically update the compliance event status in local query cache
        // so it immediately moves out of Open tab
        queryClient.setQueryData(['compliance', undefined], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            items: (old.items || []).filter((i: any) => i.id !== eventId),
          };
        });

        setOfflineCompleted(true);
        invalidateComplianceQueries(queryClient);
        onCompleted?.();

        toast({
          title: "Saved offline",
          description: "Will sync and generate PDF when back online.",
        });
      } catch (error: any) {
        toast({ title: "Error", description: error.message || "Could not save offline.", variant: "destructive" });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ── ONLINE PATH (existing) ──
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

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
      const completedByRole = memberData
        ? 'Staff'
        : 'Controller';

      const evidenceUrls = await uploadEvidence();

      let fullDocumentId: string | undefined;
      if (rideId) {
        const docTypeCode = categoryToDocTypeCode(eventCategory || 'compliance', eventType);
        try {
          fullDocumentId = await generateDocumentId(rideId, docTypeCode, completionDate.getFullYear());
        } catch (e) {
          console.warn('Could not generate document ID:', e);
        }
      }

      const { data, error } = await supabase.rpc('complete_event', {
        p_event_id: eventId,
        p_completion_date: format(completionDate, 'yyyy-MM-dd'),
        p_completion_notes: notes || null,
        p_evidence_urls: evidenceUrls,
        p_completed_by_name: completedByName,
        p_completed_by_role: completedByRole,
      });
      if (error) throw error;

      const eventUpdate: Record<string, any> = {};
      if (inspectorCompany) eventUpdate.inspector_company = inspectorCompany;
      if (certificateReference) eventUpdate.certificate_reference = certificateReference;
      if (fullDocumentId) eventUpdate.full_document_id = fullDocumentId;
      if (Object.keys(eventUpdate).length > 0) {
        await supabase
          .from('compliance_events')
          .update(eventUpdate)
          .eq('id', eventId);
      }

      const result = data as any;

      const docResult = await createComplianceDocument({
        eventId,
        eventName,
        eventCategory,
        eventType,
        rideId: rideId || null,
        rideName,
        dueDate: dueDate || format(completionDate, 'yyyy-MM-dd'),
        completionDate,
        completedByUserId: user.id,
        completedByName: completedByName,
        completedByRole: completedByRole,
        notes: notes || undefined,
        evidenceUrls,
        inspectorCompany: inspectorCompany || undefined,
        certificateReference: certificateReference || undefined,
        fullDocumentId,
      });

      setCompletionResult({
        documentId: docResult.documentId,
        documentName: docResult.documentName,
        nextDueDate: result?.next_due_date,
      });

      // Auto-create next annual event if linked document has repeat_annually
      try {
        await maybeCreateRecurringEvent({
          completedEventId: eventId,
          userId: user.id,
        });
      } catch (e) {
        console.warn('Auto-recurrence check failed:', e);
      }

      invalidateComplianceQueries(queryClient);
      onCompleted?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not complete event.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetState = () => {
    setNotes('');
    setInspectorCompany('');
    setCertificateReference('');
    setCompletionDate(new Date());
    evidenceFiles.forEach(ev => { if (ev.preview) URL.revokeObjectURL(ev.preview); });
    setEvidenceFiles([]);
    setCompletionResult(null);
    setOfflineCompleted(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetState();
  };

  const handleViewDocument = () => {
    handleClose();
    if (completionResult?.documentId) {
      openDocumentById({
        documentId: completionResult.documentId,
        navigate,
        sourceComponent: 'MarkCompleteSheet',
        toast,
      });
    } else if (rideId) {
      navigate(`/rides/${rideId}?tab=documents`);
    } else {
      navigate('/documents');
    }
  };

  const handleBackToCompliance = () => {
    handleClose();
  };

  const recurrenceLabel = recurrenceRule
    ? `Every ${recurrenceRule.replace(':', ' ')}`
    : null;

  // ─── Offline success state ───
  if (offlineCompleted) {
    return (
      <Sheet open={open} onOpenChange={() => handleClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[50vh] flex flex-col p-0">
          <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-warning/15 flex items-center justify-center">
              <CloudOff className="h-7 w-7 text-warning" />
            </div>
            <div className="space-y-1">
              <SheetTitle className="text-lg font-semibold text-foreground">Saved Offline</SheetTitle>
              <p className="text-sm text-muted-foreground">{eventName}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Will sync and generate PDF when connection returns.
            </p>
          </div>
          <div className="shrink-0 border-t border-border bg-background px-5 py-4">
            <Button className="w-full" onClick={handleBackToCompliance}>
              Back to Compliance
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ─── Success state ───
  if (completionResult) {
    return (
      <Sheet open={open} onOpenChange={() => handleClose()}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[60vh] flex flex-col p-0">
          <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <div className="space-y-1">
              <SheetTitle className="text-lg font-semibold text-foreground">Marked Complete</SheetTitle>
              <p className="text-sm text-muted-foreground">{eventName}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Document created: <span className="font-medium text-foreground">{completionResult.documentName}</span>
            </p>
            {completionResult.nextDueDate && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 flex items-center gap-2">
                <Repeat className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-xs text-primary font-medium">
                  Next scheduled for {format(new Date(completionResult.nextDueDate), 'd MMM yyyy')}
                </p>
              </div>
            )}
          </div>
          <div className="shrink-0 border-t border-border bg-background px-5 py-4 flex gap-3">
            <Button variant="outline" className="flex-1 gap-1.5" onClick={handleBackToCompliance}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button className="flex-1 gap-1.5" onClick={handleViewDocument}>
              <ExternalLink className="h-4 w-4" />
              View Document
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ─── Form state ───
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] flex flex-col p-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <SheetTitle className="text-base font-semibold text-foreground">Mark Complete</SheetTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1 truncate">{eventName}</p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Completion date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completion Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(completionDate, 'd MMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                <Calendar
                  mode="single"
                  selected={completionDate}
                  onSelect={(date) => { if (date) { setCompletionDate(date); setCalendarOpen(false); } }}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Inspector / Company */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Inspector / Company {isInspectionCategory && <span className="text-destructive">*</span>}
            </Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={inspectorCompany}
                onChange={(e) => setInspectorCompany(e.target.value)}
                placeholder="e.g. Independent Inspector, LEAPS, DMG Technical"
                className="pl-9"
                maxLength={200}
              />
            </div>
          </div>

          {/* Certificate / Report Reference */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Certificate / Report Reference</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={certificateReference}
                onChange={(e) => setCertificateReference(e.target.value)}
                placeholder="Certificate or report number"
                className="pl-9"
                maxLength={100}
              />
            </div>
          </div>

          {/* Evidence */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Evidence (optional)</Label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1 gap-1.5" onClick={handleCameraCapture} disabled={submitting}>
                <Camera className="h-4 w-4" />
                Take Photo
              </Button>
              <Button type="button" variant="outline" size="sm" className="flex-1 gap-1.5" onClick={handleFileUpload} disabled={submitting}>
                <Upload className="h-4 w-4" />
                Upload File
              </Button>
            </div>

            {/* Hidden inputs */}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraChange} />
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" multiple className="hidden" onChange={handleFileChange} />

            {/* Evidence previews */}
            {evidenceFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {evidenceFiles.map((ev, idx) => (
                  <div key={idx} className="relative group">
                    {ev.preview ? (
                      <img src={ev.preview} alt={`Evidence ${idx + 1}`} className="w-16 h-16 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg border border-border bg-muted flex flex-col items-center justify-center gap-0.5">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <span className="text-[8px] text-muted-foreground truncate max-w-[56px]">
                          {ev.file.name.split('.').pop()?.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => removeEvidence(idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Completion details, inspector name, reference number…"
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Recurrence info */}
          {isRecurring && recurrenceLabel && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-2">
              <Repeat className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-xs text-primary font-medium">
                Next occurrence will be auto-created ({recurrenceLabel})
              </p>
            </div>
          )}

          {/* Auto-document info */}
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              A document record will be created automatically in this ride's Documents section.
              {evidenceFiles.filter(f => f.file.type === 'application/pdf').length === 0 &&
                ' A completion certificate PDF will be generated.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button className="flex-1 gap-1.5" onClick={handleConfirm} disabled={submitting}>
            <CheckCircle2 className="h-4 w-4" />
            {submitting ? (evidenceFiles.length > 0 ? 'Uploading…' : 'Completing…') : 'Confirm'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MarkCompleteSheet;
