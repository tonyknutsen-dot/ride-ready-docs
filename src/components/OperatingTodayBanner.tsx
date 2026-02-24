import { CheckCircle, Circle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useDailyStatus } from '@/hooks/useDailyStatus';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface OperatingTodayBannerProps {
  rideId: string;
}

const OperatingTodayBanner = ({ rideId }: OperatingTodayBannerProps) => {
  const { isOperating, isLoading, canToggle, toggling, toggleOperating } = useDailyStatus(rideId);
  const [showConfirmOff, setShowConfirmOff] = useState(false);
  const [reason, setReason] = useState('');

  const handleToggle = (checked: boolean) => {
    if (!canToggle || toggling) return;
    if (!checked && isOperating) {
      setShowConfirmOff(true);
      return;
    }
    toggleOperating();
  };

  const handleConfirmOff = () => {
    toggleOperating(reason.trim() || undefined);
    setShowConfirmOff(false);
    setReason('');
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
            Status shared with Ride Home page.
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

      {/* Confirm OFF modal — same logic as OperatingTodayCard */}
      <Dialog open={showConfirmOff} onOpenChange={setShowConfirmOff}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark ride as NOT operating today?</DialogTitle>
            <DialogDescription>
              This will pause Daily check due/overdue tracking for today.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">Reason (optional)</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Weather, Breakdown, Staffing"
              className="h-10"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowConfirmOff(false); setReason(''); }}>
              Cancel
            </Button>
            <Button onClick={handleConfirmOff} disabled={toggling}>
              {toggling ? 'Updating…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OperatingTodayBanner;
