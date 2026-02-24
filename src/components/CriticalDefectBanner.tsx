import { AlertOctagon, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOpenCriticalDefects } from '@/hooks/useOpenCriticalDefects';

interface CriticalDefectBannerProps {
  rideId: string;
  rideName: string;
  onViewDefects?: () => void;
}

/**
 * Simple red warning banner for Stop Use defects.
 * Shows count + description, with a "View" button. No complex controls.
 */
const CriticalDefectBanner = ({ rideId, rideName, onViewDefects }: CriticalDefectBannerProps) => {
  const { criticalDefects, hasCriticalDefects, isLoading } = useOpenCriticalDefects(rideId);

  if (isLoading || !hasCriticalDefects) return null;

  const latestDefect = criticalDefects[0];

  return (
    <div className="rounded-2xl border-2 border-destructive bg-destructive/5 p-4 space-y-2">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
          <AlertOctagon className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-destructive">
            Stop Use — do not operate
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {criticalDefects.length} open Stop Use defect{criticalDefects.length !== 1 ? 's' : ''}
          </p>
          {latestDefect?.description && (
            <p className="text-xs text-foreground mt-1 line-clamp-2">
              {latestDefect.description}
            </p>
          )}
        </div>
      </div>

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
    </div>
  );
};

export default CriticalDefectBanner;
