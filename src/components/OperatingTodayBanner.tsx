import { CheckCircle, Circle, AlertOctagon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useDailyStatus } from '@/hooks/useDailyStatus';
import { useOpenCriticalDefects } from '@/hooks/useOpenCriticalDefects';
import { useAppRole } from '@/hooks/useAppRole';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import NotOperatingReasonDialog from '@/components/NotOperatingReasonDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface OperatingTodayBannerProps {
  rideId: string;
}

const OperatingTodayBanner = ({ rideId }: OperatingTodayBannerProps) => {
  const { isOperating, isLoading, canToggle, toggling, toggleOperating } = useDailyStatus(rideId);
  const { hasCriticalDefects } = useOpenCriticalDefects(rideId);
  const role = useAppRole();
  const { toast } = useToast();
  const [showConfirmOff, setShowConfirmOff] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  const handleToggle = (checked: boolean) => {
    if (!canToggle || toggling) return;
    if (!checked && isOperating) {
      setShowConfirmOff(true);
      return;
    }
    // Block ON if critical defects
    if (checked && !isOperating && hasCriticalDefects) {
      if (role === 'controller') {
        setShowOverrideDialog(true);
      } else {
        toast({
          title: 'Cannot mark operating',
          description: 'This ride cannot be marked operating while an open critical defect exists.',
          variant: 'destructive',
        });
      }
      return;
    }
    toggleOperating();
    if (checked) {
      toast({
        title: 'Marked in use today',
        description: 'Daily and pre-opening checks are now due.',
      });
    }
  };

  const handleConfirmOff = (reason: string) => {
    toggleOperating(reason);
    setShowConfirmOff(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-2.5 animate-pulse">
        <div className="h-5 w-5 rounded-full bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
      </div>
    );
  }

  return (
    <>
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors ${
          isOperating
            ? 'border-success/30 bg-success/5'
            : 'border-border bg-muted/30'
        }`}
      >
        {isOperating ? (
          <CheckCircle className="h-4 w-4 text-success shrink-0" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold leading-tight ${isOperating ? 'text-success' : 'text-muted-foreground'}`}>
            {isOperating ? 'Operating Today' : 'Not Operating Today'}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            {isOperating
              ? 'Daily checks are now due.'
              : 'Set this when the ride will be used today.'}
          </p>
        </div>

        {canToggle ? (
          <Switch
            checked={isOperating}
            onCheckedChange={handleToggle}
            disabled={toggling}
            className={`shrink-0 ${isOperating ? 'data-[state=checked]:bg-success' : ''}`}
          />
        ) : (
          <span className={`text-xs font-semibold shrink-0 ${isOperating ? 'text-success' : 'text-muted-foreground'}`}>
            {isOperating ? 'ON' : 'OFF'}
          </span>
        )}
      </div>

      <NotOperatingReasonDialog
        open={showConfirmOff}
        onOpenChange={setShowConfirmOff}
        onConfirm={handleConfirmOff}
        disabled={toggling}
        preselectReason={hasCriticalDefects ? 'Critical defect (pre-opening/daily check)' : undefined}
      />

      {/* Override dialog — controller/manager only when critical defect blocks ON */}
      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <AlertOctagon className="h-5 w-5 text-destructive" />
              <DialogTitle className="text-destructive">Override — Open critical defect</DialogTitle>
            </div>
            <DialogDescription>
              You are overriding an open critical defect and marking this ride operating. This action must be justified and will be logged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-sm font-medium">Reason for override *</Label>
            <Textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Explain why the ride can operate despite the critical defect…"
              rows={2}
              className="text-sm"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowOverrideDialog(false); setOverrideReason(''); }}>
              Cancel
            </Button>
            <Button onClick={() => {
              if (!overrideReason.trim()) return;
              toggleOperating(`Override: ${overrideReason.trim()}`);
              setShowOverrideDialog(false);
              setOverrideReason('');
            }} disabled={toggling || !overrideReason.trim()} className="bg-amber-600 hover:bg-amber-700 text-white">
              {toggling ? 'Updating…' : 'Override and mark operating'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OperatingTodayBanner;
