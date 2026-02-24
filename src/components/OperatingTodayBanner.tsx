import { CheckCircle, Circle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useDailyStatus } from '@/hooks/useDailyStatus';
import { useOpenCriticalDefects } from '@/hooks/useOpenCriticalDefects';
import { useAppRole } from '@/hooks/useAppRole';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import NotOperatingReasonDialog from '@/components/NotOperatingReasonDialog';

interface OperatingTodayBannerProps {
  rideId: string;
}

const OperatingTodayBanner = ({ rideId }: OperatingTodayBannerProps) => {
  const { isOperating, isLoading, canToggle, toggling, toggleOperating } = useDailyStatus(rideId);
  const { hasCriticalDefects } = useOpenCriticalDefects(rideId);
  const role = useAppRole();
  const { toast } = useToast();
  const [showConfirmOff, setShowConfirmOff] = useState(false);

  const handleToggle = (checked: boolean) => {
    if (!canToggle || toggling) return;
    if (!checked && isOperating) {
      setShowConfirmOff(true);
      return;
    }
    // Block ON if critical defects
    if (checked && !isOperating && hasCriticalDefects) {
      toast({
        title: 'Cannot mark operating',
        description: 'This ride cannot be marked operating while an open critical defect exists.',
        variant: 'destructive',
      });
      return;
    }
    toggleOperating();
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

      <NotOperatingReasonDialog
        open={showConfirmOff}
        onOpenChange={setShowConfirmOff}
        onConfirm={handleConfirmOff}
        disabled={toggling}
        preselectReason={hasCriticalDefects ? 'Critical defect (pre-opening/daily check)' : undefined}
      />
    </>
  );
};

export default OperatingTodayBanner;
