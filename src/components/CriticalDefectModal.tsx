import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertOctagon, Wrench, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDailyStatus } from '@/hooks/useDailyStatus';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useQueryClient } from '@tanstack/react-query';

interface CriticalDefectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
  rideName: string;
  checkFrequency?: string;
  onContinue?: () => void;
}

const CriticalDefectModal = ({
  open,
  onOpenChange,
  rideId,
  rideName,
  checkFrequency,
  onContinue,
}: CriticalDefectModalProps) => {
  const navigate = useNavigate();
  const { isOperating, toggleOperating, canToggle } = useDailyStatus(rideId);
  const { toast } = useToast();
  const { effectiveUserId } = useEffectiveUserId();
  const queryClient = useQueryClient();
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [keepOperatingReason, setKeepOperatingReason] = useState('');
  const [submittingReason, setSubmittingReason] = useState(false);

  const frequencyLabel = checkFrequency === 'preopening' ? 'pre-opening' : checkFrequency || 'daily';

  const handleMarkNotOperating = async () => {
    if (canToggle && isOperating) {
      await toggleOperating('Critical defect recorded');
    }
    // Log activity
    if (effectiveUserId) {
      await supabase.from('ride_daily_status_log' as any).insert({
        ride_id: rideId,
        status_date: new Date().toISOString().split('T')[0],
        changed_by: effectiveUserId,
        changed_by_name: 'System',
        new_is_operating: false,
        reason: 'Critical defect recorded — ride marked not operating',
      } as any);
    }
    queryClient.invalidateQueries({ queryKey: ['ride-daily-status'] });
    queryClient.invalidateQueries({ queryKey: ['all-rides-daily-status'] });
    onOpenChange(false);
    onContinue?.();
  };

  const handleCreateMaintenance = () => {
    onOpenChange(false);
    navigate(`/maintenance?rideId=${rideId}`);
  };

  const handleKeepOperating = async () => {
    if (!keepOperatingReason.trim()) {
      toast({ title: 'Reason required', description: 'You must provide a reason for keeping the ride operating with a critical defect.', variant: 'destructive' });
      return;
    }
    setSubmittingReason(true);
    try {
      // Log the decision to keep operating despite critical defect
      if (effectiveUserId) {
        await supabase.from('ride_daily_status_log' as any).insert({
          ride_id: rideId,
          status_date: new Date().toISOString().split('T')[0],
          changed_by: effectiveUserId,
          changed_by_name: 'Decision log',
          new_is_operating: true,
          reason: `Critical defect: chose to keep operating — ${keepOperatingReason.trim()}`,
        } as any);
      }
      toast({ title: 'Decision logged', description: 'Your decision to keep operating has been recorded.' });
      onOpenChange(false);
      onContinue?.();
    } finally {
      setSubmittingReason(false);
    }
  };

  const handleContinueCheck = () => {
    onOpenChange(false);
    onContinue?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertOctagon className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-destructive text-lg">Critical defect recorded</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-sm leading-relaxed">
            A critical defect has been recorded during a {frequencyLabel} check on <strong>{rideName}</strong>. This ride should not operate until the defect is assessed/resolved and released in accordance with site procedure.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {/* Mark not operating — recommended */}
          {isOperating && canToggle && (
            <Button
              variant="destructive"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={handleMarkNotOperating}
            >
              <AlertOctagon className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <p className="font-semibold">Mark ride not operating today</p>
                <p className="text-xs opacity-80 font-normal">Recommended — prevents further use until resolved</p>
              </div>
            </Button>
          )}

          {/* Create maintenance task */}
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={handleCreateMaintenance}
          >
            <Wrench className="h-5 w-5 shrink-0" />
            <div className="text-left">
              <p className="font-semibold">Create maintenance task now</p>
              <p className="text-xs text-muted-foreground font-normal">Log a repair task linked to this defect</p>
            </div>
          </Button>

          {/* Continue check */}
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={handleContinueCheck}
          >
            <PlayCircle className="h-5 w-5 shrink-0" />
            <div className="text-left">
              <p className="font-semibold">Continue check</p>
              <p className="text-xs text-muted-foreground font-normal">Continue completing the current check</p>
            </div>
          </Button>

          {/* Keep operating (requires reason) — only for controllers/managers */}
          {isOperating && canToggle && !showReasonInput && (
            <button
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1"
              onClick={() => setShowReasonInput(true)}
            >
              Keep ride operating (requires reason)
            </button>
          )}

          {showReasonInput && (
            <div className="border border-amber-300 rounded-lg p-3 bg-amber-50 space-y-2">
              <Label className="text-xs font-semibold text-amber-900">
                Reason for keeping ride operating *
              </Label>
              <Textarea
                value={keepOperatingReason}
                onChange={(e) => setKeepOperatingReason(e.target.value)}
                placeholder="Explain why the ride can continue operating despite the critical defect..."
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowReasonInput(false); setKeepOperatingReason(''); }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleKeepOperating}
                  disabled={submittingReason || !keepOperatingReason.trim()}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Confirm & log decision
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CriticalDefectModal;
