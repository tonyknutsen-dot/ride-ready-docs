import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlayCircle, PauseCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAppRole } from '@/hooks/useAppRole';
import { useDailyStatus } from '@/hooks/useDailyStatus';
import { useQueryClient } from '@tanstack/react-query';

type DefectSeverity = 'non_urgent' | 'urgent' | 'stop_operation';
type DefectStatus = 'open' | 'acknowledged' | 'in_progress' | 'awaiting_review' | 'resolved';

interface Defect {
  id: string;
  description: string;
  severity: DefectSeverity;
  status: DefectStatus;
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
 * Dialog for updating defect status.
 * For critical / stop_operation defects being resolved, requires a closure summary.
 * After resolving a critical defect on a non-operating ride, prompts to mark operating.
 */
const DefectClosureDialog = ({
  open, onOpenChange, defect, rideName, onDefectUpdated,
}: DefectClosureDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { logEvent } = useAuditLog();
  const role = useAppRole();
  const queryClient = useQueryClient();

  const [newStatus, setNewStatus] = useState<DefectStatus>('resolved');
  const [closureAction, setClosureAction] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvedBy, setResolvedBy] = useState('');
  const [updating, setUpdating] = useState(false);

  // Post-closure prompt state
  const [showOperatingPrompt, setShowOperatingPrompt] = useState(false);

  const isCritical = defect?.severity === 'stop_operation';
  const isResolving = newStatus === 'resolved';
  const isResolvingCritical = isCritical && isResolving;

  // Use daily status for the ride to check operating state and allow toggling
  const { isOperating, canToggle, toggleOperating, toggling } = useDailyStatus(defect?.ride_id || '');

  const resetForm = () => {
    setNewStatus('resolved');
    setClosureAction('');
    setResolutionNotes('');
    setResolvedBy('');
    setShowOperatingPrompt(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleUpdateStatus = async () => {
    if (!defect) return;

    // Validate required fields for critical defect closure
    if (isResolvingCritical && !closureAction.trim()) {
      toast({
        title: 'Closure action required',
        description: 'Please describe the repair/action taken to close this critical defect.',
        variant: 'destructive',
      });
      return;
    }

    setUpdating(true);
    try {
      const updateData: Record<string, unknown> = { status: newStatus };

      if (isResolving) {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = resolvedBy.trim() || null;
        updateData.resolution_notes = [
          closureAction.trim() ? `Action: ${closureAction.trim()}` : '',
          resolutionNotes.trim() || '',
        ].filter(Boolean).join('\n') || null;
      }

      const { error } = await supabase
        .from('defects')
        .update(updateData)
        .eq('id', defect.id);

      if (error) throw error;

      // Audit log
      const oldStatus = defect.status;
      logEvent('update', 'defect', defect.id, {
        ride: rideName,
        from_status: oldStatus,
        to_status: newStatus,
        severity: defect.severity,
        ...(isResolving && closureAction.trim() ? { closure_action: closureAction.trim().substring(0, 200) } : {}),
      });

      toast({
        title: 'Defect updated',
        description: isResolving
          ? 'Defect marked as resolved'
          : `Status changed to ${newStatus.replace('_', ' ')}`,
      });

      // Invalidate related queries so dashboard/banner/counts refresh
      queryClient.invalidateQueries({ queryKey: ['open-critical-defects'] });
      queryClient.invalidateQueries({ queryKey: ['all-rides-critical-defects'] });
      queryClient.invalidateQueries({ queryKey: ['operations-overview'] });

      onDefectUpdated();

      // If we just resolved a critical defect and the ride is NOT operating, show the prompt
      if (isResolvingCritical && !isOperating) {
        setShowOperatingPrompt(true);
      } else {
        handleClose();
      }
    } catch (error: any) {
      console.error('Error updating defect:', error);
      toast({
        title: 'Error',
        description: 'Failed to update defect',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkOperating = async () => {
    if (!canToggle || !defect) return;
    await toggleOperating(`Critical defect resolved — returning to service`);
    logEvent('update', 'ride', defect.ride_id, {
      ride: rideName,
      action: 'marked_operating_after_defect_closure',
      defect_id: defect.id,
    });
    handleClose();
  };

  const handleKeepNotOperating = () => {
    handleClose();
  };

  if (!defect) return null;

  // ── Post-closure operating prompt ──
  if (showOperatingPrompt) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Critical Defect Closed
            </DialogTitle>
            <DialogDescription>
              The critical defect on <span className="font-medium text-foreground">{rideName}</span> has been resolved. This ride is currently <span className="font-medium text-foreground">Not Operating Today</span>.
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm text-foreground">
            Do you want to mark this ride as operating today?
          </p>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleKeepNotOperating}
              className="gap-1.5"
            >
              <PauseCircle className="h-4 w-4" />
              Keep not operating
            </Button>
            {canToggle ? (
              <Button
                onClick={handleMarkOperating}
                disabled={toggling}
                className="gap-1.5"
              >
                {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Mark operating today
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Only Controllers or Managers can mark this ride operating.
              </p>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Main status update dialog ──
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Defect Status</DialogTitle>
          <DialogDescription>
            {isCritical
              ? 'Critical/stop-operation defect — closure requires a repair summary.'
              : 'Change the status of this defect.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status selector */}
          <div className="space-y-2">
            <Label>New Status</Label>
            <Select
              value={newStatus}
              onValueChange={(v) => setNewStatus(v as DefectStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="awaiting_review">Awaiting Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Resolved-specific fields */}
          {isResolving && (
            <>
              {/* Closure action — required for critical */}
              <div className="space-y-2">
                <Label htmlFor="closure-action">
                  Repair / Closure Action{isCritical ? ' *' : ''}
                </Label>
                <Textarea
                  id="closure-action"
                  value={closureAction}
                  onChange={(e) => setClosureAction(e.target.value)}
                  placeholder={isCritical
                    ? 'Describe the repair or corrective action taken (required)'
                    : 'Describe what was done to fix the defect'}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resolved-by">Closed By</Label>
                <Input
                  id="resolved-by"
                  value={resolvedBy}
                  onChange={(e) => setResolvedBy(e.target.value)}
                  placeholder="Name of person who performed the repair"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resolution-notes">Additional Notes</Label>
                <Textarea
                  id="resolution-notes"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Any additional comments or observations"
                  rows={2}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={updating}>
            Cancel
          </Button>
          <Button onClick={handleUpdateStatus} disabled={updating}>
            {updating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isResolving ? 'Close Defect' : 'Update Status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DefectClosureDialog;
