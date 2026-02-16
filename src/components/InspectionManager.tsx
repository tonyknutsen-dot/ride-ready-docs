import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, FileText, CalendarDays, TestTube, Building, PlayCircle, HelpCircle, CheckSquare, CalendarRange, ArrowRight, Sparkles } from 'lucide-react';
import { Ride } from '@/types/ride';
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
  weekly: number;
  monthly: number;
  yearly: number;
  total: number;
}

const FREQUENCY_ORDER = ['preopening', 'daily', 'weekly', 'monthly', 'yearly'] as const;
const FREQUENCY_LABELS: Record<string, string> = {
  preopening: 'Pre-Opening',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const InspectionManager = ({ ride }: InspectionManagerProps) => {
  const { user } = useAuth();
  const { effectiveUserId, isStaff } = useEffectiveUserId();
  const [activeTab, setActiveTab] = useState('preopening');
  const [showGuide, setShowGuide] = useState(false);
  const [checkCounts, setCheckCounts] = useState<CheckCounts>({ preopening: 0, daily: 0, weekly: 0, monthly: 0, yearly: 0, total: 0 });
  const [templateStatus, setTemplateStatus] = useState<Record<string, boolean>>({});
  const [showNextPrompt, setShowNextPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (effectiveUserId && ride.id) {
      loadCheckCounts();
      loadTemplateStatus();
    }
  }, [effectiveUserId, ride.id]);

  const loadCheckCounts = async () => {
    try {
      const counts = await Promise.all(
        FREQUENCY_ORDER.map(async (freq) => {
          let query = supabase
            .from('checks')
            .select('*', { count: 'exact', head: true })
            .eq('ride_id', ride.id)
            .eq('check_frequency', freq)
            .eq('is_test_data', false);

          if (!isStaff) {
            query = query.eq('user_id', effectiveUserId);
          }

          const { count } = await query;
          return { freq, count: count || 0 };
        })
      );
      
      const result: CheckCounts = { preopening: 0, daily: 0, weekly: 0, monthly: 0, yearly: 0, total: 0 };
      counts.forEach(({ freq, count }) => {
        result[freq] = count;
        result.total += count;
      });
      setCheckCounts(result);
    } catch (error) {
      console.error('Error loading check counts:', error);
    }
  };

  const loadTemplateStatus = async () => {
    try {
      let query = supabase
        .from('daily_check_templates')
        .select('check_frequency')
        .eq('ride_id', ride.id)
        .eq('is_active', true)
        .eq('is_archived', false);

      if (!isStaff) {
        query = query.eq('user_id', effectiveUserId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const status: Record<string, boolean> = {};
      FREQUENCY_ORDER.forEach(f => { status[f] = false; });
      (data || []).forEach(t => { status[t.check_frequency] = true; });
      setTemplateStatus(status);
    } catch (error) {
      console.error('Error loading template status:', error);
    }
  };

  const getNextFrequency = useCallback((currentFreq: string): string | null => {
    const currentIndex = FREQUENCY_ORDER.indexOf(currentFreq as typeof FREQUENCY_ORDER[number]);
    if (currentIndex === -1) return null;
    
    // Find the next frequency that doesn't have a template yet
    for (let i = currentIndex + 1; i < FREQUENCY_ORDER.length; i++) {
      if (!templateStatus[FREQUENCY_ORDER[i]]) {
        return FREQUENCY_ORDER[i];
      }
    }
    return null;
  }, [templateStatus]);

  const handleChecklistSaved = useCallback((frequency: string) => {
    // Refresh template status
    loadTemplateStatus();
    
    // Find the next frequency without a checklist
    const next = getNextFrequency(frequency);
    if (next) {
      setShowNextPrompt(next);
    }
  }, [getNextFrequency]);

  const handleGoToNext = (nextFreq: string) => {
    setShowNextPrompt(null);
    setActiveTab(nextFreq);
  };

  const handleDismissPrompt = () => {
    setShowNextPrompt(null);
  };

  const renderFrequencyContent = (frequency: string, label: string) => (
    <div className="space-y-6">
      {/* Next frequency prompt */}
      {showNextPrompt && activeTab === getTabForPrompt(frequency) && (
        <Card className="border-success/30 bg-gradient-to-r from-success/5 to-success/10">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Sparkles className="h-5 w-5 text-success shrink-0" />
                <div>
                  <p className="font-medium text-sm">Checklist saved! Set up your {FREQUENCY_LABELS[showNextPrompt]} checklist next?</p>
                  <p className="text-xs text-muted-foreground">Keep going to get all your checks ready.</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={handleDismissPrompt}>
                  Later
                </Button>
                <Button size="sm" onClick={() => handleGoToNext(showNextPrompt)} className="gap-1.5">
                  Set up {FREQUENCY_LABELS[showNextPrompt]} <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="perform" className="space-y-4 relative z-10">
        <TabsList className="grid grid-cols-2 w-full h-auto p-1 gap-1">
          <TabsTrigger value="perform" className="py-3 px-2 text-sm font-medium">
            Perform
          </TabsTrigger>
          <TabsTrigger value="history" className="py-3 px-2 text-sm font-medium">
            History
          </TabsTrigger>
        </TabsList>
        <TabsContent value="perform">
          <InspectionChecklist 
            ride={ride} 
            frequency={frequency} 
            onChecklistSaved={() => handleChecklistSaved(frequency)}
          />
        </TabsContent>
        <TabsContent value="history">
          <ChecksHistory rideId={ride.id} rideName={ride.ride_name} frequency={frequency} />
        </TabsContent>
      </Tabs>
    </div>
  );

  // Helper to determine which tab the prompt should show on
  const getTabForPrompt = (frequency: string) => frequency;

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
              {FREQUENCY_ORDER.map(freq => {
                const icons: Record<string, any> = {
                  preopening: PlayCircle, daily: Clock, weekly: CalendarRange, monthly: Calendar, yearly: CalendarDays,
                };
                const Icon = icons[freq];
                const hasTemplate = templateStatus[freq];
                return (
                  <Badge 
                    key={freq} 
                    variant="outline" 
                    className={`text-xs bg-background ${hasTemplate ? '' : 'opacity-50'}`}
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    {checkCounts[freq]} {FREQUENCY_LABELS[freq]}
                    {hasTemplate && <CheckSquare className="h-2.5 w-2.5 ml-1 text-success" />}
                  </Badge>
                );
              })}
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
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setShowNextPrompt(null); }} className="space-y-6 relative">
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
              value="weekly" 
              className="flex flex-col items-center justify-center gap-1 py-3 px-4 text-xs font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg min-w-[70px] min-h-[56px]"
            >
              <CalendarRange className="h-5 w-5" />
              <span>Weekly</span>
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

        {/* Pre-Opening Check */}
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
            {renderFrequencyContent('preopening', 'Pre-Opening')}
          </div>
        </TabsContent>

        <TabsContent value="daily" className="relative">
          {renderFrequencyContent('daily', 'Daily')}
        </TabsContent>

        <TabsContent value="weekly" className="relative">
          {renderFrequencyContent('weekly', 'Weekly')}
        </TabsContent>

        <TabsContent value="monthly">
          {renderFrequencyContent('monthly', 'Monthly')}
        </TabsContent>

        <TabsContent value="yearly">
          {renderFrequencyContent('yearly', 'Yearly')}
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
