import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Calendar, FileText, CalendarDays, TestTube, Building } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideDailyChecks from './RideDailyChecks';
import DailyCheckTemplateManager from './DailyCheckTemplateManager';
import DailyCheckHistory from './DailyCheckHistory';
import MonthlyCheckTemplateManager from './MonthlyCheckTemplateManager';
import YearlyCheckTemplateManager from './YearlyCheckTemplateManager';
import InspectionChecklist from './InspectionChecklist';
import NDTScheduleManager from './NDTScheduleManager';
import InspectionScheduleManager from './InspectionScheduleManager';

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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
          <TabsTrigger value="daily" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Daily</span>
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Monthly</span>
          </TabsTrigger>
          <TabsTrigger value="yearly" className="flex items-center space-x-2">
            <CalendarDays className="h-4 w-4" />
            <span>Yearly</span>
          </TabsTrigger>
          <TabsTrigger value="annual" className="flex items-center space-x-2">
            <Building className="h-4 w-4" />
            <span>External</span>
          </TabsTrigger>
          <TabsTrigger value="ndt" className="flex items-center space-x-2">
            <TestTube className="h-4 w-4" />
            <span>NDT Tracking</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Reports</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Daily Safety Checks (Showmen)</span>
                </CardTitle>
                <CardDescription>
                  Perform and record daily safety checks - done by showmen before operation
                </CardDescription>
              </CardHeader>
            </Card>
            <Tabs defaultValue="perform" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="perform">Perform Checks</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="templates">Manage Templates</TabsTrigger>
              </TabsList>
              <TabsContent value="perform">
                <RideDailyChecks ride={ride} />
              </TabsContent>
              <TabsContent value="history">
                <DailyCheckHistory rideId={ride.id} />
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
                  <span>Monthly Safety Checks (Showmen)</span>
                </CardTitle>
                <CardDescription>
                  Perform and record monthly safety checks - done by showmen
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

        <TabsContent value="yearly">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CalendarDays className="h-5 w-5" />
                  <span>Yearly Safety Checks (Showmen)</span>
                </CardTitle>
                <CardDescription>
                  Perform and record yearly safety checks - done by showmen
                </CardDescription>
              </CardHeader>
            </Card>
            <Tabs defaultValue="perform" className="space-y-4">
              <TabsList>
                <TabsTrigger value="perform">Perform Checks</TabsTrigger>
                <TabsTrigger value="templates">Manage Templates</TabsTrigger>
              </TabsList>
              <TabsContent value="perform">
                <InspectionChecklist ride={ride} frequency="yearly" />
              </TabsContent>
              <TabsContent value="templates">
                <YearlyCheckTemplateManager ride={ride} />
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
                  <span>External Inspection Schedules</span>
                </CardTitle>
                <CardDescription>
                  Track and schedule inspections by independent inspection bodies (annual in-service, electrical, NDT, etc.)
                </CardDescription>
              </CardHeader>
            </Card>
            <InspectionScheduleManager ride={ride} />
          </div>
        </TabsContent>

        <TabsContent value="ndt">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TestTube className="h-5 w-5" />
                <span>NDT Inspection Tracking (Showmen)</span>
              </CardTitle>
              <CardDescription>
                Track when NDT inspections are due - actual inspections conducted by independent NDT inspectors
              </CardDescription>
            </CardHeader>
          </Card>
          <NDTScheduleManager ride={ride} />
        </TabsContent>

        <TabsContent value="reports">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CalendarDays className="h-5 w-5" />
                  <span>External Inspection Reports</span>
                </CardTitle>
                <CardDescription>
                  View reports from independent inspection bodies and generate compliance documentation
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