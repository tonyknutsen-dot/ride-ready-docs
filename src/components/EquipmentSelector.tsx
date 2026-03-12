import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wrench, AlertTriangle, Clock, CheckCircle2, Search, Filter, CalendarDays, Sparkles, ChevronRight, Gauge } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { EmptyState } from '@/components/EmptyState';
import { format, isBefore, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

interface MaintenanceSummary {
  rideId: string;
  lastServiceDate: string | null;
  nextDueDate: string | null;
  openDefects: number;
  status: 'up-to-date' | 'due-soon' | 'overdue' | 'no-data';
}

type PressureStatus = 'action-needed' | 'passed' | 'incomplete' | 'no-sessions';

interface PressureSummary {
  status: PressureStatus;
  label: string;
  lastDate: string | null;
}

interface EquipmentSelectorProps {
  onRideSelect: (ride: Ride) => void;
  placeholderIcon?: React.ComponentType<{ className?: string }>;
  emptyDescription?: string;
  showKpis?: boolean;
  categoryGroupFilter?: string;
  /** When true, shows pressure session status instead of maintenance schedule */
  pressureMode?: boolean;
}

const normalizeStatus = (status: string): keyof typeof STATUS_CONFIG => {
  const LEGACY_MAP: Record<string, keyof typeof STATUS_CONFIG> = {
    compliant: 'up-to-date',
  };
  const mapped = LEGACY_MAP[status] ?? status;
  return (mapped in STATUS_CONFIG) ? mapped as keyof typeof STATUS_CONFIG : 'no-data';
};

const STATUS_CONFIG = {
  overdue:      { label: 'Overdue',      chipClass: 'bg-destructive/10 text-destructive border-destructive/30',              accent: 'border-l-destructive' },
  'due-soon':   { label: 'Due soon',     chipClass: 'bg-warning/10 text-warning border-warning/30',                          accent: 'border-l-warning' },
  'up-to-date': { label: 'Up to date',   chipClass: 'bg-primary/10 text-primary border-primary/30',                          accent: 'border-l-primary' },
  'no-data':    { label: 'No schedule',   chipClass: 'bg-muted/60 text-muted-foreground border-border',                      accent: 'border-l-muted-foreground/30' },
} as const;

const PRESSURE_STATUS_CONFIG: Record<PressureStatus, { label: string; chipClass: string; accent: string; iconClass: string }> = {
  'action-needed': {
    label: 'Action needed',
    chipClass: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
    accent: 'border-l-red-500',
    iconClass: 'text-red-500',
  },
  'incomplete': {
    label: 'Incomplete',
    chipClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    accent: 'border-l-amber-500',
    iconClass: 'text-amber-500',
  },
  'passed': {
    label: 'Last session passed',
    chipClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    accent: 'border-l-emerald-500',
    iconClass: 'text-emerald-500',
  },
  'no-sessions': {
    label: 'No sessions yet',
    chipClass: 'bg-muted/60 text-muted-foreground border-border',
    accent: 'border-l-muted-foreground/30',
    iconClass: 'text-muted-foreground/40',
  },
};

const EquipmentSelector = ({
  onRideSelect,
  placeholderIcon: PlaceholderIcon = Wrench,
  emptyDescription = 'Add rides or equipment in the Rides section to get started.',
  showKpis = true,
  categoryGroupFilter,
  pressureMode = false,
}: EquipmentSelectorProps) => {
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();

  const [rides, setRides] = useState<Ride[]>([]);
  const [summaries, setSummaries] = useState<Record<string, MaintenanceSummary>>({});
  const [pressureSummaries, setPressureSummaries] = useState<Record<string, PressureSummary>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'overdue' | 'due-soon' | 'up-to-date'>('all');

  useEffect(() => {
    if (user && effectiveUserId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, effectiveUserId]);

  const loadAll = async () => {
    try {
      let query = supabase
        .from('rides')
        .select('*, ride_categories(name, description, category_group)')
        .order('ride_name');

      if (!isStaff) {
        query = query.eq('user_id', effectiveUserId);
      }

      const { data: ridesData, error } = await query;
      if (error) throw error;
      const typedRides = (ridesData as Ride[]).filter(r => {
        if (!categoryGroupFilter) return true;
        return r.ride_categories?.category_group === categoryGroupFilter;
      });
      setRides(typedRides);

      if (typedRides.length) {
        const loaders: Promise<void>[] = [
          loadMaintenanceSummaries(typedRides),
          loadThumbnails(typedRides),
        ];
        if (pressureMode) {
          loaders.push(loadPressureSummaries(typedRides));
        }
        await Promise.all(loaders);
      }
    } catch (e) {
      console.error('Error loading rides:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadPressureSummaries = async (ridesList: Ride[]) => {
    try {
      const rideIds = ridesList.map(r => r.id);
      // Get the latest session per ride with its lines
      const { data: sessions } = await supabase
        .from('pressure_sessions')
        .select('id, ride_id, session_date, session_time, is_complete')
        .in('ride_id', rideIds)
        .order('session_date', { ascending: false })
        .order('session_time', { ascending: false });

      if (!sessions?.length) {
        const empty: Record<string, PressureSummary> = {};
        for (const r of ridesList) {
          empty[r.id] = { status: 'no-sessions', label: 'No pressure sessions logged yet', lastDate: null };
        }
        setPressureSummaries(empty);
        return;
      }

      // Get latest session per ride
      const latestByRide: Record<string, typeof sessions[0]> = {};
      for (const s of sessions) {
        if (!latestByRide[s.ride_id]) latestByRide[s.ride_id] = s;
      }

      // Load lines for latest sessions
      const latestIds = Object.values(latestByRide).map(s => s.id);
      const { data: lines } = await supabase
        .from('pressure_session_lines')
        .select('session_id, pressure_value')
        .in('session_id', latestIds);

      // Load section configs for validation
      const result: Record<string, PressureSummary> = {};

      for (const ride of ridesList) {
        const latest = latestByRide[ride.id];
        if (!latest) {
          result[ride.id] = { status: 'no-sessions', label: 'No pressure sessions logged yet', lastDate: null };
          continue;
        }

        const sessionLines = (lines || []).filter(l => l.session_id === latest.id);
        const lastDate = latest.session_date;

        if (!latest.is_complete) {
          result[ride.id] = { status: 'incomplete', label: 'Incomplete', lastDate };
          continue;
        }

        // Check for out-of-range using ride's section_config
        const sectionCfg = ((ride as any).section_config as Array<{ min_pressure?: number; max_pressure?: number }>) || [];
        let hasOutOfRange = false;

        sessionLines.forEach((line, idx) => {
          if (line.pressure_value == null) return;
          const limits = sectionCfg[idx];
          if (!limits) return;
          if (limits.min_pressure != null && line.pressure_value < limits.min_pressure) hasOutOfRange = true;
          if (limits.max_pressure != null && line.pressure_value > limits.max_pressure) hasOutOfRange = true;
        });

        if (hasOutOfRange) {
          result[ride.id] = { status: 'action-needed', label: 'Pressure action needed', lastDate };
        } else {
          result[ride.id] = { status: 'passed', label: 'Last session passed', lastDate };
        }
      }

      setPressureSummaries(result);
    } catch (e) {
      console.warn('Could not load pressure summaries:', e);
    }
  };

  const loadMaintenanceSummaries = async (ridesList: Ride[]) => {
    try {
      const rideIds = ridesList.map(r => r.id);

      const { data: records } = await supabase
        .from('maintenance_records')
        .select('ride_id, maintenance_date, next_maintenance_due')
        .eq('user_id', effectiveUserId)
        .in('ride_id', rideIds)
        .order('maintenance_date', { ascending: false });

      const { data: defects } = await supabase
        .from('defects')
        .select('ride_id, status')
        .eq('user_id', effectiveUserId)
        .in('ride_id', rideIds)
        .in('status', ['open', 'acknowledged', 'in_progress']);

      const today = new Date();
      const soon = addDays(today, 30);

      const newSummaries: Record<string, MaintenanceSummary> = {};

      for (const ride of ridesList) {
        const rideRecords = (records || []).filter(r => r.ride_id === ride.id);
        const latestRecord = rideRecords[0];
        const openDefects = (defects || []).filter(d => d.ride_id === ride.id).length;

        let lastServiceDate: string | null = null;
        let nextDueDate: string | null = null;

        if (latestRecord) {
          lastServiceDate = latestRecord.maintenance_date;
          const dueDates = rideRecords
            .map(r => r.next_maintenance_due)
            .filter(Boolean) as string[];
          if (dueDates.length) {
            nextDueDate = dueDates.sort().reverse()[0];
          }
        }

        let status: MaintenanceSummary['status'] = 'no-data';
        if (nextDueDate) {
          const due = new Date(nextDueDate);
          if (isBefore(due, today)) status = 'overdue';
          else if (isBefore(due, soon)) status = 'due-soon';
          else status = 'up-to-date';
        } else if (lastServiceDate) {
          status = 'no-data';
        }

        newSummaries[ride.id] = { rideId: ride.id, lastServiceDate, nextDueDate, openDefects, status };
      }

      setSummaries(newSummaries);
    } catch (e) {
      console.warn('Could not load maintenance summaries:', e);
    }
  };

  const loadThumbnails = async (ridesList: Ride[]) => {
    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('id, file_path, ride_id')
        .in('ride_id', ridesList.map(r => r.id))
        .eq('user_id', effectiveUserId)
        .eq('document_type', 'photo')
        .order('uploaded_at', { ascending: false });

      if (!docs?.length) return;

      const photosByRide = new Map<string, string>();
      for (const doc of docs) {
        if (doc.ride_id && !photosByRide.has(doc.ride_id)) {
          photosByRide.set(doc.ride_id, doc.file_path);
        }
      }

      const results = await Promise.all(
        Array.from(photosByRide.entries()).map(async ([rideId, filePath]) => {
          const { data } = await supabase.storage.from('ride-documents').createSignedUrl(filePath, 3600);
          return { rideId, url: data?.signedUrl };
        })
      );

      const next: Record<string, string> = {};
      for (const { rideId, url } of results) {
        if (url) next[rideId] = url;
      }
      setThumbs(next);
    } catch (e) {
      console.warn('Thumb load skipped:', e);
    }
  };

  // KPI totals
  const kpis = {
    overdue: Object.values(summaries).filter(s => s.status === 'overdue').length,
    dueSoon: Object.values(summaries).filter(s => s.status === 'due-soon').length,
    openDefects: Object.values(summaries).reduce((acc, s) => acc + s.openDefects, 0),
    upToDate: Object.values(summaries).filter(s => s.status === 'up-to-date').length,
  };

  const filteredRides = rides.filter(ride => {
    const matchesSearch = ride.ride_name.toLowerCase().includes(searchQuery.toLowerCase());
    const summary = summaries[ride.id];
    const matchesFilter = filterStatus === 'all' || (summary?.status === filterStatus);
    return matchesSearch && matchesFilter;
  });

  // In pressure mode, sort by priority: action-needed first, then incomplete, then no-sessions, then passed
  const sortedRides = pressureMode
    ? [...filteredRides].sort((a, b) => {
        const order: Record<PressureStatus, number> = { 'action-needed': 0, 'incomplete': 1, 'no-sessions': 2, 'passed': 3 };
        const sa = pressureSummaries[a.id]?.status ?? 'no-sessions';
        const sb = pressureSummaries[b.id]?.status ?? 'no-sessions';
        return order[sa] - order[sb];
      })
    : filteredRides;

  if (loading) {
    return (
      <div className="space-y-4">
        {showKpis && (
          <div className="grid grid-cols-4 gap-2">
            {[1,2,3,4].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
          </div>
        )}
        <div className="h-10 bg-muted rounded-lg animate-pulse" />
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── KPI Strip ── */}
      {showKpis && rides.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { count: kpis.overdue,     label: 'Overdue',      icon: AlertTriangle, active: kpis.overdue > 0,     activeColor: 'text-destructive' },
            { count: kpis.dueSoon,     label: 'Due soon',     icon: Clock,         active: kpis.dueSoon > 0,     activeColor: 'text-warning' },
            { count: kpis.openDefects, label: 'Open defects', icon: Wrench,        active: kpis.openDefects > 0, activeColor: 'text-destructive' },
            { count: kpis.upToDate,    label: 'Up to date',   icon: CheckCircle2,  active: false,                activeColor: 'text-primary' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-lg border border-border bg-card px-2.5 py-2 text-center">
              <p className={`text-lg font-bold leading-none ${kpi.active ? kpi.activeColor : 'text-foreground'}`}>{kpi.count}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Search + Filter ── */}
      {rides.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search equipment…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
          {showKpis && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {(['all', 'overdue', 'due-soon', 'up-to-date'] as const).map(f => (
                <Button
                  key={f}
                  variant={filterStatus === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus(f)}
                  className="text-[11px] h-8 px-3 rounded-full whitespace-nowrap shrink-0"
                >
                  {f === 'all' ? 'All' : f === 'due-soon' ? 'Due soon' : f === 'up-to-date' ? 'Up to date' : 'Overdue'}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Equipment List ── */}
      {rides.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No equipment found"
          description={emptyDescription}
        />
      ) : sortedRides.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Filter className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
          <p className="text-sm">No equipment matches your filter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedRides.map((ride) => {
            const summary = summaries[ride.id];
            const defectCount = summary?.openDefects ?? 0;
            const pSummary = pressureMode ? (pressureSummaries[ride.id] ?? { status: 'no-sessions' as PressureStatus, label: 'No pressure sessions logged yet', lastDate: null }) : null;
            const pCfg = pSummary ? PRESSURE_STATUS_CONFIG[pSummary.status] : null;

            // In pressure mode, use pressure accent; otherwise use maintenance accent
            const statusKey = normalizeStatus(summary?.status ?? 'no-data');
            const statusCfg = STATUS_CONFIG[statusKey];
            const accentClass = pressureMode && pCfg ? pCfg.accent : statusCfg.accent;
            const hasThumb = !!thumbs[ride.id];

            return (
              <button
                key={ride.id}
                type="button"
                onClick={() => onRideSelect(ride)}
                className={cn(
                  'w-full text-left rounded-lg border border-border border-l-4 bg-card hover:bg-accent/30 active:bg-accent/50 active:scale-[0.99] transition-all',
                  accentClass,
                )}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Thumbnail or icon — tinted by pressure status */}
                  {hasThumb ? (
                    <img
                      src={thumbs[ride.id]}
                      alt={ride.ride_name}
                      className="w-14 h-14 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className={cn(
                      "w-14 h-14 rounded-lg flex items-center justify-center shrink-0",
                      pressureMode && pSummary?.status === 'action-needed' ? 'bg-red-500/10' :
                      pressureMode && pSummary?.status === 'passed' ? 'bg-emerald-500/10' :
                      'bg-muted/60',
                    )}>
                      {pressureMode ? (
                        <Gauge className={cn("h-5 w-5", pCfg?.iconClass ?? 'text-muted-foreground/50')} />
                      ) : (
                        <PlaceholderIcon className="h-5 w-5 text-muted-foreground/50" />
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{ride.ride_name}</p>
                        <p className="text-[10px] text-muted-foreground">{ride.ride_categories.name}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {defectCount > 0 && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border bg-destructive/10 text-destructive border-destructive/30">
                            {defectCount} defect{defectCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {!pressureMode && (
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${statusCfg.chipClass}`}>
                            {statusCfg.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pressure status line (pressure mode) */}
                    {pressureMode && pSummary && pCfg && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={cn(
                          'inline-block h-2 w-2 rounded-full shrink-0',
                          pSummary.status === 'action-needed' ? 'bg-red-500' :
                          pSummary.status === 'passed' ? 'bg-emerald-500' :
                          pSummary.status === 'incomplete' ? 'bg-amber-500' :
                          'bg-muted-foreground/30',
                        )} />
                        <span className={cn(
                          'text-[11px] font-medium',
                          pSummary.status === 'action-needed' ? 'text-red-700 dark:text-red-400' :
                          pSummary.status === 'passed' ? 'text-emerald-700 dark:text-emerald-400' :
                          pSummary.status === 'incomplete' ? 'text-amber-700 dark:text-amber-400' :
                          'text-muted-foreground',
                        )}>
                          {pSummary.label}
                        </span>
                        {pSummary.lastDate && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            · {format(new Date(pSummary.lastDate), 'd MMM yyyy')}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Maintenance summary row (non-pressure mode) */}
                    {!pressureMode && (
                      <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {summary?.lastServiceDate
                            ? format(new Date(summary.lastServiceDate), 'd MMM yyyy')
                            : <span className="italic">No maintenance logged</span>}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className={`flex items-center gap-1 ${statusKey === 'overdue' ? 'text-destructive font-medium' : statusKey === 'due-soon' ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
                          <Clock className="h-3 w-3" />
                          {summary?.nextDueDate
                            ? format(new Date(summary.nextDueDate), 'd MMM yyyy')
                            : <span className="italic">No due date set</span>}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Chevron */}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EquipmentSelector;
