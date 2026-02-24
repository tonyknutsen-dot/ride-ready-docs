import { AlertOctagon, Wrench, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useOpenCriticalDefects } from '@/hooks/useOpenCriticalDefects';
import { useDailyStatus } from '@/hooks/useDailyStatus';
import { format } from 'date-fns';

interface CriticalDefectBannerProps {
  rideId: string;
  rideName: string;
  onViewDefects?: () => void;
}

const CriticalDefectBanner = ({ rideId, rideName, onViewDefects }: CriticalDefectBannerProps) => {
  const { criticalDefects, hasCriticalDefects, isLoading } = useOpenCriticalDefects(rideId);
  const { isOperating, canToggle, toggleOperating, toggling } = useDailyStatus(rideId);
  const navigate = useNavigate();

  if (isLoading || !hasCriticalDefects) return null;

  const latestDefect = criticalDefects[0];
  const reportedTime = latestDefect ? format(new Date(latestDefect.reported_at), 'dd MMM HH:mm') : '';

  return (
    <div className="rounded-2xl border-2 border-destructive bg-destructive/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
          <AlertOctagon className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-destructive">
            Critical defect recorded — ride must not operate
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {criticalDefects.length} open critical defect{criticalDefects.length !== 1 ? 's' : ''}
            {reportedTime ? ` • Reported ${reportedTime}` : ''}
          </p>
          {latestDefect?.description && (
            <p className="text-xs text-foreground mt-1 line-clamp-2">
              {latestDefect.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {onViewDefects && (
          <Button
            size="sm"
            variant="destructive"
            className="gap-1.5 text-xs"
            onClick={onViewDefects}
          >
            <Eye className="h-3.5 w-3.5" />
            View defect{criticalDefects.length !== 1 ? 's' : ''}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => navigate(`/maintenance?rideId=${rideId}`)}
        >
          <Wrench className="h-3.5 w-3.5" />
          Go to maintenance
        </Button>
        {isOperating && canToggle && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
            disabled={toggling}
            onClick={() => toggleOperating('Critical defect — marked not operating')}
          >
            {toggling ? '…' : 'Mark not operating'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default CriticalDefectBanner;
