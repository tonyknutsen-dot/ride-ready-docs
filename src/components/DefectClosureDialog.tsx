import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle } from 'lucide-react';
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

/**
 * Simple defect closure dialog.
 * For Stop Use defects, encourages (but doesn't require) closure notes.
 */
const DefectClosureDialog = ({
  open, onOpenChange, defect, rideName, onDefectUpdated,
}: DefectClosureDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const isStopUse = defect?.severity === 'stop_operation';

  const handleClose = () => {
    setNotes('');
    onOpenChange(false);
  };

  const handleCloseDefect = async () => {
    if (!defect) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('defects')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.email || null,
          resolution_notes: notes.trim() || null,
        })
        .eq('id', defect.id);

      if (error) throw error;

      toast({
        title: 'Defect closed',
        description: `Defect on ${rideName} has been closed.`,
      });

      // Refresh related queries
      queryClient.invalidateQueries({ queryKey: ['open-critical-defects'] });
      queryClient.invalidateQueries({ queryKey: ['all-rides-critical-defects'] });
      queryClient.invalidateQueries({ queryKey: ['needs-attention'] });

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
            <CheckCircle className="h-5 w-5 text-success" />
            Close Defect
          </DialogTitle>
          <DialogDescription>
            Close this defect on <span className="font-medium text-foreground">{rideName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Defect summary */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-foreground line-clamp-3">{defect.description}</p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="closure-notes">
              Closure notes{isStopUse ? ' (recommended)' : ' (optional)'}
            </Label>
            <Textarea
              id="closure-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isStopUse
                ? 'What repair or action was taken?'
                : 'Any notes about the fix...'}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={updating}>
            Cancel
          </Button>
          <Button onClick={handleCloseDefect} disabled={updating}>
            {updating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Close Defect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DefectClosureDialog;
