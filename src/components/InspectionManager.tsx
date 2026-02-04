import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, FileText, CalendarDays, TestTube, Building, PlayCircle, HelpCircle, CheckSquare } from 'lucide-react';
import { Ride } from '@/types/ride';
import DailyCheckTemplateManager from './DailyCheckTemplateManager';
import MonthlyCheckTemplateManager from './MonthlyCheckTemplateManager';
import YearlyCheckTemplateManager from './YearlyCheckTemplateManager';
import InspectionChecklist from './InspectionChecklist';
import NDTScheduleManager from './NDTScheduleManager';
import InspectionScheduleManager from './InspectionScheduleManager';
import ChecksHistory from './ChecksHistory';
import EquipmentTimelineReport from './EquipmentTimelineReport';
import { ChecksOnboardingModal } from './ChecksOnboardingModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';

interface InspectionManagerProps {
  ride: Ride;
}

interface CheckCounts {
  preopening: number;
  daily: number;
  monthly: number;
  yearly: number;
  total: number;
}

const InspectionManager = ({ ride }: InspectionManagerProps) => {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const [activeTab, setActiveTab] = useState('preopening');
  const [showGuide, setShowGuide] = useState(false);
  const [checkCounts, setCheckCounts] = useState<CheckCounts>({ preopening: 0, daily: 0, monthly: 0, yearly: 0, total: 0 });

  useEffect(() => {
    if (effectiveUserId && ride.id) {
      loadCheckCounts();
    }
  }, [effectiveUserId, ride.id]);

  const loadCheckCounts = async () => {
    try {
      const frequencies = ['preopening', 'daily', 'monthly', 'yearly'] as const;
      const counts = await Promise.all(
        frequencies.map(async (freq) => {
          const { count } = await supabase
            .from('checks')
            .select('*', { count: 'exact', head: true })
            .eq('ride_id', ride.id)
            .eq('user_id', effectiveUserId)
            .eq('check_frequency', freq)
            .eq('is_test_data', false); // Exclude test data
          return { freq, count: count || 0 };
        })
      );
      
      const result: CheckCounts = { preopening: 0, daily: 0, monthly: 0, yearly: 0, total: 0 };
      counts.forEach(({ freq, count }) => {
        result[freq] = count;
        result.total += count;
      });
      setCheckCounts(result);
    } catch (error) {
      console.error('Error loading check counts:', error);
    }
  };

  return (
    <div className="space-y-6">
      <ChecksOnboardingModal forceOpen={showGuide} onClose={() => setShowGuide(false)} />
      
      {/* Summary Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CheckSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-lg">{checkCounts.total} Total Checks</p>
                <p className="text-xs text-muted-foreground">All recorded safety checks for this equipment</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs bg-background">
                <PlayCircle className="h-3 w-3 mr-1" />
                {checkCounts.preopening} Pre-Opening
              </Badge>
              <Badge variant="outline" className="text-xs bg-background">
                <Clock className="h-3 w-3 mr-1" />
                {checkCounts.daily} Daily
              </Badge>
              <Badge variant="outline" className="text-xs bg-background">
                <Calendar className="h-3 w-3 mr-1" />
                {checkCounts.monthly} Monthly
              </Badge>
              <Badge variant="outline" className="text-xs bg-background">
                <CalendarDays className="h-3 w-3 mr-1" />
                {checkCounts.yearly} Yearly
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Help button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowGuide(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="h-4 w-4" />
          <span className="ml-1">How does it work?</span>
        </Button>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 relative">
        {/* Mobile-friendly scrollable tabs */}
        <div className="overflow-x-auto -mx-4 px-4 pb-2">
          <TabsList className="inline-flex gap-2 p-1.5 bg-muted/60 h-auto min-w-max">
            <TabsTrigger 
              value="preopening" 
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg min-w-[70px] min-h-[56px]"
            >
            <PlayCircle className="h-5 w-5" />
              <span>Pre-Opening</span>
            </TabsTrigger>
            <TabsTrigger 
              value="daily" 
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg min-w-[70px] min-h-[56px]"
            >
              <Clock className="h-5 w-5" />
              <span>Daily</span>
            </TabsTrigger>
            <TabsTrigger 
              value="monthly" 
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg min-w-[70px] min-h-[56px]"
            >
              <Calendar className="h-5 w-5" />
              <span>Monthly</span>
            </TabsTrigger>
            <TabsTrigger 
              value="yearly" 
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg min-w-[70px] min-h-[56px]"
            >
              <CalendarDays className="h-5 w-5" />
              <span>Yearly</span>
            </TabsTrigger>
            <TabsTrigger 
              value="annual" 
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg min-w-[70px] min-h-[56px]"
            >
              <Building className="h-5 w-5" />
              <span>Annual Inspections</span>
            </TabsTrigger>
            <TabsTrigger 
              value="ndt" 
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg min-w-[70px] min-h-[56px]"
            >
              <TestTube className="h-5 w-5" />
              <span>NDT</span>
            </TabsTrigger>
            <TabsTrigger 
              value="reports" 
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg min-w-[70px] min-h-[56px]"
            >
              <FileText className="h-5 w-5" />
              <span>Reports</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Pre-Opening Check - Function test before opening */}
        <TabsContent value="preopening" className="relative">
          <div className="space-y-6 relative z-0">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-primary" />
                  Pre-Opening Safety Check
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
                <InspectionChecklist ride={ride} frequency="preopening" />
              </TabsContent>
              <TabsContent value="history">
                <ChecksHistory rideId={ride.id} rideName={ride.ride_name} frequency="preopening" />
              </TabsContent>
              <TabsContent value="templates">
                <DailyCheckTemplateManager ride={ride} frequency="preopening" />
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
          <EquipmentTimelineReport ride={ride} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InspectionManager;