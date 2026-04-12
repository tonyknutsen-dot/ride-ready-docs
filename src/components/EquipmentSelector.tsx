import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wrench, AlertTriangle, Clock, CheckCircle2, Search, Filter, CalendarDays, Sparkles, ChevronRight, Gauge, AlertOctagon } from 'lucide-react';
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

type ChecksStatus = 'has-checks' | 'has-templates' | 'inspection-due' | 'no-checks';

interface ChecksSummary {
  status: ChecksStatus;
  label: string;
  checkCount: number;
  templateCount: number;
  inspectionsDue: number;
}

type DefectPriority = 'stop-use' | 'open-defects' | 'low-severity' | 'no-defects';

interface DefectSummary {
  priority: DefectPriority;
  label: string;
  count: number;
  hasCritical: boolean;
}

interface EquipmentSelectorProps {
  onRideSelect: (ride: Ride) => void;
  placeholderIcon?: React.ComponentType<{ className?: string }>;
  emptyDescription?: string;
  showKpis?: boolean;
  categoryGroupFilter?: string;
  /** When true, shows pressure session status instead of maintenance schedule */
  pressureMode?: boolean;
  /** When true, shows defect severity status */
  defectMode?: boolean;
  /** When true, shows check template + inspection schedule status instead of maintenance */
  checksMode?: boolean;
}

const normalizeStatus = (status: string): keyof typeof STATUS_CONFIG => {
  const LEGACY_MAP: Record<string, keyof typeof STATUS_CONFIG> = {
    compliant: 'up-to-date',
  };
  const mapped = LEGACY_MAP[status] ?? status;
  return (mapped in STATUS_CONFIG) ? mapped as keyof typeof STATUS_CONFIG : 'no-data';
};

const STATUS_CONFIG = {
  overdue:      { label: 'Overdue',      chipClass: 'bg-destructive/10 text-destructive border-destructive/30',              accent: 'border-l-destructive',            dotClass: 'bg-destructive',       textClass: 'text-destructive',                  iconClass: 'text-destructive' },
  'due-soon':   { label: 'Due soon',     chipClass: 'bg-warning/10 text-warning border-warning/30',                          accent: 'border-l-warning',                dotClass: 'bg-amber-500',         textClass: 'text-amber-700 dark:text-amber-400', iconClass: 'text-amber-500' },
  'up-to-date': { label: 'Up to date',   chipClass: 'bg-primary/10 text-primary border-primary/30',                          accent: 'border-l-primary',                dotClass: 'bg-emerald-500',       textClass: 'text-emerald-700 dark:text-emerald-400', iconClass: 'text-emerald-500' },
  'no-data':    { label: 'No maintenance schedule', chipClass: 'bg-muted/60 text-muted-foreground border-border',                      accent: 'border-l-muted-foreground/30',    dotClass: 'bg-muted-foreground/30', textClass: 'text-muted-foreground',           iconClass: 'text-muted-foreground/40' },
} as const;

const CHECKS_STATUS_CONFIG: Record<ChecksStatus, { label: string; chipClass: string; accent: string; dotClass: string; textClass: string; iconClass: string }> = {
  'inspection-due': { label: 'Inspection due', chipClass: 'bg-warning/10 text-warning border-warning/30', accent: 'border-l-warning', dotClass: 'bg-amber-500', textClass: 'text-amber-700 dark:text-amber-400', iconClass: 'text-amber-500' },
  'has-checks':     { label: 'Checks active',  chipClass: 'bg-primary/10 text-primary border-primary/30', accent: 'border-l-primary', dotClass: 'bg-emerald-500', textClass: 'text-emerald-700 dark:text-emerald-400', iconClass: 'text-emerald-500' },
  'has-templates':  { label: 'Templates set up', chipClass: 'bg-primary/10 text-primary border-primary/30', accent: 'border-l-primary', dotClass: 'bg-blue-500', textClass: 'text-blue-700 dark:text-blue-400', iconClass: 'text-blue-500' },
  'no-checks':      { label: 'No checks set up', chipClass: 'bg-muted/60 text-muted-foreground border-border', accent: 'border-l-muted-foreground/30', dotClass: 'bg-muted-foreground/30', textClass: 'text-muted-foreground', iconClass: 'text-muted-foreground/40' },
};

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

const DEFECT_PRIORITY_CONFIG: Record<DefectPriority, { label: string; accent: string; dotClass: string; textClass: string; iconClass: string }> = {
  'stop-use': {
    label: 'Stop use defect open',
    accent: 'border-l-destructive',
    dotClass: 'bg-destructive',
    textClass: 'text-destructive font-semibold',
    iconClass: 'text-destructive',
  },
  'open-defects': {
    label: 'Open defects',
    accent: 'border-l-red-500',
    dotClass: 'bg-red-500',
    textClass: 'text-red-700 dark:text-red-400',
    iconClass: 'text-red-500',
  },
  'low-severity': {
    label: 'Low severity open',
    accent: 'border-l-amber-500',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700 dark:text-amber-400',
    iconClass: 'text-amber-500',
  },
  'no-defects': {
    label: 'No open defects',
    accent: 'border-l-muted-foreground/30',
    dotClass: 'bg-muted-foreground/30',
    textClass: 'text-muted-foreground',
    iconClass: 'text-muted-foreground/40',
  },
};

const EquipmentSelector = ({
  onRideSelect,
  placeholderIcon: PlaceholderIcon = Wrench,
  emptyDescription = 'Add equipment in the Equipment section to get started.',
  showKpis = true,
  categoryGroupFilter,
  pressureMode = false,
  defectMode = false,
  checksMode = false,
}: EquipmentSelectorProps) => {
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();

  const [rides, setRides] = useState<Ride[]>([]);
  const [summaries, setSummaries] = useState<Record<string, MaintenanceSummary>>({});
  const [pressureSummaries, setPressureSummaries] = useState<Record<string, PressureSummary>>({});
  const [defectSummaries, setDefectSummaries] = useState<Record<string, DefectSummary>>({});
  const [checksSummaries, setChecksSummaries] = useState<Record<string, ChecksSummary>>({});
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
        if (defectMode) {
          loaders.push(loadDefectSummaries(typedRides));
        }
        if (checksMode) {
          loaders.push(loadChecksSummaries(typedRides));
        }
        await Promise.all(loaders);
      }
    } catch (e) {
      console.error('Error loading rides:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadDefectSummaries = async (ridesList: Ride[]) => {
    try {
      const rideIds = ridesList.map(r => r.id);
      const { data: defects } = await supabase
        .from('defects')
        .select('ride_id, severity, status')
        .eq('user_id', effectiveUserId)
        .in('ride_id', rideIds)
        .in('status', ['open', 'acknowledged', 'in_progress']);

      const result: Record<string, DefectSummary> = {};

      for (const ride of ridesList) {
        const rideDefects = (defects || []).filter(d => d.ride_id === ride.id);
        const count = rideDefects.length;

        if (count === 0) {
          result[ride.id] = { priority: 'no-defects', label: 'No open defects', count: 0, hasCritical: false };
          continue;
        }

        const hasCritical = rideDefects.some(d => d.severity === 'stop_operation');
        const hasUrgent = rideDefects.some(d => d.severity === 'urgent');

        if (hasCritical) {
          result[ride.id] = { priority: 'stop-use', label: `Stop use defect open`, count, hasCritical: true };
        } else if (hasUrgent) {
          result[ride.id] = { priority: 'open-defects', label: `${count} open defect${count > 1 ? 's' : ''}`, count, hasCritical: false };
        } else {
          result[ride.id] = { priority: 'low-severity', label: `${count} low severity open`, count, hasCritical: false };
        }
      }

      setDefectSummaries(result);
    } catch (e) {
      console.warn('Could not load defect summaries:', e);
    }
  };

  const loadPressureSummaries = async (ridesList: Ride[]) => {
    try {
      const rideIds = ridesList.map(r => r.id);
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

      const latestByRide: Record<string, typeof sessions[0]> = {};
      for (const s of sessions) {
        if (!latestByRide[s.ride_id]) latestByRide[s.ride_id] = s;
      }

      const latestIds = Object.values(latestByRide).map(s => s.id);
      const { data: lines } = await supabase
        .from('pressure_session_lines')
        .select('session_id, pressure_value')
        .in('session_id', latestIds);

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

  // Sort by priority based on mode
  const sortedRides = pressureMode
    ? [...filteredRides].sort((a, b) => {
        const order: Record<PressureStatus, number> = { 'action-needed': 0, 'incomplete': 1, 'no-sessions': 2, 'passed': 3 };
        const sa = pressureSummaries[a.id]?.status ?? 'no-sessions';
        const sb = pressureSummaries[b.id]?.status ?? 'no-sessions';
        return order[sa] - order[sb];
      })
    : defectMode
    ? [...filteredRides].sort((a, b) => {
        const order: Record<DefectPriority, number> = { 'stop-use': 0, 'open-defects': 1, 'low-severity': 2, 'no-defects': 3 };
        const sa = defectSummaries[a.id]?.priority ?? 'no-defects';
        const sb = defectSummaries[b.id]?.priority ?? 'no-defects';
        return order[sa] - order[sb];
      })
    : filteredRides;

  // Determine accent and icon class for a card
  const getCardConfig = (ride: Ride) => {
    const summary = summaries[ride.id];
    const statusKey = normalizeStatus(summary?.status ?? 'no-data');
    const statusCfg = STATUS_CONFIG[statusKey];

    if (pressureMode) {
      const pSummary = pressureSummaries[ride.id] ?? { status: 'no-sessions' as PressureStatus, label: 'No pressure sessions logged yet', lastDate: null };
      const pCfg = PRESSURE_STATUS_CONFIG[pSummary.status];
      return { accent: pCfg.accent, iconClass: pCfg.iconClass, statusCfg, statusKey, pSummary, pCfg, dSummary: null, dCfg: null };
    }

    if (defectMode) {
      const dSummary = defectSummaries[ride.id] ?? { priority: 'no-defects' as DefectPriority, label: 'No open defects', count: 0, hasCritical: false };
      const dCfg = DEFECT_PRIORITY_CONFIG[dSummary.priority];
      return { accent: dCfg.accent, iconClass: dCfg.iconClass, statusCfg, statusKey, pSummary: null, pCfg: null, dSummary, dCfg };
    }

    // Standard mode — use maintenance status for accent and icon
    return { accent: statusCfg.accent, iconClass: statusCfg.iconClass, statusCfg, statusKey, pSummary: null, pCfg: null, dSummary: null, dCfg: null };
  };

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
            const { accent, iconClass, statusCfg, statusKey, pSummary, pCfg, dSummary, dCfg } = getCardConfig(ride);
            const summary = summaries[ride.id];
            const defectCount = summary?.openDefects ?? 0;
            const hasThumb = !!thumbs[ride.id];

            // Pick the right icon for current mode
            const IconComponent = pressureMode ? Gauge : defectMode ? AlertOctagon : PlaceholderIcon;

            return (
              <button
                key={ride.id}
                type="button"
                onClick={() => onRideSelect(ride)}
                className={cn(
                  'w-full text-left rounded-lg border border-border border-l-4 bg-card hover:bg-accent/30 active:bg-accent/50 active:scale-[0.99] transition-all',
                  accent,
                )}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Thumbnail or icon — tinted by status */}
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
                      defectMode && dSummary?.priority === 'stop-use' ? 'bg-destructive/10' :
                      defectMode && dSummary?.priority === 'open-defects' ? 'bg-red-500/10' :
                      defectMode && dSummary?.priority === 'low-severity' ? 'bg-amber-500/10' :
                      !pressureMode && !defectMode && statusKey === 'overdue' ? 'bg-destructive/10' :
                      !pressureMode && !defectMode && statusKey === 'due-soon' ? 'bg-amber-500/10' :
                      !pressureMode && !defectMode && statusKey === 'up-to-date' ? 'bg-emerald-500/10' :
                      'bg-muted/60',
                    )}>
                      <IconComponent className={cn("h-5 w-5", iconClass)} />
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
                        {/* Defect pill (shown in standard + pressure mode, not defect mode since it has its own line) */}
                        {!defectMode && defectCount > 0 && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border bg-destructive/10 text-destructive border-destructive/30">
                            {defectCount} defect{defectCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {/* Status chip (non-pressure, non-defect mode) */}
                        {!pressureMode && !defectMode && (
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

                    {/* Defect status line (defect mode) */}
                    {defectMode && dSummary && dCfg && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', dCfg.dotClass)} />
                        <span className={cn('text-[11px] font-medium', dCfg.textClass)}>
                          {dSummary.label}
                        </span>
                      </div>
                    )}

                    {/* Status line for standard mode (Checks / Maintenance) */}
                    {!pressureMode && !defectMode && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', statusCfg.dotClass)} />
                        <span className={cn('text-[11px] font-medium', statusCfg.textClass)}>
                          {statusKey === 'overdue' ? 'Overdue – service needed' :
                           statusKey === 'due-soon' ? 'Due soon' :
                           statusKey === 'up-to-date' ? 'Up to date' :
                           summary?.lastServiceDate ? 'No due date set' : 'No maintenance logged'}
                        </span>
                        {summary?.nextDueDate && statusKey !== 'no-data' && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            · {format(new Date(summary.nextDueDate), 'd MMM yyyy')}
                          </span>
                        )}
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
