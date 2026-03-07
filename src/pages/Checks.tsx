import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, HelpCircle, ClipboardList, Clock, ChevronRight, Plus } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideSelector from '@/components/RideSelector';
import { ChecksOnboardingModal } from '@/components/ChecksOnboardingModal';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import { OfflineStaleAlert } from '@/components/OfflineStaleAlert';
import { useRecentChecksSummary } from '@/hooks/useRecentChecksSummary';
import EquipmentPickerDialog from '@/components/EquipmentPickerDialog';
import { cn } from '@/lib/utils';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

const Checks = () => {
  const navigate = useNavigate();
  const [showGuide, setShowGuide] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: summary, isLoading } = useRecentChecksSummary();

  const handleRideSelect = (ride: Ride) => {
    navigate(`/checks/register?rideId=${ride.id}`);
  };

  const handleStartCheck = (ride: any) => {
    setPickerOpen(false);
    navigate(`/rides/${ride.id}?tab=checks`);
  };

  return (
    <div className="space-y-3 px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8">
      <StaffAccountBanner />
      <ChecksOnboardingModal forceOpen={showGuide} onClose={() => setShowGuide(false)} />

      {/* ── PAGE HEADER ── */}
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
            className="text-muted-foreground hover:text-foreground h-8 px-2 sm:px-3 text-[13px]"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">How it works</span>
          </Button>
        }
      />

      {/* ── OFFLINE BANNER ── */}
      <OfflineStaleAlert />

      {/* ── PRIMARY CTA ── */}
      <Button
        onClick={() => setPickerOpen(true)}
        className="gap-2 h-10 min-h-[44px] w-full sm:w-auto text-[13px] font-semibold rounded-xl"
      >
        <Plus className="h-4 w-4" />
        Start Check
      </Button>

      {/* ── RECENT ACTIVITY SUMMARY ── */}
      {!isLoading && summary && (
        <div className="grid grid-cols-2 gap-2.5">
          <div
            className={cn(
              'flex flex-col gap-1 p-3.5 rounded-xl border border-border bg-card text-left',
              'min-h-[64px]'
            )}
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
            <div className="text-2xl font-bold text-foreground leading-none">
              {summary.checksToday}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium leading-tight">Completed Today</div>
          </div>
          <div
            className={cn(
              'flex flex-col gap-1 p-3.5 rounded-xl border border-border bg-card text-left',
              'min-h-[64px]'
            )}
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
            <div className="text-2xl font-bold text-foreground leading-none">
              {summary.checksLast7d}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium leading-tight">Last 7 Days</div>
          </div>
        </div>
      )}

      {/* ── RECENT CHECKS PER RIDE ── */}
      {!isLoading && summary && summary.rides.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5">
            <Clock className="h-3 w-3" strokeWidth={2} />
            Recent Activity
          </h2>
          {summary.rides.filter(r => r.lastCheckDate).map(ride => (
            <button
              key={ride.rideId}
              type="button"
              onClick={() => navigate(`/checks/register?rideId=${ride.rideId}`)}
              className={cn(
                'w-full text-left flex items-center justify-between bg-card p-3.5 rounded-xl border border-border',
                'hover:bg-muted/30 active:bg-muted/50 transition-colors min-h-[56px]'
              )}
              style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
            >
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-[13px] font-semibold text-foreground truncate">{ride.rideName}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{ride.lastCheckLabel}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* ── SELECT EQUIPMENT SECTION ── */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground mb-3 tracking-wider uppercase flex items-center gap-1.5">
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

      {/* ── EQUIPMENT PICKER ── */}
      <EquipmentPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Select equipment to check"
        subtitle="Choose a ride or equipment to start a new check"
        onSelect={handleStartCheck}
      />
    </div>
  );
};

export default Checks;
