import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CheckCircle2, Calendar as CalendarIcon, Repeat, Camera, Upload, X, FileText, Image as ImageIcon, ArrowLeft, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { compressImage, isLikelyCameraPhoto } from '@/utils/imageCompression';
import { createComplianceDocument } from '@/utils/complianceDocumentCreator';

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [completionDate, setCompletionDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [completionResult, setCompletionResult] = useState<CompletionResult | null>(null);

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

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Upload evidence
      const evidenceUrls = await uploadEvidence();

      // 2. Complete the event (RPC)
      const { data, error } = await supabase.rpc('complete_event', {
        p_event_id: eventId,
        p_completion_date: format(completionDate, 'yyyy-MM-dd'),
        p_completion_notes: notes || null,
        p_evidence_urls: evidenceUrls,
      });
      if (error) throw error;

      const result = data as any;

      // 3. Auto-create document record
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
        notes: notes || undefined,
        evidenceUrls,
      });

      // 4. Show success state
      setCompletionResult({
        documentId: docResult.documentId,
        documentName: docResult.documentName,
        nextDueDate: result?.next_due_date,
      });

      queryClient.invalidateQueries({ queryKey: ['compliance'] });
      onCompleted?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not complete event.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const resetState = () => {
    setNotes('');
    setCompletionDate(new Date());
    evidenceFiles.forEach(ev => { if (ev.preview) URL.revokeObjectURL(ev.preview); });
    setEvidenceFiles([]);
    setCompletionResult(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetState();
  };

  const handleViewDocument = () => {
    handleClose();
    if (rideId) {
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
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] flex flex-col p-0">
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
        <div className="shrink-0 border-t border-border bg-background px-5 py-4 flex gap-3">
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
