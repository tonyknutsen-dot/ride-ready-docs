import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Wrench, AlertTriangle, Clock, CheckCircle2, Search, Filter, CalendarDays, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { EmptyState } from '@/components/EmptyState';
import { format, isAfter, isBefore, addDays } from 'date-fns';

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
  status: 'compliant' | 'due-soon' | 'overdue' | 'no-data';
}

interface MaintenanceRideSelectorProps {
  onRideSelect: (ride: Ride) => void;
}

const STATUS_CONFIG = {
  overdue:   { label: 'Overdue',    bg: 'bg-destructive/10', text: 'text-destructive',        border: 'border-destructive/30',       accent: 'border-l-destructive' },
  'due-soon':{ label: 'Due Soon',   bg: 'bg-warning/10',     text: 'text-warning',            border: 'border-warning/30',           accent: 'border-l-warning' },
  compliant: { label: 'Compliant',  bg: 'bg-primary/10',     text: 'text-primary',            border: 'border-primary/30',           accent: 'border-l-primary' },
  'no-data': { label: 'No Records', bg: 'bg-muted/40',       text: 'text-muted-foreground',   border: 'border-border',               accent: 'border-l-muted-foreground/30' },
};

const MaintenanceRideSelector = ({ onRideSelect }: MaintenanceRideSelectorProps) => {
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();

  const [rides, setRides] = useState<Ride[]>([]);
  const [summaries, setSummaries] = useState<Record<string, MaintenanceSummary>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'overdue' | 'due-soon' | 'compliant'>('all');

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

      // Fetch latest maintenance records per ride
      const { data: records } = await supabase
        .from('maintenance_records')
        .select('ride_id, maintenance_date, next_maintenance_due')
        .eq('user_id', effectiveUserId)
        .in('ride_id', rideIds)
        .order('maintenance_date', { ascending: false });

      // Fetch open defects counts
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
          // Find the latest next_maintenance_due across all records for this ride
          const dueDates = rideRecords
            .map(r => r.next_maintenance_due)
            .filter(Boolean) as string[];
          if (dueDates.length) {
            nextDueDate = dueDates.sort().reverse()[0]; // latest
          }
        }

        let status: MaintenanceSummary['status'] = 'no-data';
        if (nextDueDate) {
          const due = new Date(nextDueDate);
          if (isBefore(due, today)) status = 'overdue';
          else if (isBefore(due, soon)) status = 'due-soon';
          else status = 'compliant';
        } else if (lastServiceDate) {
          status = 'compliant';
        }

        // Override if there are open defects of stop_operation severity
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
    compliant: Object.values(summaries).filter(s => s.status === 'compliant').length,
  };

  const filteredRides = rides.filter(ride => {
    const matchesSearch = ride.ride_name.toLowerCase().includes(searchQuery.toLowerCase());
    const summary = summaries[ride.id];
    const matchesFilter = filterStatus === 'all' || (summary?.status === filterStatus);
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
        <div className="h-10 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Maintenance Overview KPI Strip */}
      {rides.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className={`border ${kpis.overdue > 0 ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card'}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpis.overdue > 0 ? 'bg-destructive/10' : 'bg-muted'}`}>
                <AlertTriangle className={`h-4 w-4 ${kpis.overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className={`text-xl font-bold ${kpis.overdue > 0 ? 'text-destructive' : 'text-foreground'}`}>{kpis.overdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </CardContent>
          </Card>

          <Card className={`border ${kpis.dueSoon > 0 ? 'border-warning/40 bg-warning/5' : 'border-border bg-card'}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpis.dueSoon > 0 ? 'bg-warning/10' : 'bg-muted'}`}>
                <Clock className={`h-4 w-4 ${kpis.dueSoon > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className={`text-xl font-bold ${kpis.dueSoon > 0 ? 'text-warning' : 'text-foreground'}`}>{kpis.dueSoon}</p>
                <p className="text-xs text-muted-foreground">Due Soon</p>
              </div>
            </CardContent>
          </Card>

          <Card className={`border ${kpis.openDefects > 0 ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card'}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpis.openDefects > 0 ? 'bg-destructive/10' : 'bg-muted'}`}>
                <Wrench className={`h-4 w-4 ${kpis.openDefects > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className={`text-xl font-bold ${kpis.openDefects > 0 ? 'text-destructive' : 'text-foreground'}`}>{kpis.openDefects}</p>
                <p className="text-xs text-muted-foreground">Open Defects</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{kpis.compliant}</p>
                <p className="text-xs text-muted-foreground">Compliant</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search + Filter */}
      {rides.length > 0 && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search equipment..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'overdue', 'due-soon', 'compliant'] as const).map(f => (
              <Button
                key={f}
                variant={filterStatus === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus(f)}
                className="text-xs h-10 capitalize"
              >
                {f === 'all' ? 'All' : f === 'due-soon' ? 'Due Soon' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Equipment Cards */}
      {rides.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No equipment found"
          description="Add rides or equipment in the Rides section to start tracking maintenance."
        />
      ) : filteredRides.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No equipment matches your filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRides.map((ride) => {
            const summary = summaries[ride.id];
            const statusCfg = STATUS_CONFIG[summary?.status ?? 'no-data'];

            return (
              <Card
                key={ride.id}
                className={`overflow-hidden shadow-card hover:shadow-elegant active:scale-[0.98] transition-all cursor-pointer border-l-4 ${statusCfg.accent} border border-border`}
                onClick={() => onRideSelect(ride)}
              >
                {/* Equipment Photo */}
                {thumbs[ride.id] ? (
                  <img
                    src={thumbs[ride.id]}
                    alt={`${ride.ride_name} photo`}
                    className="w-full h-32 object-cover"
                  />
                ) : (
                  <div className="w-full h-24 bg-gradient-to-br from-warning/10 to-warning/5 flex items-center justify-center">
                    <Wrench className="h-10 w-10 text-warning/40" />
                  </div>
                )}

                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight min-w-0 break-words line-clamp-2">
                      {ride.ride_name}
                    </CardTitle>
                    {/* Status badge */}
                    <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30 w-fit font-medium">
                    {ride.ride_categories.name}
                  </Badge>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  {/* Maintenance Summary */}
                  <div className="bg-muted/40 rounded-lg p-2.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <CalendarDays className="h-3 w-3" /> Last Service
                      </span>
                      <span className="font-medium text-foreground">
                        {summary?.lastServiceDate
                          ? format(new Date(summary.lastServiceDate), 'd MMM yyyy')
                          : <span className="text-muted-foreground italic">No records</span>}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> Next Due
                      </span>
                      <span className={`font-medium ${summary?.status === 'overdue' ? 'text-destructive' : summary?.status === 'due-soon' ? 'text-warning' : 'text-foreground'}`}>
                        {summary?.nextDueDate
                          ? format(new Date(summary.nextDueDate), 'd MMM yyyy')
                          : <span className="text-muted-foreground italic">Not set</span>}
                      </span>
                    </div>
                    {(summary?.openDefects ?? 0) > 0 && (
                      <div className="flex items-center justify-between border-t border-border pt-1.5 mt-1">
                        <span className="text-destructive flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="h-3 w-3" /> Open Defects
                        </span>
                        <span className="font-bold text-destructive">{summary.openDefects}</span>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={(e) => { e.stopPropagation(); onRideSelect(ride); }}
                    className="w-full h-11 bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 shadow-sm text-xs sm:text-sm font-semibold"
                  >
                    <Wrench className="h-4 w-4 mr-2 shrink-0" />
                    Manage Maintenance
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MaintenanceRideSelector;
