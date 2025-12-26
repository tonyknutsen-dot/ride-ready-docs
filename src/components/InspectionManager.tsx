import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Calendar, FileText, CalendarDays, TestTube, Building, PlayCircle } from 'lucide-react';
import { Ride } from '@/types/ride';
import RideDailyChecks from './RideDailyChecks';
import DailyCheckTemplateManager from './DailyCheckTemplateManager';
import DailyCheckHistory from './DailyCheckHistory';
import MonthlyCheckTemplateManager from './MonthlyCheckTemplateManager';
import YearlyCheckTemplateManager from './YearlyCheckTemplateManager';
import InspectionChecklist from './InspectionChecklist';
import NDTScheduleManager from './NDTScheduleManager';
import InspectionScheduleManager from './InspectionScheduleManager';
import ChecksHistory from './ChecksHistory';

interface InspectionManagerProps {
  ride: Ride;
}

const InspectionManager = ({ ride }: InspectionManagerProps) => {
  const [activeTab, setActiveTab] = useState('preuse');

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 relative">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 md:grid-cols-7 sticky top-0 z-20 bg-background">
          <TabsTrigger value="preuse" className="flex items-center space-x-1 sm:space-x-2">
            <PlayCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Pre-Use</span>
            <span className="sm:hidden text-xs">Pre</span>
          </TabsTrigger>
          <TabsTrigger value="daily" className="flex items-center space-x-1 sm:space-x-2">
            <Clock className="h-4 w-4" />
            <span>Daily</span>
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex items-center space-x-1 sm:space-x-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Monthly</span>
            <span className="sm:hidden text-xs">Month</span>
          </TabsTrigger>
          <TabsTrigger value="yearly" className="flex items-center space-x-1 sm:space-x-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Yearly</span>
            <span className="sm:hidden text-xs">Year</span>
          </TabsTrigger>
          <TabsTrigger value="annual" className="flex items-center space-x-1 sm:space-x-2">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">External</span>
            <span className="sm:hidden text-xs">Ext</span>
          </TabsTrigger>
          <TabsTrigger value="ndt" className="flex items-center space-x-1 sm:space-x-2">
            <TestTube className="h-4 w-4" />
            <span className="hidden sm:inline">NDT</span>
            <span className="sm:hidden text-xs">NDT</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center space-x-1 sm:space-x-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Reports</span>
            <span className="sm:hidden text-xs">Rep</span>
          </TabsTrigger>
        </TabsList>

        {/* Pre-Use Check - Function test before opening */}
        <TabsContent value="preuse" className="relative">
          <div className="space-y-6 relative z-0">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-primary" />
                  Pre-Use Function Test
                </CardTitle>
                <CardDescription>
                  Complete this check before opening to the public each day. Ensures all safety systems are working.
                </CardDescription>
              </CardHeader>
            </Card>
            <Tabs defaultValue="perform" className="space-y-4 relative z-10">
              <TabsList className="flex flex-col sm:grid sm:grid-cols-3 w-full sm:w-auto gap-2 h-auto p-1">
                <TabsTrigger value="perform" className="text-sm px-4 py-2 w-full sm:w-auto">
                  Perform
                </TabsTrigger>
                <TabsTrigger value="history" className="text-sm px-4 py-2 w-full sm:w-auto">
                  History
                </TabsTrigger>
                <TabsTrigger value="templates" className="text-sm px-4 py-2 w-full sm:w-auto">
                  Templates
                </TabsTrigger>
              </TabsList>
              <TabsContent value="perform">
                <InspectionChecklist ride={ride} frequency="preuse" />
              </TabsContent>
              <TabsContent value="history">
                <ChecksHistory rideId={ride.id} rideName={ride.ride_name} frequency="preuse" />
              </TabsContent>
              <TabsContent value="templates">
                <DailyCheckTemplateManager ride={ride} frequency="preuse" />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="daily" className="relative">
          <div className="space-y-6 relative z-0">
            <Tabs defaultValue="perform" className="space-y-4 relative z-10">
              <TabsList className="flex flex-col sm:grid sm:grid-cols-3 w-full sm:w-auto gap-2 h-auto p-1 mt-4">
                <TabsTrigger value="perform" className="text-sm px-4 py-2 w-full sm:w-auto">
                  Perform
                </TabsTrigger>
                <TabsTrigger value="history" className="text-sm px-4 py-2 w-full sm:w-auto">
                  History
                </TabsTrigger>
                <TabsTrigger value="templates" className="text-sm px-4 py-2 w-full sm:w-auto">
                  Templates
                </TabsTrigger>
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
            <Tabs defaultValue="perform" className="space-y-4 relative z-10">
              <TabsList className="flex flex-col sm:grid sm:grid-cols-3 w-full sm:w-auto gap-2 h-auto p-1">
                <TabsTrigger value="perform" className="text-sm px-4 py-2 w-full sm:w-auto">
                  Perform
                </TabsTrigger>
                <TabsTrigger value="history" className="text-sm px-4 py-2 w-full sm:w-auto">
                  History
                </TabsTrigger>
                <TabsTrigger value="templates" className="text-sm px-4 py-2 w-full sm:w-auto">
                  Templates
                </TabsTrigger>
              </TabsList>
              <TabsContent value="perform">
                <InspectionChecklist ride={ride} frequency="monthly" />
              </TabsContent>
              <TabsContent value="history">
                <ChecksHistory rideId={ride.id} rideName={ride.ride_name} />
              </TabsContent>
              <TabsContent value="templates">
                <MonthlyCheckTemplateManager ride={ride} />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="yearly">
          <div className="space-y-6">
            <Tabs defaultValue="perform" className="space-y-4 relative z-10">
              <TabsList className="flex flex-col sm:grid sm:grid-cols-3 w-full sm:w-auto gap-2 h-auto p-1">
                <TabsTrigger value="perform" className="text-sm px-4 py-2 w-full sm:w-auto">
                  Perform
                </TabsTrigger>
                <TabsTrigger value="history" className="text-sm px-4 py-2 w-full sm:w-auto">
                  History
                </TabsTrigger>
                <TabsTrigger value="templates" className="text-sm px-4 py-2 w-full sm:w-auto">
                  Templates
                </TabsTrigger>
              </TabsList>
              <TabsContent value="perform">
                <InspectionChecklist ride={ride} frequency="yearly" />
              </TabsContent>
              <TabsContent value="history">
                <ChecksHistory rideId={ride.id} rideName={ride.ride_name} />
              </TabsContent>
              <TabsContent value="templates">
                <YearlyCheckTemplateManager ride={ride} />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="annual">
          <div className="space-y-6">
            <InspectionScheduleManager ride={ride} />
          </div>
        </TabsContent>

        <TabsContent value="ndt">
          <NDTScheduleManager ride={ride} />
        </TabsContent>

        <TabsContent value="reports">
          <div className="text-center text-muted-foreground p-8">
            <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Historical reports and compliance documentation coming soon</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InspectionManager;