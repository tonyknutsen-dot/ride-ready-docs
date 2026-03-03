import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, AlertOctagon, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

interface Defect {
  id: string;
  description: string;
  severity: string;
  status: string;
  ride_id: string;
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
 * For Stop Use defects, requires closure notes.
 */
const DefectClosureDialog = ({
  open, onOpenChange, defect, rideName, onDefectUpdated,
}: DefectClosureDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState('');
  const [closedByName, setClosedByName] = useState('');
  const [updating, setUpdating] = useState(false);

  const isStopUse = defect?.severity === 'stop_operation';
  const sevInfo = SEVERITY_LABELS[defect?.severity || 'non_urgent'] || SEVERITY_LABELS.non_urgent;

  const handleClose = () => {
    setNotes('');
    setClosedByName('');
    onOpenChange(false);
  };

  const handleCloseDefect = async () => {
    if (!defect) return;

    if (isStopUse && !notes.trim()) {
      toast({
        title: 'Notes required',
        description: 'Stop-use defects require closure notes describing the repair.',
        variant: 'destructive',
      });
      return;
    }

    setUpdating(true);
    try {
      const resolvedByValue = closedByName.trim() || user?.email || null;

      const { error } = await supabase
        .from('defects')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedByValue,
          resolution_notes: notes.trim() || null,
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
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            Close Defect
          </DialogTitle>
          <DialogDescription>
            Confirm closure and record what action was taken.
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
              className="h-10 rounded-xl"
            />
            <p className="text-[10px] text-muted-foreground">Leave blank to use your account email</p>
          </div>

          {/* Repair / closure notes */}
          <div className="space-y-1.5">
            <Label htmlFor="closure-notes" className="text-xs font-semibold">
              Repair / closure notes{isStopUse ? ' *' : ''}
            </Label>
            <Textarea
              id="closure-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isStopUse
                ? 'Describe the repair or corrective action taken...'
                : 'Any notes about the fix...'}
              rows={3}
              className="rounded-xl"
            />
            {isStopUse && (
              <p className="text-[10px] text-destructive font-medium">
                Stop-use defects require closure notes for compliance
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={updating} className="rounded-lg">
            Cancel
          </Button>
          <Button
            onClick={handleCloseDefect}
            disabled={updating}
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
