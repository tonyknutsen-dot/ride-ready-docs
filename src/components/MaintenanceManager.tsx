import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History, Plus } from 'lucide-react';
import { Ride } from '@/types/ride';
import MaintenanceLogger from './MaintenanceLogger';
import MaintenanceHistory from './MaintenanceHistory';

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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="log" className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Log Activity</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center space-x-2">
            <History className="h-4 w-4" />
            <span>History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="log">
          <MaintenanceLogger ride={ride} onMaintenanceLogged={handleMaintenanceLogged} />
        </TabsContent>

        <TabsContent value="history">
          <MaintenanceHistory ride={ride} refreshTrigger={refreshTrigger} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MaintenanceManager;
