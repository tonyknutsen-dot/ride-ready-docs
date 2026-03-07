import { useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Plus } from 'lucide-react';
import { Ride } from '@/types/ride';
import MaintenanceLogger from './MaintenanceLogger';
import MaintenanceHistory from './MaintenanceHistory';

interface MaintenanceManagerProps {
  ride: Ride;
}

const MaintenanceManager = ({ ride }: MaintenanceManagerProps) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [logSheetOpen, setLogSheetOpen] = useState(false);

  const handleMaintenanceLogged = () => {
    setRefreshTrigger(prev => prev + 1);
    setLogSheetOpen(false);
  };

  const handleOpenLogSheet = useCallback(() => {
    setLogSheetOpen(true);
  }, []);

  return (
    <div className="space-y-3">
      {/* History / register shown directly — with CTA injected */}
      <MaintenanceHistory
        ride={ride}
        refreshTrigger={refreshTrigger}
        onLogMaintenance={handleOpenLogSheet}
      />

      {/* Log maintenance sheet */}
      <Sheet open={logSheetOpen} onOpenChange={setLogSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-background z-10">
            <SheetTitle className="text-base">Log Maintenance</SheetTitle>
            <SheetDescription className="text-[12px]">
              Record maintenance activity for {ride.ride_name}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4">
            <MaintenanceLogger ride={ride} onMaintenanceLogged={handleMaintenanceLogged} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MaintenanceManager;
