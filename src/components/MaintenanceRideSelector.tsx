import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Wrench, AlertTriangle, Clock, CheckCircle2, Search, Filter, CalendarDays, Sparkles, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { EmptyState } from '@/components/EmptyState';
import { format, isBefore, addDays } from 'date-fns';

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

interface MaintenanceRideSelectorProps {
  onRideSelect: (ride: Ride) => void;
}

// Normalize legacy status values to current keys
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

const MaintenanceRideSelector = ({ onRideSelect }: MaintenanceRideSelectorProps) => {
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();

  const [rides, setRides] = useState<Ride[]>([]);
  const [summaries, setSummaries] = useState<Record<string, MaintenanceSummary>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'overdue' | 'due-soon' | 'up-to-date'>('all');

  useEffect(() => {
    if (user && effectiveUserId) loadAll();
  }, [user, effectiveUserId]);

  const loadAll = async () => {
    try {
      const { data: ridesData, error } = await supabase
        .from('rides')
        .select('*, ride_categories(name, description, category_group)')
        .eq('user_id', effectiveUserId)
        .order('ride_name');

      if (error) throw error;
      const typedRides = ridesData as Ride[];
      setRides(typedRides);

      if (typedRides.length) {
        await Promise.all([
          loadMaintenanceSummaries(typedRides),
          loadThumbnails(typedRides),
        ]);
      }
    } catch (e) {
      console.error('Error loading rides:', e);
    } finally {
      setLoading(false);
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
          // Has records but no future due date → show "No schedule" not "Up to date"
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
        </div>
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
      {rides.length > 0 && (
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
        </div>
      )}

      {/* ── Equipment List ── */}
      {rides.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No equipment found"
          description="Add rides or equipment in the Rides section to start tracking maintenance."
        />
      ) : filteredRides.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Filter className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
          <p className="text-sm">No equipment matches your filter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRides.map((ride) => {
            const summary = summaries[ride.id];
            const statusKey = normalizeStatus(summary?.status ?? 'no-data');
            const statusCfg = STATUS_CONFIG[statusKey];
            const hasThumb = !!thumbs[ride.id];
            const defectCount = summary?.openDefects ?? 0;

            return (
              <button
                key={ride.id}
                type="button"
                onClick={() => onRideSelect(ride)}
                className={`w-full text-left rounded-lg border border-border border-l-4 ${statusCfg.accent} bg-card hover:bg-accent/30 active:bg-accent/50 active:scale-[0.99] transition-all`}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Thumbnail or compact icon */}
                  {hasThumb ? (
                    <img
                      src={thumbs[ride.id]}
                      alt={ride.ride_name}
                      className="w-14 h-14 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                      <Wrench className="h-5 w-5 text-muted-foreground/50" />
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
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${statusCfg.chipClass}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>

                    {/* Compact summary row */}
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

export default MaintenanceRideSelector;
