import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History, FileText, Plus, AlertTriangle } from 'lucide-react';
import { Ride } from '@/types/ride';
import MaintenanceLogger from './MaintenanceLogger';
import MaintenanceHistory from './MaintenanceHistory';
import MaintenanceReports from './MaintenanceReports';
import DefectsList from './DefectsList';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

interface MaintenanceManagerProps {
  ride: Ride;
}

const MaintenanceManager = ({ ride }: MaintenanceManagerProps) => {
  const [activeTab, setActiveTab] = useState('log');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleMaintenanceLogged = () => {
    setRefreshTrigger(prev => prev + 1);
    setActiveTab('history');
  };

  return (
    <div className="space-y-6">
      {/* Defects section — full list grouped under this ride */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-[13px] font-bold text-foreground tracking-[1px] uppercase">Defects</h3>
        </div>
        <div className="h-px bg-border" />
        <DefectsList
          rideId={ride.id}
          rideName={ride.ride_name}
          showResolved={false}
        />
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <History className="h-3.5 w-3.5" />
            <span>Show closed defects</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <DefectsList
              rideId={ride.id}
              rideName={ride.ride_name}
              showResolved={true}
            />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Maintenance tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="log" className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Log Activity</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center space-x-2">
            <History className="h-4 w-4" />
            <span>History</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Reports</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="log">
          <MaintenanceLogger ride={ride} onMaintenanceLogged={handleMaintenanceLogged} />
        </TabsContent>

        <TabsContent value="history">
          <MaintenanceHistory ride={ride} refreshTrigger={refreshTrigger} />
        </TabsContent>

        <TabsContent value="reports">
          <MaintenanceReports ride={ride} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MaintenanceManager;