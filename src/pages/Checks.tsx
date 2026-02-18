import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, HelpCircle, AlertTriangle, Clock, CheckCircle2,
  Calendar, ChevronRight, ClipboardList, Zap
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideSelector from '@/components/RideSelector';
import { ChecksOnboardingModal } from '@/components/ChecksOnboardingModal';
import { Button } from '@/components/ui/button';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import { useChecksCompliance, CheckRideStatus } from '@/hooks/useChecksCompliance';


type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

const statusConfig = {
  overdue: {
    label: 'Overdue',
    icon: AlertTriangle,
    dotColor: 'bg-destructive',
    textColor: 'text-destructive',
    badgeBg: 'bg-destructive/10 text-destructive border-destructive/20',
    accentColor: 'hsl(0 72% 51%)',
  },
  due_today: {
    label: 'Due Today',
    icon: Clock,
    dotColor: 'bg-warning',
    textColor: 'text-warning',
    badgeBg: 'bg-warning/10 text-warning border-warning/20',
    accentColor: 'hsl(38 92% 50%)',
  },
  due_soon: {
    label: 'Due Soon',
    icon: Calendar,
    dotColor: 'bg-info',
    textColor: 'text-info',
    badgeBg: 'bg-info/10 text-info border-info/20',
    accentColor: 'hsl(221 83% 53%)',
  },
  ok: {
    label: 'Up to Date',
    icon: CheckCircle2,
    dotColor: 'bg-success',
    textColor: 'text-success',
    badgeBg: 'bg-success/10 text-success border-success/20',
    accentColor: 'hsl(142 76% 36%)',
  },
};

const RideStatusRow = ({
  ride,
  onNavigate,
}: {
  ride: CheckRideStatus;
  onNavigate: (rideId: string) => void;
}) => {
  const cfg = statusConfig[ride.status];
  const Icon = cfg.icon;
  return (
    <button
      onClick={() => onNavigate(ride.rideId)}
      className="w-full flex items-center gap-3 py-3 px-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-secondary transition-all text-left"
      style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dotColor}`} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-foreground block truncate">{ride.rideName}</span>
        <span className="text-xs text-muted-foreground">{ride.categoryName}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs font-semibold flex items-center gap-1 ${cfg.textColor}`}>
          <Icon className="h-3 w-3" strokeWidth={2} />
          {ride.status === 'overdue'
            ? ride.daysSinceLastCheck === null
              ? 'No checks'
              : `${ride.daysSinceLastCheck}d ago`
            : ride.status === 'due_today'
            ? 'Due today'
            : ride.status === 'due_soon'
            ? 'Due soon'
            : ride.lastCheckDate
            ? 'Up to date'
            : 'OK'}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
      </div>
    </button>
  );
};

const Checks = () => {
  const navigate = useNavigate();
  const [showGuide, setShowGuide] = useState(false);
  const { data: compliance, isLoading } = useChecksCompliance();

  const handleRideSelect = (ride: Ride) => {
    navigate(`/rides/${ride.id}?tab=checks`);
  };

  const handleNavigateToRide = (rideId: string) => {
    navigate(`/rides/${rideId}?tab=checks`);
  };

  const stats = compliance?.stats;
  const hasAlerts = (stats?.overdueCount ?? 0) > 0;

  const kpiCards = [
    {
      label: 'Overdue',
      value: stats?.overdueCount ?? 0,
      accentColor: 'hsl(0 72% 51%)',
      icon: AlertTriangle,
    },
    {
      label: 'Due Today',
      value: stats?.dueTodayCount ?? 0,
      accentColor: 'hsl(38 92% 50%)',
      icon: Clock,
    },
    {
      label: 'Due Soon',
      value: stats?.dueSoonCount ?? 0,
      accentColor: 'hsl(221 83% 53%)',
      icon: Calendar,
    },
    {
      label: 'Done (7d)',
      value: stats?.completedLast7dCount ?? 0,
      accentColor: 'hsl(142 76% 36%)',
      icon: CheckCircle2,
    },
  ];

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
              <h1 className="text-lg font-bold text-foreground leading-none">Safety Checks</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Inspections &amp; compliance</p>
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

        {/* ── COMPLIANCE ALERT BANNER ───────────── */}
        {!isLoading && hasAlerts && (
          <div className="bg-destructive/5 border border-destructive/30 rounded-2xl px-4 py-3.5 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" strokeWidth={2} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-destructive">
                {stats!.overdueCount} ride{stats!.overdueCount !== 1 ? 's' : ''} need{stats!.overdueCount === 1 ? 's' : ''} a check
              </p>
              <p className="text-xs text-destructive/70 mt-0.5">Daily safety checks are overdue. Action required.</p>
            </div>
          </div>
        )}

        {/* ── KPI STRIP ────────────────────────── */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground mb-3 tracking-widest uppercase">Check Status</h2>
          <div className="grid grid-cols-4 gap-2">
            {kpiCards.map(({ label, value, accentColor, icon: Icon }) => (
              <div
                key={label}
                className="flex flex-col gap-2 p-3 rounded-2xl border border-border bg-card overflow-hidden relative"
                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
              >
                <span className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ backgroundColor: accentColor }} />
                <span className="flex items-center justify-center w-7 h-7 rounded-lg mt-1" style={{ backgroundColor: `${accentColor}18` }}>
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} style={{ color: accentColor }} />
                </span>
                <div>
                  <div className="text-xl font-bold text-foreground leading-none">{isLoading ? '–' : value}</div>
                  <div className="text-[10px] text-muted-foreground font-medium mt-0.5 leading-tight">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── PRIORITY LISTS ───────────────────── */}
        {!isLoading && (
          <>
            {/* Overdue */}
            {(compliance?.overdueRides.length ?? 0) > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-destructive tracking-widest uppercase flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                  Overdue ({compliance!.overdueRides.length})
                </h2>
                {compliance!.overdueRides.map(ride => (
                  <RideStatusRow key={ride.rideId} ride={ride} onNavigate={handleNavigateToRide} />
                ))}
              </div>
            )}

            {/* Due Today */}
            {(compliance?.dueTodayRides.length ?? 0) > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-warning tracking-widest uppercase flex items-center gap-1.5">
                  <Clock className="h-3 w-3" strokeWidth={2} />
                  Due Today ({compliance!.dueTodayRides.length})
                </h2>
                {compliance!.dueTodayRides.map(ride => (
                  <RideStatusRow key={ride.rideId} ride={ride} onNavigate={handleNavigateToRide} />
                ))}
              </div>
            )}

            {/* Due Soon */}
            {(compliance?.dueSoonRides.length ?? 0) > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-info tracking-widest uppercase flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" strokeWidth={2} />
                  Due Soon ({compliance!.dueSoonRides.length})
                </h2>
                {compliance!.dueSoonRides.map(ride => (
                  <RideStatusRow key={ride.rideId} ride={ride} onNavigate={handleNavigateToRide} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── SELECT EQUIPMENT SECTION ─────────── */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground mb-3 tracking-widest uppercase flex items-center gap-1.5">
            <ClipboardList className="h-3 w-3" strokeWidth={2} />
            All Equipment
          </h2>
          <RideSelector
            title="Select Equipment"
            description="Choose which ride, stall, or equipment you want to perform safety checks on."
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
