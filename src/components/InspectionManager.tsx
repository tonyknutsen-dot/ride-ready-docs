import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Calendar, FileText, CalendarDays, TestTube, Building, PlayCircle } from 'lucide-react';
import { Ride } from '@/types/ride';
import DailyCheckTemplateManager from './DailyCheckTemplateManager';
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
        {/* Mobile-friendly scrollable tabs */}
        <div className="overflow-x-auto -mx-4 px-4 pb-2">
          <TabsList className="inline-flex gap-2 p-1.5 bg-muted/60 h-auto min-w-max">
            <TabsTrigger 
              value="preuse" 
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg min-w-[70px] min-h-[56px]"
            >
              <PlayCircle className="h-5 w-5" />
              <span>Pre-Use</span>
            </TabsTrigger>
            <TabsTrigger 
              value="daily" 
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg min-w-[70px] min-h-[56px]"
            >
              <Clock className="h-5 w-5" />
              <span>Daily</span>
            </TabsTrigger>
            <TabsTrigger 
              value="monthly" 
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg min-w-[70px] min-h-[56px]"
            >
              <Calendar className="h-5 w-5" />
              <span>Monthly</span>
            </TabsTrigger>
            <TabsTrigger 
              value="yearly" 
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg min-w-[70px] min-h-[56px]"
            >
              <CalendarDays className="h-5 w-5" />
              <span>Yearly</span>
            </TabsTrigger>
            <TabsTrigger 
              value="annual" 
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg min-w-[70px] min-h-[56px]"
            >
              <Building className="h-5 w-5" />
              <span>External</span>
            </TabsTrigger>
            <TabsTrigger 
              value="ndt" 
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg min-w-[70px] min-h-[56px]"
            >
              <TestTube className="h-5 w-5" />
              <span>NDT</span>
            </TabsTrigger>
            <TabsTrigger 
              value="reports" 
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg min-w-[70px] min-h-[56px]"
            >
              <FileText className="h-5 w-5" />
              <span>Reports</span>
            </TabsTrigger>
          </TabsList>
        </div>

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
              <TabsList className="grid grid-cols-3 w-full h-auto p-1 gap-1">
                <TabsTrigger value="perform" className="py-3 px-2 text-sm font-medium">
                  Perform
                </TabsTrigger>
                <TabsTrigger value="history" className="py-3 px-2 text-sm font-medium">
                  History
                </TabsTrigger>
                <TabsTrigger value="templates" className="py-3 px-2 text-sm font-medium">
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
              <TabsList className="grid grid-cols-3 w-full h-auto p-1 gap-1">
                <TabsTrigger value="perform" className="py-3 px-2 text-sm font-medium">
                  Perform
                </TabsTrigger>
                <TabsTrigger value="history" className="py-3 px-2 text-sm font-medium">
                  History
                </TabsTrigger>
                <TabsTrigger value="templates" className="py-3 px-2 text-sm font-medium">
                  Templates
                </TabsTrigger>
              </TabsList>
              <TabsContent value="perform">
                <InspectionChecklist ride={ride} frequency="daily" />
              </TabsContent>
              <TabsContent value="history">
                <ChecksHistory rideId={ride.id} rideName={ride.ride_name} frequency="daily" />
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
              <TabsList className="grid grid-cols-3 w-full h-auto p-1 gap-1">
                <TabsTrigger value="perform" className="py-3 px-2 text-sm font-medium">
                  Perform
                </TabsTrigger>
                <TabsTrigger value="history" className="py-3 px-2 text-sm font-medium">
                  History
                </TabsTrigger>
                <TabsTrigger value="templates" className="py-3 px-2 text-sm font-medium">
                  Templates
                </TabsTrigger>
              </TabsList>
              <TabsContent value="perform">
                <InspectionChecklist ride={ride} frequency="monthly" />
              </TabsContent>
              <TabsContent value="history">
                <ChecksHistory rideId={ride.id} rideName={ride.ride_name} frequency="monthly" />
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
              <TabsList className="grid grid-cols-3 w-full h-auto p-1 gap-1">
                <TabsTrigger value="perform" className="py-3 px-2 text-sm font-medium">
                  Perform
                </TabsTrigger>
                <TabsTrigger value="history" className="py-3 px-2 text-sm font-medium">
                  History
                </TabsTrigger>
                <TabsTrigger value="templates" className="py-3 px-2 text-sm font-medium">
                  Templates
                </TabsTrigger>
              </TabsList>
              <TabsContent value="perform">
                <InspectionChecklist ride={ride} frequency="yearly" />
              </TabsContent>
              <TabsContent value="history">
                <ChecksHistory rideId={ride.id} rideName={ride.ride_name} frequency="yearly" />
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