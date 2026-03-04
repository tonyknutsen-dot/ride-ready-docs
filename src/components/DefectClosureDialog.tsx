import { useState, useRef, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, ShieldAlert, Camera, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { compressImage } from '@/utils/imageCompression';

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

const SEVERITY_LABELS: Record<string, { operational: string; class: string }> = {
  stop_operation: { operational: 'Do not operate', class: 'bg-destructive/10 text-destructive border-destructive/30' },
  urgent: { operational: 'Repair required', class: 'bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800/40' },
  non_urgent: { operational: 'Monitor', class: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/40' },
};

/**
 * Defect closure dialog — captures resolution details.
 * Closure reason/action is required for ALL severities.
 */
const DefectClosureDialog = ({
  open, onOpenChange, defect, rideName, onDefectUpdated,
}: DefectClosureDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const isStopUse = defect?.severity === 'stop_operation';
  const sevInfo = SEVERITY_LABELS[defect?.severity || 'non_urgent'] || SEVERITY_LABELS.non_urgent;

  const handleClose = () => {
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

    if (!actionTaken.trim()) {
      toast({
        title: 'Action taken is required',
        description: 'Please describe what action was taken to close this defect.',
        variant: 'destructive',
      });
      return;
    }

    setUpdating(true);
    try {
      // Upload closure evidence photos if any
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

      // Combine existing photo_paths with closure evidence
      const existingPaths = defect.photo_paths || [];
      const allPaths = [...existingPaths, ...uploadedPaths];

      const resolvedByValue = closedByName.trim() || user?.email || null;

      // Combine action taken + additional notes into resolution_notes
      let fullNotes = actionTaken.trim();
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

      toast({
        title: 'Defect closed',
        description: `Defect on ${rideName} has been closed.`,
      });

      queryClient.invalidateQueries({ queryKey: ['open-critical-defects'] });
      queryClient.invalidateQueries({ queryKey: ['all-rides-critical-defects'] });
      queryClient.invalidateQueries({ queryKey: ['needs-attention'] });
      queryClient.invalidateQueries({ queryKey: ['defect-register'] });
      queryClient.invalidateQueries({ queryKey: ['all-rides-open-defects'] });

      onDefectUpdated();
      handleClose();
    } catch (error: any) {
      console.error('Error closing defect:', error);
      toast({
        title: 'Error',
        description: 'Failed to close defect',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  if (!defect) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            Close Defect
          </DialogTitle>
          <DialogDescription>
            Record what action was taken before closing this defect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Operational status reminder */}
          <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border ${sevInfo.class}`}>
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <div>
              <p className="text-xs font-bold">{sevInfo.operational}</p>
              <p className="text-[11px] opacity-75">Closing this defect on {rideName}</p>
            </div>
          </div>

          {/* Defect summary */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border">
            <p className="text-sm text-foreground leading-relaxed line-clamp-3">{defect.description}</p>
          </div>

          {/* Action taken — required for ALL severities */}
          <div className="space-y-1.5">
            <Label htmlFor="action-taken" className="text-xs font-semibold">
              Action taken / reason for closure <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="action-taken"
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              placeholder="Describe the repair, corrective action, or reason for closure..."
              rows={3}
              className="rounded-xl"
            />
            <p className="text-[10px] text-muted-foreground">
              Required for all defects — this will appear on the defect record
            </p>
          </div>

          {/* Closed by */}
          <div className="space-y-1.5">
            <Label htmlFor="closed-by-name" className="text-xs font-semibold">
              Closed by
            </Label>
            <Input
              id="closed-by-name"
              value={closedByName}
              onChange={(e) => setClosedByName(e.target.value)}
              placeholder={user?.email || 'Your name'}
              className="h-11 rounded-xl"
            />
            <p className="text-[10px] text-muted-foreground">Leave blank to use your account email</p>
          </div>

          {/* Additional notes — optional */}
          <div className="space-y-1.5">
            <Label htmlFor="additional-notes" className="text-xs font-semibold">
              Additional notes <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="additional-notes"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Any further details, part numbers, follow-up actions..."
              rows={2}
              className="rounded-xl"
            />
          </div>

          {/* Evidence photos — optional */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Evidence photos <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
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
              {evidenceFiles.length < 4 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Camera className="h-4 w-4" />
                  <span className="text-[9px]">Add</span>
                </button>
              )}
            </div>
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

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={updating} className="rounded-lg">
            Cancel
          </Button>
          <Button
            onClick={handleCloseDefect}
            disabled={updating || !actionTaken.trim()}
            className="rounded-lg gap-1.5"
          >
            {updating && <Loader2 className="h-4 w-4 animate-spin" />}
            Close Defect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DefectClosureDialog;