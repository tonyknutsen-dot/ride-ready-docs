import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, CheckSquare, Mail, AlertOctagon } from 'lucide-react';
import { SendDocumentsDialog } from '@/components/SendDocumentsDialog';
import type { Ride } from '@/types/ride';

interface RideStats {
  docCount: number;
  checkCount: number;
  nextDue: string | null;
}

interface EquipmentCardGridProps {
  rides: Ride[];
  rideStats: Record<string, RideStats>;
  criticalDefectsMap: Map<string, number> | undefined;
  onSelectRide: (ride: Ride) => void;
}

const EquipmentCardGrid = ({ rides, rideStats, criticalDefectsMap, onSelectRide }: EquipmentCardGridProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
      {rides.map((ride) => {
        const criticalCount = criticalDefectsMap?.get(ride.id) || 0;
        return (
          <Card
            key={ride.id}
            className={`hover:shadow-md transition-all cursor-pointer ${criticalCount > 0 ? 'border-destructive/50 bg-destructive/5' : 'border-muted/50'}`}
            onClick={() => onSelectRide(ride)}
          >
            {criticalCount > 0 && (
              <div className="flex items-center gap-2 px-4 pt-3 pb-0">
                <AlertOctagon className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-xs font-bold text-destructive">
                  Critical defect — do not operate
                </span>
              </div>
            )}
            <CardHeader className="pb-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base sm:text-lg leading-tight flex-1 min-w-0 break-words line-clamp-2">
                  {ride.ride_name}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-primary/10 text-primary border-primary/20 flex-shrink-0 whitespace-nowrap"
                >
                  {ride.ride_categories.name}
                </Badge>
              </div>
              {(ride.manufacturer || ride.year_manufactured) && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {ride.manufacturer && <div className="truncate">Make: {ride.manufacturer}</div>}
                  {ride.year_manufactured && <div>Year: {ride.year_manufactured}</div>}
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-md bg-muted/50 text-center">
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 mx-auto text-primary mb-1" />
                  <p className="text-xs sm:text-sm font-medium">{rideStats[ride.id]?.docCount ?? 0}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Documents</p>
                </div>
                <div className="p-2 rounded-md bg-muted/50 text-center">
                  <CheckSquare className="h-3 w-3 sm:h-4 sm:w-4 mx-auto text-accent mb-1" />
                  <p className="text-xs sm:text-sm font-medium">{rideStats[ride.id]?.checkCount ?? 0}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Checks</p>
                </div>
              </div>
              {rideStats[ride.id]?.nextDue && (
                <div className="text-center p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                    Due: {new Date(rideStats[ride.id].nextDue!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </p>
                </div>
              )}
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  onClick={() => onSelectRide(ride)}
                  className="flex-1 text-xs sm:text-sm"
                  variant="outline"
                  size="sm"
                >
                  View
                </Button>
                <SendDocumentsDialog
                  ride={ride}
                  trigger={
                    <Button variant="ghost" size="sm" className="px-2">
                      <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  }
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default EquipmentCardGrid;
