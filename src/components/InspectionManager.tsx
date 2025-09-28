import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Calendar, FileText, CalendarDays, TestTube, Building } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideDailyChecks from './RideDailyChecks';
import DailyCheckTemplateManager from './DailyCheckTemplateManager';
import MonthlyCheckTemplateManager from './MonthlyCheckTemplateManager';
import YearlyCheckTemplateManager from './YearlyCheckTemplateManager';
import InspectionChecklist from './InspectionChecklist';
import NDTScheduleManager from './NDTScheduleManager';
import AnnualInspectionManager from './AnnualInspectionManager';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

interface InspectionManagerProps {
  ride: Ride;
}

const InspectionManager = ({ ride }: InspectionManagerProps) => {
  const [activeTab, setActiveTab] = useState('daily');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Inspection Management</h3>
        <p className="text-muted-foreground">
          Manage all inspection types and schedules for {ride.ride_name}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="daily" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Daily</span>
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Monthly</span>
          </TabsTrigger>
          <TabsTrigger value="annual" className="flex items-center space-x-2">
            <Building className="h-4 w-4" />
            <span>In-Service</span>
          </TabsTrigger>
          <TabsTrigger value="ndt" className="flex items-center space-x-2">
            <TestTube className="h-4 w-4" />
            <span>NDT</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center space-x-2">
            <CalendarDays className="h-4 w-4" />
            <span>Reports</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Daily Safety Checks</span>
                </CardTitle>
                <CardDescription>
                  Perform and manage daily safety inspections for this ride
                </CardDescription>
              </CardHeader>
            </Card>
            <Tabs defaultValue="perform" className="space-y-4">
              <TabsList>
                <TabsTrigger value="perform">Perform Checks</TabsTrigger>
                <TabsTrigger value="templates">Manage Templates</TabsTrigger>
              </TabsList>
              <TabsContent value="perform">
                <RideDailyChecks ride={ride} />
              </TabsContent>
              <TabsContent value="templates">
                <DailyCheckTemplateManager ride={ride} />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="monthly">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Monthly Safety Checks</span>
                </CardTitle>
                <CardDescription>
                  Perform and manage monthly safety inspections for this ride
                </CardDescription>
              </CardHeader>
            </Card>
            <Tabs defaultValue="perform" className="space-y-4">
              <TabsList>
                <TabsTrigger value="perform">Perform Checks</TabsTrigger>
                <TabsTrigger value="templates">Manage Templates</TabsTrigger>
              </TabsList>
              <TabsContent value="perform">
                <InspectionChecklist ride={ride} frequency="monthly" />
              </TabsContent>
              <TabsContent value="templates">
                <MonthlyCheckTemplateManager ride={ride} />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="annual">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building className="h-5 w-5" />
                  <span>In-Service Inspection Reports</span>
                </CardTitle>
                <CardDescription>
                  Manage annual in-service inspection reports issued by independent inspection bodies. Successful inspections result in a Declaration of Compliance (DOC).
                </CardDescription>
              </CardHeader>
            </Card>
            <AnnualInspectionManager ride={ride} />
          </div>
        </TabsContent>

        <TabsContent value="ndt">
          <NDTScheduleManager ride={ride} />
        </TabsContent>

        <TabsContent value="reports">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CalendarDays className="h-5 w-5" />
                  <span>Inspection History & Reports</span>
                </CardTitle>
                <CardDescription>
                  View and manage historical inspection data and generate compliance reports
                </CardDescription>
              </CardHeader>
            </Card>
            {/* TODO: Add ReportGenerator component for historical data and compliance reports */}
            <div className="text-center text-muted-foreground p-8">
              <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Historical reports and compliance documentation coming soon</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InspectionManager;