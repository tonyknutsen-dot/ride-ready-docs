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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 relative">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6 sticky top-0 z-20 bg-background">
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

        <TabsContent value="daily" className="relative">
          <div className="space-y-6 relative z-0">
            <Tabs defaultValue="perform" className="space-y-4 relative z-10">
              <TabsList className="grid w-full grid-cols-3 gap-0.5 h-auto">
                <TabsTrigger value="perform" className="text-[10px] sm:text-xs px-1 sm:px-3 py-1.5 sm:py-2">
                  Perform
                </TabsTrigger>
                <TabsTrigger value="history" className="text-[10px] sm:text-xs px-1 sm:px-3 py-1.5 sm:py-2">
                  History
                </TabsTrigger>
                <TabsTrigger value="templates" className="text-[10px] sm:text-xs px-1 sm:px-3 py-1.5 sm:py-2">
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
              <TabsList className="grid w-full grid-cols-2 gap-0.5 h-auto">
                <TabsTrigger value="perform" className="text-[10px] sm:text-xs px-1 sm:px-3 py-1.5 sm:py-2">
                  Perform
                </TabsTrigger>
                <TabsTrigger value="templates" className="text-[10px] sm:text-xs px-1 sm:px-3 py-1.5 sm:py-2">
                  Templates
                </TabsTrigger>
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
            <Tabs defaultValue="perform" className="space-y-4 relative z-10">
              <TabsList className="grid w-full grid-cols-2 gap-0.5 h-auto">
                <TabsTrigger value="perform" className="text-[10px] sm:text-xs px-1 sm:px-3 py-1.5 sm:py-2">
                  Perform
                </TabsTrigger>
                <TabsTrigger value="templates" className="text-[10px] sm:text-xs px-1 sm:px-3 py-1.5 sm:py-2">
                  Templates
                </TabsTrigger>
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