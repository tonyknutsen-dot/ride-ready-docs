import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useAppRole } from '@/hooks/useAppRole';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, startOfDay, parseISO } from 'date-fns';
import {
  ChevronDown, CalendarIcon, Power, CheckSquare, AlertTriangle,
  Wrench, FileText, Shield, Atom, Clock, Filter, Wind
} from 'lucide-react';

type EventType = 'operating_status' | 'check' | 'defect' | 'maintenance' | 'document' | 'third_party' | 'ndt' | 'wind';

interface ActivityEntry {
  id: string;
  timestamp: string;
  event_type: EventType;
  description: string;
  user_name: string;
  user_role: string;
}

const EVENT_CONFIG: Record<EventType, { label: string; icon: React.ElementType; color: string }> = {
  operating_status: { label: 'Operating Status', icon: Power, color: 'text-green-600' },
  check: { label: 'Check', icon: CheckSquare, color: 'text-primary' },
  defect: { label: 'Defect', icon: AlertTriangle, color: 'text-destructive' },
  maintenance: { label: 'Maintenance', icon: Wrench, color: 'text-amber-600' },
  document: { label: 'Document', icon: FileText, color: 'text-blue-600' },
  third_party: { label: 'Third Party', icon: Shield, color: 'text-purple-600' },
  ndt: { label: 'NDT', icon: Atom, color: 'text-teal-600' },
  wind: { label: 'Wind', icon: Wind, color: 'text-sky-600' },
};

const EVENT_TYPE_OPTIONS = Object.entries(EVENT_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }));

interface RideActivityTimelineProps {
  rideId: string;
}

export default function RideActivityTimeline({ rideId }: RideActivityTimelineProps) {
  const { effectiveUserId } = useEffectiveUserId();
  const role = useAppRole();
  const isFullView = role === 'controller';

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (effectiveUserId) loadActivity();
  }, [effectiveUserId, rideId]);

  const loadActivity = async () => {
    setLoading(true);
    try {
      const results: ActivityEntry[] = [];

      // 1. Operating status changes
      const { data: statusLogs } = await (supabase
        .from('ride_daily_status_log' as any)
        .select('id, changed_at, new_is_operating, reason, changed_by_name')
        .eq('ride_id', rideId)
        .order('changed_at', { ascending: false })
        .limit(200) as any);

      (statusLogs || []).forEach((s: any) => {
        results.push({
          id: `status-${s.id}`,
          timestamp: s.changed_at,
          event_type: 'operating_status',
          description: `Operating Today set to ${s.new_is_operating ? 'ON' : 'OFF'}${s.reason ? ` — ${s.reason}` : ''}`,
          user_name: s.changed_by_name || 'Unknown',
          user_role: '',
        });
      });

      // 2. Check completions
      const { data: checks } = await supabase
        .from('inspection_records')
        .select('id, completed_at, inspector_name, check_frequency, overall_result, template_name')
        .eq('ride_id', rideId)
        .order('completed_at', { ascending: false })
        .limit(200);

      (checks || []).forEach(c => {
        results.push({
          id: `check-${c.id}`,
          timestamp: c.completed_at,
          event_type: 'check',
          description: `${c.check_frequency} check completed — ${c.template_name || 'Checklist'} (${c.overall_result})`,
          user_name: c.inspector_name,
          user_role: '',
        });
      });

      // 3. Defects
      const { data: defects } = await supabase
        .from('defects')
        .select('id, created_at, resolved_at, description, severity, status')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: false })
        .limit(200);

      (defects || []).forEach(d => {
        results.push({
          id: `defect-open-${d.id}`,
          timestamp: d.created_at,
          event_type: 'defect',
          description: `Defect raised (${d.severity}): ${d.description.substring(0, 80)}`,
          user_name: '',
          user_role: '',
        });
        if (d.resolved_at) {
          results.push({
            id: `defect-close-${d.id}`,
            timestamp: d.resolved_at,
            event_type: 'defect',
            description: `Defect resolved: ${d.description.substring(0, 80)}`,
            user_name: '',
            user_role: '',
          });
        }
      });

      // 4. Maintenance
      const { data: maint } = await supabase
        .from('maintenance_records')
        .select('id, created_at, maintenance_type, description, performed_by')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: false })
        .limit(200);

      (maint || []).forEach(m => {
        results.push({
          id: `maint-${m.id}`,
          timestamp: m.created_at,
          event_type: 'maintenance',
          description: `${m.maintenance_type}: ${m.description.substring(0, 80)}`,
          user_name: m.performed_by || '',
          user_role: '',
        });
      });

      // 5. Documents
      const { data: docs } = await supabase
        .from('documents')
        .select('id, uploaded_at, document_name, document_type, version_number')
        .eq('ride_id', rideId)
        .order('uploaded_at', { ascending: false })
        .limit(200);

      (docs || []).forEach(d => {
        results.push({
          id: `doc-${d.id}`,
          timestamp: d.uploaded_at,
          event_type: 'document',
          description: `${d.document_type} uploaded: ${d.document_name}${d.version_number && d.version_number !== '1.0' ? ` (v${d.version_number})` : ''}`,
          user_name: '',
          user_role: '',
        });
      });

      // 6. Annual inspection (third party)
      const { data: annuals } = await supabase
        .from('annual_inspection_reports')
        .select('id, created_at, inspection_company, inspector_name, inspection_status')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: false })
        .limit(100);

      (annuals || []).forEach(a => {
        results.push({
          id: `annual-${a.id}`,
          timestamp: a.created_at,
          event_type: 'third_party',
          description: `Annual inspection by ${a.inspection_company} — ${a.inspection_status}`,
          user_name: a.inspector_name,
          user_role: '',
        });
      });

      // 7. NDT reports
      const { data: ndts } = await supabase
        .from('ndt_reports')
        .select('id, created_at, ndt_method, component_tested, test_results, inspector_name')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: false })
        .limit(100);

      (ndts || []).forEach(n => {
        results.push({
          id: `ndt-${n.id}`,
          timestamp: n.created_at,
          event_type: 'ndt',
          description: `${n.ndt_method} on ${n.component_tested} — ${n.test_results}`,
          user_name: n.inspector_name,
          user_role: '',
        });
      });

      // 8. Wind readings linked to this ride
      const { data: windJunctions } = await supabase
        .from('wind_log_rides')
        .select('wind_log_id')
        .eq('ride_id', rideId);

      if (windJunctions && windJunctions.length > 0) {
        const windLogIds = windJunctions.map((j: any) => j.wind_log_id);
        const { data: windLogs } = await supabase
          .from('wind_speed_logs')
          .select('id, created_at, log_date, log_time, wind_speed, wind_unit, recorded_by')
          .in('id', windLogIds)
          .order('created_at', { ascending: false })
          .limit(200);

        (windLogs || []).forEach((w: any) => {
          results.push({
            id: `wind-${w.id}`,
            timestamp: w.created_at,
            event_type: 'wind' as EventType,
            description: `Wind reading logged: ${w.wind_speed} ${w.wind_unit} at ${w.log_time?.slice(0, 5) || ''}`,
            user_name: w.recorded_by || '',
            user_role: '',
          });
        });
      }

      // Sort all entries chronologically descending
      results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEntries(results);
    } catch (err) {
      console.error('Error loading activity:', err);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (typeFilter !== 'all' && e.event_type !== typeFilter) return false;
      if (dateFrom) {
        const entryDate = startOfDay(new Date(e.timestamp));
        if (entryDate < startOfDay(dateFrom)) return false;
      }
      if (dateTo) {
        const entryDate = startOfDay(new Date(e.timestamp));
        if (entryDate > startOfDay(dateTo)) return false;
      }
      return true;
    });
  }, [entries, typeFilter, dateFrom, dateTo]);

  // Group by day
  const grouped = useMemo(() => {
    const groups: { date: Date; label: string; entries: ActivityEntry[] }[] = [];
    const map = new Map<string, ActivityEntry[]>();

    filtered.forEach(e => {
      const dayKey = format(new Date(e.timestamp), 'yyyy-MM-dd');
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey)!.push(e);
    });

    map.forEach((items, dayKey) => {
      const d = parseISO(dayKey);
      let label: string;
      if (isToday(d)) label = 'Today';
      else if (isYesterday(d)) label = 'Yesterday';
      else label = format(d, 'd MMM yyyy');
      groups.push({ date: d, label, entries: items });
    });

    groups.sort((a, b) => b.date.getTime() - a.date.getTime());
    return groups;
  }, [filtered]);

  const clearFilters = () => {
    setTypeFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasFilters = typeFilter !== 'all' || dateFrom || dateTo;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4 text-muted-foreground" />
          Filters
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="All event types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All event types</SelectItem>
              {EVENT_TYPE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1.5", dateFrom && "text-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, 'd MMM yyyy') : 'From'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1.5", dateTo && "text-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateTo ? format(dateTo, 'd MMM yyyy') : 'To'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Timeline */}
      {grouped.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No activity recorded yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Checks, maintenance, defects and other events will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group, gi) => (
            <DayGroup
              key={group.label}
              label={group.label}
              entries={group.entries}
              defaultOpen={gi === 0}
              isFullView={isFullView}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center">
        Showing {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        {hasFilters ? ' (filtered)' : ''}
      </p>
    </div>
  );
}

function DayGroup({ label, entries, defaultOpen, isFullView }: {
  label: string;
  entries: ActivityEntry[];
  defaultOpen: boolean;
  isFullView: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border hover:bg-muted/80 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{entries.length}</Badge>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        <div className="relative pl-6 border-l-2 border-border ml-4 space-y-0">
          {entries.map(entry => {
            const cfg = EVENT_CONFIG[entry.event_type];
            const Icon = cfg.icon;
            const time = format(new Date(entry.timestamp), 'HH:mm');

            return (
              <div key={entry.id} className="relative py-2.5 pl-4 group">
                {/* Timeline dot */}
                <div className="absolute -left-[calc(0.75rem+1px)] top-3.5 h-5 w-5 rounded-full bg-card border-2 border-border flex items-center justify-center">
                  <Icon className={cn("h-3 w-3", cfg.color)} strokeWidth={2.5} />
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-[11px] font-mono text-muted-foreground tabular-nums shrink-0 pt-0.5 w-10">{time}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold shrink-0">{cfg.label}</Badge>
                      {isFullView && entry.user_name && (
                        <span className="text-[11px] text-muted-foreground">
                          {entry.user_name}
                          {entry.user_role ? ` (${entry.user_role})` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground mt-0.5 leading-relaxed">{entry.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
