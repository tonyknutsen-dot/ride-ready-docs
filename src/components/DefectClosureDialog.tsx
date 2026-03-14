import { useState, useRef, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, CheckCircle, Camera, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useBillingWriteGuard } from '@/hooks/useBillingWriteGuard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { compressImage } from '@/utils/imageCompression';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Defect {
  id: string;
  description: string;
  severity: string;
  status: string;
  ride_id: string;
  photo_paths?: string[];
}

interface DefectClosureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defect: Defect | null;
  rideName: string;
  onDefectUpdated: () => void;
}

const SEVERITY_DISPLAY: Record<string, { label: string; variant: 'destructive' | 'default' | 'secondary' | 'outline' }> = {
  stop_operation: { label: 'Stop Use', variant: 'destructive' },
  urgent: { label: 'Important', variant: 'default' },
  non_urgent: { label: 'Low', variant: 'secondary' },
};

const STATUS_DISPLAY: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  monitoring: 'Monitoring',
};

const CLOSURE_REASONS = [
  { value: 'repaired', label: 'Repaired' },
  { value: 'adjusted', label: 'Adjusted / tightened' },
  { value: 'replaced_part', label: 'Replaced part' },
  { value: 'no_fault_found', label: 'Checked and no fault found' },
  { value: 'cleaned_reset', label: 'Cleaned / reset' },
  { value: 'temporary_action', label: 'Temporary action taken' },
  { value: 'duplicate', label: 'Duplicate / entered in error' },
  { value: 'other', label: 'Other' },
] as const;

/**
 * Defect closure dialog — captures structured resolution details.
 * Requires both a closure reason (dropdown) and action taken (free text).
 */
const DefectClosureDialog = ({
  open, onOpenChange, defect, rideName, onDefectUpdated,
}: DefectClosureDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [closureReason, setClosureReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [closedByName, setClosedByName] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);

  // Auto-fill closed-by with profile display name
  useEffect(() => {
    if (!open || !user?.id) return;
    const fetchName = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('controller_name, showmen_name, company_name')
        .eq('user_id', user.id)
        .maybeSingle();
      const displayName = data?.controller_name || data?.showmen_name || '';
      if (displayName && !closedByName) {
        setClosedByName(displayName);
      }
    };
    fetchName();
  }, [open, user?.id]);

  const handleClose = () => {
    setClosureReason('');
    setOtherReason('');
    setActionTaken('');
    setClosedByName('');
    setAdditionalNotes('');
    setEvidenceFiles([]);
    setEvidencePreviews([]);
    onOpenChange(false);
  };

  const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newFiles = [...evidenceFiles, ...files].slice(0, 4);
    setEvidenceFiles(newFiles);
    const previews = newFiles.map(f => URL.createObjectURL(f));
    setEvidencePreviews(prev => {
      prev.forEach(u => URL.revokeObjectURL(u));
      return previews;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(evidencePreviews[idx]);
    setEvidenceFiles(prev => prev.filter((_, i) => i !== idx));
    setEvidencePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCloseDefect = async () => {
    if (!defect) return;

    if (!closureReason) {
      toast({ title: 'Closure reason is required', description: 'Please select why this defect is being closed.', variant: 'destructive' });
      return;
    }
    if (closureReason === 'other' && !otherReason.trim()) {
      toast({ title: 'Please specify the reason', description: 'An explanation is required when selecting "Other".', variant: 'destructive' });
      return;
    }
    if (!actionTaken.trim()) {
      toast({ title: 'Action taken is required', description: 'Please describe what action was taken.', variant: 'destructive' });
      return;
    }

    setUpdating(true);
    try {
      const uploadedPaths: string[] = [];
      for (const file of evidenceFiles) {
        const compressed = await compressImage(file);
        const ext = file.name.split('.').pop() || 'jpg';
        const filePath = `${user?.id}/${defect.id}/closure-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('defect-photos')
          .upload(filePath, compressed);
        if (!uploadError) uploadedPaths.push(filePath);
      }

      const existingPaths = defect.photo_paths || [];
      const allPaths = [...existingPaths, ...uploadedPaths];
      const resolvedByValue = closedByName.trim() || user?.email || null;

      // Build structured resolution_notes
      const reasonLabel = closureReason === 'other'
        ? `Other: ${otherReason.trim()}`
        : (CLOSURE_REASONS.find(r => r.value === closureReason)?.label || closureReason);
      let fullNotes = `Closure reason: ${reasonLabel}\n\nAction taken: ${actionTaken.trim()}`;
      if (additionalNotes.trim()) {
        fullNotes += `\n\nAdditional notes: ${additionalNotes.trim()}`;
      }

      const { error } = await supabase
        .from('defects')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedByValue,
          resolution_notes: fullNotes,
          ...(uploadedPaths.length > 0 ? { photo_paths: allPaths } : {}),
        })
        .eq('id', defect.id);

      if (error) throw error;

      toast({ title: 'Defect closed', description: `Defect on ${rideName} has been closed.` });

      queryClient.invalidateQueries({ queryKey: ['open-critical-defects'] });
      queryClient.invalidateQueries({ queryKey: ['all-rides-critical-defects'] });
      queryClient.invalidateQueries({ queryKey: ['needs-attention'] });
      queryClient.invalidateQueries({ queryKey: ['defect-register'] });
      queryClient.invalidateQueries({ queryKey: ['all-rides-open-defects'] });

      onDefectUpdated();
      handleClose();
    } catch (error: any) {
      console.error('Error closing defect:', error);
      toast({ title: 'Error', description: 'Failed to close defect', variant: 'destructive' });
    } finally {
      setUpdating(false);
    }
  };

  if (!defect) return null;

  const sevDisplay = SEVERITY_DISPLAY[defect.severity] || SEVERITY_DISPLAY.non_urgent;
  const statusDisplay = STATUS_DISPLAY[defect.status] || defect.status;
  const canSubmit = !!closureReason && !!actionTaken.trim() && (closureReason !== 'other' || !!otherReason.trim());

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md max-h-[85dvh] flex flex-col p-0 gap-0">
        <div className="px-6 pt-6 pb-3 shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              Close Defect
            </DialogTitle>
            <DialogDescription>
              Record the closure reason and action taken before closing this defect.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="space-y-3 py-1">
            {/* ── Context ── */}
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">Equipment</span>
                <span className="text-[11px] font-semibold text-foreground truncate max-w-[60%] text-right">{rideName}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">Severity</span>
                <Badge variant={sevDisplay.variant} className="text-[10px] h-[18px] px-1.5">
                  {sevDisplay.label}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">Status</span>
                <span className="text-[11px] font-medium text-foreground">{statusDisplay}</span>
              </div>
              <Separator className="!my-1.5" />
              <p className="text-[11px] text-foreground leading-relaxed line-clamp-2">{defect.description}</p>
            </div>

            {/* ── Closure reason (required dropdown) ── */}
            <div className="space-y-1">
              <Label htmlFor="closure-reason" className="text-xs font-semibold">
                Closure reason <span className="text-destructive">*</span>
              </Label>
              <Select value={closureReason} onValueChange={setClosureReason}>
                <SelectTrigger id="closure-reason" className="h-10 rounded-lg">
                  <SelectValue placeholder="Select a reason…" />
                </SelectTrigger>
                <SelectContent>
                  {CLOSURE_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Other reason explanation (conditionally required) ── */}
            {closureReason === 'other' && (
              <div className="space-y-1">
                <Label htmlFor="other-reason" className="text-xs font-semibold">
                  Specify closure reason <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="other-reason"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Enter your reason…"
                  className="h-10 rounded-lg"
                  onFocus={(e) => requestAnimationFrame(() => setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120))}
                />
                <p className="text-[10px] text-muted-foreground">Describe what "Other" means</p>
              </div>
            )}

            {/* ── Action taken / details (required free text) ── */}
            <div className="space-y-1">
              <Label htmlFor="action-taken" className="text-xs font-semibold">
                Action taken / details <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="action-taken"
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                placeholder="Describe what was physically done — e.g. replaced bolt, retightened bearing housing…"
                rows={2}
                className="rounded-lg"
                onFocus={(e) => requestAnimationFrame(() => setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120))}
              />
              <p className="text-[10px] text-muted-foreground">What was done before closing this defect</p>
            </div>

            {/* ── Closed by ── */}
            <div className="space-y-1">
              <Label htmlFor="closed-by-name" className="text-xs font-semibold">
                Closed by
              </Label>
              <Input
                id="closed-by-name"
                value={closedByName}
                onChange={(e) => setClosedByName(e.target.value)}
                placeholder={user?.email || 'Your name'}
                className="h-10 rounded-lg"
                onFocus={(e) => requestAnimationFrame(() => setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120))}
              />
              <p className="text-[10px] text-muted-foreground">
                {closedByName ? 'Defaults to your account name' : 'Will use your account email if left blank'}
              </p>
            </div>

            {/* ── Additional notes (optional) ── */}
            <div className="space-y-1">
              <Label htmlFor="additional-notes" className="text-xs font-semibold">
                Additional notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="additional-notes"
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Part numbers, follow-up actions, warranty info…"
                rows={2}
                className="rounded-lg"
                onFocus={(e) => requestAnimationFrame(() => setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120))}
              />
            </div>

            {/* ── Evidence photos (optional) ── */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Evidence photos <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              {evidencePreviews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {evidencePreviews.map((url, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                      <img src={url} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {evidenceFiles.length < 4 && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-lg text-xs h-9"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Take photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-lg text-xs h-9"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload
                  </Button>
                </div>
              )}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleAddPhotos}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleAddPhotos}
              />
            </div>

            {/* Auto-timestamp note */}
            <p className="text-[10px] text-muted-foreground italic">
              Closure date and time will be recorded automatically.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))] flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-2 shrink-0">
          <Button type="button" variant="outline" onClick={handleClose} disabled={updating} className="rounded-lg">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCloseDefect}
            disabled={updating || !canSubmit}
            className="rounded-lg gap-1.5"
          >
            {updating && <Loader2 className="h-4 w-4 animate-spin" />}
            Close Defect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DefectClosureDialog;
