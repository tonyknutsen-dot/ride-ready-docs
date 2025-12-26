import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wrench, History, FileText, Plus } from 'lucide-react';
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
    setActiveTab('history'); // Switch to history tab to show the new record
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          Log maintenance activities including repairs, part replacements, and servicing. Track maintenance history and generate compliance reports.
        </AlertDescription>
      </Alert>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Maintenance Management</h3>
        <p className="text-muted-foreground">
          Log maintenance activities, track history, and generate compliance reports for {ride.ride_name}
        </p>
      </div>

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
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Wrench className="h-5 w-5" />
                  <span>Maintenance Logging</span>
                </CardTitle>
                <CardDescription>
                  Record maintenance work with photos, documents, and detailed information for regulatory compliance
                </CardDescription>
              </CardHeader>
            </Card>
            <MaintenanceLogger ride={ride} onMaintenanceLogged={handleMaintenanceLogged} />
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <History className="h-5 w-5" />
                  <span>Maintenance History</span>
                </CardTitle>
                <CardDescription>
                  View, manage, and export maintenance records with supporting documentation
                </CardDescription>
              </CardHeader>
            </Card>
            <MaintenanceHistory ride={ride} refreshTrigger={refreshTrigger} />
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Maintenance Reports</span>
                </CardTitle>
                <CardDescription>
                  Generate comprehensive maintenance reports for regulatory compliance and record keeping
                </CardDescription>
              </CardHeader>
            </Card>
            <div className="text-center text-muted-foreground p-8">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Maintenance report generation coming soon</p>
              <p className="text-sm">Generate comprehensive PDF reports with maintenance history and photos</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MaintenanceManager;