import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, HelpCircle, ClipboardList, Clock } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideSelector from '@/components/RideSelector';
import { ChecksOnboardingModal } from '@/components/ChecksOnboardingModal';
import { Button } from '@/components/ui/button';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import { OfflineStaleAlert } from '@/components/OfflineStaleAlert';
import { useRecentChecksSummary } from '@/hooks/useRecentChecksSummary';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

const Checks = () => {
  const navigate = useNavigate();
  const [showGuide, setShowGuide] = useState(false);
  const { data: summary, isLoading } = useRecentChecksSummary();

  const handleRideSelect = (ride: Ride) => {
    navigate(`/rides/${ride.id}?tab=checks`);
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <StaffAccountBanner />
      <ChecksOnboardingModal forceOpen={showGuide} onClose={() => setShowGuide(false)} />

      {/* ── PAGE HEADER ──────────────────────────── */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ backgroundColor: 'hsl(213 52% 24% / 0.1)' }}>
              <CheckSquare className="h-[18px] w-[18px] text-primary" strokeWidth={2} />
            </span>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-none">Checks</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Daily, pre-opening &amp; periodic checks</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowGuide(true)}
            className="text-muted-foreground hover:text-foreground h-9 px-2"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline ml-1 text-xs">How it works</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 space-y-5">

        {/* ── OFFLINE BANNER ──────────────────────── */}
        <OfflineStaleAlert />

        {/* ── RECENT ACTIVITY SUMMARY ─────────────── */}
        {!isLoading && summary && (
          <div className="grid grid-cols-2 gap-2">
            <div
              className="flex flex-col gap-1 p-3 rounded-2xl border border-border bg-card"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              <div className="text-2xl font-bold text-foreground leading-none">
                {summary.checksToday}
              </div>
              <div className="text-[10px] text-muted-foreground font-medium leading-tight">Completed Today</div>
            </div>
            <div
              className="flex flex-col gap-1 p-3 rounded-2xl border border-border bg-card"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              <div className="text-2xl font-bold text-foreground leading-none">
                {summary.checksLast7d}
              </div>
              <div className="text-[10px] text-muted-foreground font-medium leading-tight">Last 7 Days</div>
            </div>
          </div>
        )}

        {/* ── RECENT CHECKS PER RIDE ───────────────── */}
        {!isLoading && summary && summary.rides.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground tracking-widest uppercase flex items-center gap-1.5">
              <Clock className="h-3 w-3" strokeWidth={2} />
              Recent Activity
            </h2>
            {summary.rides.map(ride => (
              <div
                key={ride.rideId}
                className="flex items-center justify-between bg-card p-4 rounded-xl border border-border"
                style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-semibold text-foreground truncate">{ride.rideName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ride.lastCheckLabel}</p>
                </div>
                <button
                  onClick={() => navigate(`/rides/${ride.rideId}?tab=checks`)}
                  className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground"
                >
                  Open Checks
                </button>
              </div>
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
            description="Choose which ride, stall, or equipment you want to perform checks on."
            actionLabel="Open Checks"
            icon={({ className }) => <CheckSquare className={className} />}
            onRideSelect={handleRideSelect}
            showAddRide={false}
          />
        </div>

      </main>
    </div>
  );
};

export default Checks;
