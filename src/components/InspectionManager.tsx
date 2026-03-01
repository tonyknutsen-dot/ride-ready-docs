import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, FileText, CalendarDays, TestTube, Building, PlayCircle, HelpCircle, CalendarRange, ArrowRight, Sparkles, PauseCircle, Info, AlertOctagon } from 'lucide-react';
import { Ride } from '@/types/ride';
import InspectionChecklist from './InspectionChecklist';
import NDTScheduleManager from './NDTScheduleManager';
import InspectionScheduleManager from './InspectionScheduleManager';
import ChecksHistory from './ChecksHistory';
import EquipmentTimelineReport from './EquipmentTimelineReport';
import { ChecksOnboardingModal } from './ChecksOnboardingModal';
import CriticalDefectBanner from './CriticalDefectBanner';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useOpenCriticalDefects } from '@/hooks/useOpenCriticalDefects';


interface InspectionManagerProps {
  ride: Ride;
}

interface CheckCounts {
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
  total: number;
}

const FREQUENCY_ORDER = ['daily', 'weekly', 'monthly', 'yearly'] as const;
const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily / Pre-Opening',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const InspectionManager = ({ ride }: InspectionManagerProps) => {
  const { user } = useAuth();
  const { effectiveUserId, isStaff } = useEffectiveUserId();
  const [searchParams] = useSearchParams();
  const checksSubTab = searchParams.get('checksSubTab');
  const [activeTab, setActiveTab] = useState(checksSubTab || 'daily');

  // Sync tab when URL param changes (e.g. deep-link from Needs Attention)
  useEffect(() => {
    if (checksSubTab && checksSubTab !== activeTab) {
      setActiveTab(checksSubTab);
    }
  }, [checksSubTab]);
  const [showGuide, setShowGuide] = useState(false);
  const [checkCounts, setCheckCounts] = useState<CheckCounts>({ daily: 0, weekly: 0, monthly: 0, yearly: 0, total: 0 });
  const [templateStatus, setTemplateStatus] = useState<Record<string, boolean>>({});
  const [showNextPrompt, setShowNextPrompt] = useState<string | null>(null);
  const { hasCriticalDefects } = useOpenCriticalDefects(ride.id);
  const isDailyOrPreOpening = activeTab === 'daily';
  const { toast } = useToast();

  useEffect(() => {
    if (effectiveUserId && ride.id) {
      loadCheckCounts();
      loadTemplateStatus();
    }
  }, [effectiveUserId, ride.id]);

  const loadCheckCounts = async () => {
    try {
      const counts = await Promise.all(
        // Count both daily and preopening for the merged daily tab
        [...FREQUENCY_ORDER, 'preopening' as const].map(async (freq) => {
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
      
      const result: CheckCounts = { daily: 0, weekly: 0, monthly: 0, yearly: 0, total: 0 };
      counts.forEach(({ freq, count }) => {
        // Merge preopening counts into daily
        const key = freq === 'preopening' ? 'daily' : freq;
        if (key in result) {
          result[key as keyof Omit<CheckCounts, 'total'>] += count;
        }
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
      (data || []).forEach(t => {
        // Merge preopening template status into daily
        const key = t.check_frequency === 'preopening' ? 'daily' : t.check_frequency;
        if (key in status) status[key] = true;
      });
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
    <div className="space-y-4">
      {/* Next frequency prompt */}
      {showNextPrompt && activeTab === getTabForPrompt(frequency) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-success/5 border border-success/30 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Sparkles className="h-4 w-4 text-success shrink-0" />
            <div>
              <p className="font-medium text-sm">Checklist saved! Set up your {FREQUENCY_LABELS[showNextPrompt]} checklist next?</p>
              <p className="text-xs text-muted-foreground">Keep going to get all your checks ready.</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={handleDismissPrompt}>Later</Button>
            <Button size="sm" onClick={() => handleGoToNext(showNextPrompt)} className="gap-1.5">
              Set up {FREQUENCY_LABELS[showNextPrompt]} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <InspectionChecklist
        ride={ride}
        frequency={frequency}
        onChecklistSaved={() => handleChecklistSaved(frequency)}
      />
    </div>
  );

  // Helper to determine which tab the prompt should show on
  const getTabForPrompt = (frequency: string) => frequency;

  return (
    <div className="space-y-5">
      <ChecksOnboardingModal forceOpen={showGuide} onClose={() => setShowGuide(false)} />

      {/* Critical defect banner — top priority, above everything */}
      {hasCriticalDefects && (
        <CriticalDefectBanner rideId={ride.id} rideName={ride.ride_name} />
      )}


      {/* Check Count Summary Strip — muted, informational */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          {FREQUENCY_ORDER.map(freq => {
            const icons: Record<string, any> = {
              preopening: PlayCircle, daily: Clock, weekly: CalendarRange, monthly: Calendar, yearly: CalendarDays,
            };
            const Icon = icons[freq];
            const hasTemplate = templateStatus[freq];
            return (
              <button
                key={freq}
                onClick={() => { setActiveTab(freq); setShowNextPrompt(null); }}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  hasTemplate
                    ? 'border-border bg-card text-foreground hover:border-primary/40'
                    : 'border-border/50 bg-muted/30 text-muted-foreground opacity-60'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{checkCounts[freq]}</span>
                <span className="hidden sm:inline">{FREQUENCY_LABELS[freq]}</span>
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowGuide(true)}
          className="text-muted-foreground hover:text-foreground h-7 px-2 flex-shrink-0"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setShowNextPrompt(null); }} className="space-y-5 relative">
        {/* Frequency selector — check-type cards with strong active state */}
        <div className="overflow-x-auto -mx-4 px-4 pb-1">
          <div className="inline-flex gap-2 min-w-max">
            {[
              { value: 'daily',      label: 'Daily / Pre-Opening', Icon: Clock },
              { value: 'weekly',     label: 'Weekly',      Icon: CalendarRange },
              { value: 'monthly',    label: 'Monthly',     Icon: Calendar },
              { value: 'yearly',     label: 'Yearly',      Icon: CalendarDays },
            ].map(({ value, label, Icon }) => {
              const isActive = activeTab === value;
              const hasTemplate = templateStatus[value];
              return (
                <button
                  key={value}
                  onClick={() => { setActiveTab(value); setShowNextPrompt(null); }}
                  className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 transition-all min-w-[72px] font-medium text-xs ${
                    isActive
                      ? 'bg-primary border-primary text-primary-foreground shadow-md'
                      : 'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                  <span>{label}</span>
                  {hasTemplate && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  )}
                </button>
              );
            })}
            {/* Separator before admin tabs */}
            <div className="w-px bg-border self-stretch mx-1" />
            {[
              { value: 'annual',  label: 'Annual',   Icon: Building },
              { value: 'ndt',     label: 'NDT',      Icon: TestTube },
              { value: 'reports', label: 'Reports',  Icon: FileText },
            ].map(({ value, label, Icon }) => {
              const isActive = activeTab === value;
              return (
                <button
                  key={value}
                  onClick={() => { setActiveTab(value); setShowNextPrompt(null); }}
                  className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 transition-all min-w-[72px] font-medium text-xs ${
                    isActive
                      ? 'bg-primary border-primary text-primary-foreground shadow-md'
                      : 'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Daily / Pre-Opening Check (merged) */}
        <TabsContent value="daily" className="relative">
          {renderFrequencyContent('daily', 'Daily / Pre-Opening')}
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
