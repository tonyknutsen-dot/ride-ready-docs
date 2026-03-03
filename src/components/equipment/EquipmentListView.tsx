import { AlertOctagon, AlertTriangle, ChevronRight, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Ride } from '@/types/ride';

interface RideStats {
  docCount: number;
  checkCount: number;
  nextDue: string | null;
}

interface EquipmentListViewProps {
  rides: Ride[];
  rideStats: Record<string, RideStats>;
  criticalDefectsMap: Map<string, number> | undefined;
  openDefectsMap?: Map<string, { critical: number; nonCritical: number }> | undefined;
  onSelectRide: (ride: Ride) => void;
}

const EquipmentListView = ({ rides, rideStats, criticalDefectsMap, openDefectsMap, onSelectRide }: EquipmentListViewProps) => {
  return (
    <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
      {rides.map((ride) => {
        const defects = openDefectsMap?.get(ride.id);
        const hasCritical = (defects?.critical ?? 0) > 0;
        const hasNonCritical = (defects?.nonCritical ?? 0) > 0;
        const stats = rideStats[ride.id];
        const hasDue = !!stats?.nextDue;

        return (
          <button
            key={ride.id}
            onClick={() => onSelectRide(ride)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-3 sm:px-4 sm:py-3 text-left transition-colors hover:bg-muted/50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              hasCritical && 'border-l-4 border-l-destructive bg-destructive/5',
              !hasCritical && hasNonCritical && 'border-l-4 border-l-amber-500',
              !hasCritical && !hasNonCritical && hasDue && 'border-l-4 border-l-amber-500',
              !hasCritical && !hasNonCritical && !hasDue && 'border-l-4 border-l-transparent'
            )}
          >
            {/* Thumbnail placeholder */}
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-muted-foreground uppercase">
                {ride.ride_name.slice(0, 2)}
              </span>
            </div>

            {/* Main info — responsive layout */}
            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center gap-y-0.5 sm:gap-x-4">
              {/* Name + category */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold truncate">{ride.ride_name}</span>
                  <Badge
                    variant="outline"
                    className="hidden sm:inline-flex text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 whitespace-nowrap"
                  >
                    {ride.ride_categories.name}
                  </Badge>
                </div>
                {/* Mobile: category + make/year inline */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground sm:mt-0">
                  <span className="sm:hidden">{ride.ride_categories.name}</span>
                  {(ride.manufacturer || ride.year_manufactured) && (
                    <span className="hidden sm:inline">
                      {[ride.manufacturer, ride.year_manufactured].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Make / Year — desktop */}
              <div className="hidden sm:block text-xs text-muted-foreground w-[100px] truncate">
                {[ride.manufacturer, ride.year_manufactured].filter(Boolean).join(' / ') || '—'}
              </div>

              {/* Status */}
              <div className="sm:w-[140px]">
                {hasCritical ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-destructive">
                    <AlertOctagon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Do not operate</span>
                    <span className="sm:hidden">Stop use</span>
                  </span>
                ) : hasNonCritical ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Attention needed</span>
                    <span className="sm:hidden">Attention</span>
                  </span>
                ) : hasDue ? (
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    Due {new Date(stats!.nextDue!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </span>
                ) : (
                  <span className="text-xs text-success font-medium">Compliant</span>
                )}
              </div>

              {/* Docs count */}
              <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground w-[60px]">
                <FileText className="h-3 w-3" />
                <span>{stats?.docCount ?? 0}</span>
              </div>

              {/* Checks count — mobile shows inline with status */}
              <div className="hidden sm:block text-xs text-muted-foreground w-[60px]">
                {stats?.checkCount ?? 0} checks
              </div>
            </div>

            {/* Chevron */}
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
};

export default EquipmentListView;