import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, HelpCircle, ClipboardList, Clock, ChevronRight, Plus, Search } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideSelector from '@/components/RideSelector';
import { ChecksOnboardingModal } from '@/components/ChecksOnboardingModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import PageHeader from '@/components/PageHeader';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import { OfflineStaleAlert } from '@/components/OfflineStaleAlert';
import { useRecentChecksSummary } from '@/hooks/useRecentChecksSummary';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useStaff } from '@/contexts/StaffContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

const Checks = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();
  const [showGuide, setShowGuide] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const { data: summary, isLoading } = useRecentChecksSummary();

  // Equipment list for the picker sheet
  const { data: equipment = [], isLoading: equipLoading } = useOfflineQuery<Ride[]>({
    queryKey: ['rides-selector', effectiveUserId, isStaff],
    queryFn: async () => {
      let query = supabase
        .from('rides')
        .select('*, ride_categories(name, description)')
        .order('ride_name');
      if (!isStaff) {
        query = query.eq('user_id', effectiveUserId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Ride[];
    },
    enabled: !!user && !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
    offlineCacheKey: `rides-selector:${effectiveUserId}`,
  });

  const filteredPicker = useMemo(() => {
    const t = pickerSearch.trim().toLowerCase();
    if (!t) return equipment;
    return equipment.filter(e =>
      `${e.ride_name} ${e.ride_categories?.name || ''}`.toLowerCase().includes(t)
    );
  }, [equipment, pickerSearch]);

  const handleRideSelect = (ride: Ride) => {
    navigate(`/checks/register?rideId=${ride.id}`);
  };

  const handleStartCheck = (rideId: string) => {
    setPickerOpen(false);
    setPickerSearch('');
    navigate(`/rides/${rideId}?tab=checks`);
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <StaffAccountBanner />
      <ChecksOnboardingModal forceOpen={showGuide} onClose={() => setShowGuide(false)} />

      {/* ── PAGE HEADER ──────────────────────────── */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <PageHeader
            icon={<CheckSquare className="h-5 w-5 text-primary" />}
            iconBgClass="from-primary/20 to-primary/10"
            title="Checks"
            subtitle="Daily, pre-opening & periodic checks"
            showBackButton
            backTo="/overview"
            actions={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGuide(true)}
                className="text-muted-foreground hover:text-foreground h-9 px-2 sm:px-3"
              >
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline ml-1 text-xs">How it works</span>
              </Button>
            }
          />
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 space-y-5">

        {/* ── OFFLINE BANNER ──────────────────────── */}
        <OfflineStaleAlert />

        {/* ── PRIMARY CTA ────────────────────────── */}
        <Button
          onClick={() => setPickerOpen(true)}
          className="gap-1.5 h-10 min-h-[44px] w-full sm:w-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          Start Check
        </Button>

        {/* ── RECENT ACTIVITY SUMMARY ─────────────── */}
        {!isLoading && summary && (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => {/* Future: could filter to today */}}
              className={cn(
                'flex flex-col gap-1 p-3.5 rounded-2xl border border-border bg-card text-left',
                'hover:bg-muted/30 active:bg-muted/50 transition-colors min-h-[64px]'
              )}
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              <div className="text-2xl font-bold text-foreground leading-none">
                {summary.checksToday}
              </div>
              <div className="text-[10px] text-muted-foreground font-medium leading-tight">Completed Today</div>
            </button>
            <button
              onClick={() => {/* Future: could navigate with preset */}}
              className={cn(
                'flex flex-col gap-1 p-3.5 rounded-2xl border border-border bg-card text-left',
                'hover:bg-muted/30 active:bg-muted/50 transition-colors min-h-[64px]'
              )}
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              <div className="text-2xl font-bold text-foreground leading-none">
                {summary.checksLast7d}
              </div>
              <div className="text-[10px] text-muted-foreground font-medium leading-tight">Last 7 Days</div>
            </button>
          </div>
        )}

        {/* ── RECENT CHECKS PER RIDE ───────────────── */}
        {!isLoading && summary && summary.rides.length > 0 && (
          <div className="space-y-2.5">
            <h2 className="text-xs font-semibold text-muted-foreground tracking-widest uppercase flex items-center gap-1.5">
              <Clock className="h-3 w-3" strokeWidth={2} />
              Recent Activity
            </h2>
            {summary.rides.filter(r => r.lastCheckDate).map(ride => (
              <button
                key={ride.rideId}
                type="button"
                onClick={() => navigate(`/checks/register?rideId=${ride.rideId}`)}
                className={cn(
                  'w-full text-left flex items-center justify-between bg-card p-4 rounded-xl border border-border',
                  'hover:bg-muted/30 active:bg-muted/50 transition-colors min-h-[56px]'
                )}
                style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-semibold text-foreground truncate">{ride.rideName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ride.lastCheckLabel}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* ── SELECT EQUIPMENT SECTION ─────────── */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground mb-3 tracking-widest uppercase flex items-center gap-1.5">
            <ClipboardList className="h-3 w-3" strokeWidth={2} />
            All Equipment
          </h2>
          <RideSelector
            title="Select Equipment"
            description="Choose which ride, stall, or equipment to view checks for."
            actionLabel="Open Checks"
            icon={({ className }) => <CheckSquare className={className} />}
            onRideSelect={handleRideSelect}
            showAddRide={false}
          />
        </div>

      </main>

      {/* ── EQUIPMENT PICKER SHEET ────────────── */}
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-base">Select equipment to check</SheetTitle>
          </SheetHeader>

          <div className="mt-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search equipment…"
                className="pl-9 h-10 rounded-xl"
              />
            </div>

            <div className="space-y-2 overflow-auto pb-2" style={{ maxHeight: '55vh' }}>
              {equipLoading ? (
                <div className="text-sm text-muted-foreground text-center py-6">Loading…</div>
              ) : filteredPicker.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6">No matching equipment.</div>
              ) : (
                filteredPicker.map((ride) => (
                  <button
                    key={ride.id}
                    type="button"
                    className={cn(
                      'w-full text-left rounded-xl border border-border p-3 flex items-center justify-between gap-3',
                      'hover:bg-muted/30 active:bg-muted/50 active:scale-[0.99] transition-all min-h-[52px]'
                    )}
                    onClick={() => handleStartCheck(ride.id)}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{ride.ride_name}</div>
                      <div className="text-xs text-muted-foreground">{ride.ride_categories?.name || 'Equipment'}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  </button>
                ))
              )}
            </div>

            <Button variant="outline" className="w-full" onClick={() => setPickerOpen(false)} type="button">
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Checks;
