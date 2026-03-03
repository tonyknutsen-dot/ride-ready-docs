import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';
import { useDateTimeSettings } from '@/hooks/useDateTimeSettings';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Wind, Plus, MapPin, Clock, ChevronDown, Gauge, User, Loader2,
  Download, Filter, CalendarIcon, X, FileText
} from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import { generateWindLogPdf } from '@/utils/windLogPdf';

interface InflatableRide {
  id: string;
  ride_name: string;
}

interface WindLogEntry {
  id: string;
  log_date: string;
  log_time: string;
  wind_speed: number;
  wind_unit: string;
  recorded_by: string;
  location: string | null;
  anemometer_make: string | null;
  anemometer_model: string | null;
  anemometer_serial: string | null;
  action_taken: string | null;
  notes: string | null;
  created_at: string;
  linked_rides?: string[];
  linked_ride_ids?: string[];
}

const UNIT_OPTIONS = [
  { value: 'mph', label: 'mph' },
  { value: 'km/h', label: 'km/h' },
  { value: 'm/s', label: 'm/s' },
];

const ACTION_OPTIONS = [
  { value: 'continue', label: 'Continue operating' },
  { value: 'monitoring', label: 'Increased monitoring' },
  { value: 'restricted', label: 'Restricted use' },
  { value: 'ceased', label: 'Ceased operation' },
  { value: 'other', label: 'Other' },
];

const ACTION_LABEL_MAP: Record<string, string> = {
  continue: 'Continue operating',
  monitoring: 'Increased monitoring',
  restricted: 'Restricted use',
  ceased: 'Ceased operation',
};

const WindLog = () => {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const { formatDate } = useDateTimeSettings();
  const isMobile = useIsMobile();

  const [logs, setLogs] = useState<WindLogEntry[]>([]);
  const [inflatables, setInflatables] = useState<InflatableRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterInflatable, setFilterInflatable] = useState('all');
  const [filterRecordedBy, setFilterRecordedBy] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Defaults
  const [defaultRecordedBy, setDefaultRecordedBy] = useState('');
  const [defaultLocation, setDefaultLocation] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [controllerName, setControllerName] = useState('');

  // Form state
  const [logDate, setLogDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [logTime, setLogTime] = useState(format(new Date(), 'HH:mm'));
  const [windSpeed, setWindSpeed] = useState('');
  const [windUnit, setWindUnit] = useState('mph');
  const [recordedBy, setRecordedBy] = useState('');
  const [location, setLocation] = useState('');
  const [anemometerMake, setAnemometerMake] = useState('');
  const [anemometerModel, setAnemometerModel] = useState('');
  const [anemometerSerial, setAnemometerSerial] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedRideIds, setSelectedRideIds] = useState<string[]>([]);

  // Load user defaults
  useEffect(() => {
    if (!effectiveUserId) return;
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('controller_name, company_name')
        .eq('user_id', effectiveUserId)
        .maybeSingle();
      if (data?.controller_name) {
        setDefaultRecordedBy(data.controller_name);
        setControllerName(data.controller_name);
      }
      if (data?.company_name) setCompanyName(data.company_name);
    };
    load();
  }, [effectiveUserId]);

  // Load inflatables
  useEffect(() => {
    if (!effectiveUserId) return;
    const load = async () => {
      const { data } = await supabase
        .from('rides')
        .select('id, ride_name, ride_categories!inner(category_group)')
        .eq('ride_categories.category_group', 'Inflatables')
        .order('ride_name');
      if (data) {
        setInflatables(data.map((r: any) => ({ id: r.id, ride_name: r.ride_name })));
      }
    };
    load();
  }, [effectiveUserId]);

  const loadLogs = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      const { data: windLogs, error } = await supabase
        .from('wind_speed_logs')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('log_date', { ascending: false })
        .order('log_time', { ascending: false })
        .limit(500);

      if (error) throw error;

      if (windLogs && windLogs.length > 0) {
        const logIds = windLogs.map((l: any) => l.id);
        const { data: junctions } = await supabase
          .from('wind_log_rides')
          .select('wind_log_id, ride_id')
          .in('wind_log_id', logIds);

        const rideIdToName = Object.fromEntries(inflatables.map(r => [r.id, r.ride_name]));
        const logRideMap: Record<string, string[]> = {};
        const logRideIdMap: Record<string, string[]> = {};
        for (const j of (junctions || [])) {
          if (!logRideMap[j.wind_log_id]) logRideMap[j.wind_log_id] = [];
          if (!logRideIdMap[j.wind_log_id]) logRideIdMap[j.wind_log_id] = [];
          logRideMap[j.wind_log_id].push(rideIdToName[j.ride_id] || 'Unknown');
          logRideIdMap[j.wind_log_id].push(j.ride_id);
        }

        setLogs(windLogs.map((l: any) => ({
          ...l,
          linked_rides: logRideMap[l.id] || [],
          linked_ride_ids: logRideIdMap[l.id] || [],
        })));
      } else {
        setLogs([]);
      }

      if (windLogs && windLogs.length > 0 && windLogs[0].location) {
        setDefaultLocation(windLogs[0].location);
      }
    } catch (err) {
      console.error('Error loading wind logs:', err);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, inflatables]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Unique values for filter dropdowns
  const uniqueRecordedBy = useMemo(() => {
    const set = new Set(logs.map(l => l.recorded_by));
    return Array.from(set).sort();
  }, [logs]);

  const uniqueLocations = useMemo(() => {
    const set = new Set(logs.map(l => l.location).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(entry => {
      if (filterDateFrom) {
        const entryDate = startOfDay(new Date(entry.log_date + 'T00:00:00'));
        if (entryDate < startOfDay(filterDateFrom)) return false;
      }
      if (filterDateTo) {
        const entryDate = startOfDay(new Date(entry.log_date + 'T00:00:00'));
        if (entryDate > startOfDay(filterDateTo)) return false;
      }
      if (filterLocation && entry.location !== filterLocation) return false;
      if (filterInflatable !== 'all' && !(entry.linked_ride_ids || []).includes(filterInflatable)) return false;
      if (filterRecordedBy !== 'all' && entry.recorded_by !== filterRecordedBy) return false;
      return true;
    });
  }, [logs, filterDateFrom, filterDateTo, filterLocation, filterInflatable, filterRecordedBy]);

  const hasFilters = filterDateFrom || filterDateTo || filterLocation || filterInflatable !== 'all' || filterRecordedBy !== 'all';

  const clearFilters = () => {
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
    setFilterLocation('');
    setFilterInflatable('all');
    setFilterRecordedBy('all');
  };

  const handleOpenSheet = () => {
    const n = new Date();
    setLogDate(format(n, 'yyyy-MM-dd'));
    setLogTime(format(n, 'HH:mm'));
    setWindSpeed('');
    setWindUnit('mph');
    setRecordedBy(defaultRecordedBy);
    setLocation(defaultLocation);
    setAnemometerMake('');
    setAnemometerModel('');
    setAnemometerSerial('');
    setActionTaken('');
    setActionNotes('');
    setNotes('');
    setSelectedRideIds([]);
    setSheetOpen(true);
  };

  const toggleRide = (rideId: string) => {
    setSelectedRideIds(prev =>
      prev.includes(rideId) ? prev.filter(id => id !== rideId) : [...prev, rideId]
    );
  };

  const handleSave = async () => {
    if (!effectiveUserId || !windSpeed || !recordedBy) {
      toast({ title: 'Missing fields', description: 'Wind speed and recorded by are required.', variant: 'destructive' });
      return;
    }
    if (selectedRideIds.length === 0) {
      toast({ title: 'No inflatables selected', description: 'Select at least one inflatable for this reading.', variant: 'destructive' });
      return;
    }

    let finalAction: string | null = null;
    if (actionTaken === 'other') {
      finalAction = actionNotes || null;
    } else if (actionTaken) {
      const label = ACTION_LABEL_MAP[actionTaken] || actionTaken;
      finalAction = actionNotes ? `${label} — ${actionNotes}` : label;
    }

    setSaving(true);
    try {
      const windLogId = crypto.randomUUID();
      const { error } = await supabase.from('wind_speed_logs').insert({
        id: windLogId,
        user_id: effectiveUserId,
        ride_id: null,
        log_date: logDate,
        log_time: logTime + ':00',
        wind_speed: parseFloat(windSpeed),
        wind_unit: windUnit,
        recorded_by: recordedBy,
        location: location || null,
        anemometer_make: anemometerMake || null,
        anemometer_model: anemometerModel || null,
        anemometer_serial: anemometerSerial || null,
        action_taken: finalAction,
        notes: notes || null,
      });
      if (error) throw error;

      const junctionRows = selectedRideIds.map(rideId => ({
        wind_log_id: windLogId,
        ride_id: rideId,
      }));
      const { error: jError } = await supabase.from('wind_log_rides').insert(junctionRows);
      if (jError) throw jError;

      toast({ title: 'Reading saved' });
      setSheetOpen(false);
      loadLogs();
    } catch (err: any) {
      console.error('Error saving wind log:', err);
      toast({ title: "Couldn't save wind reading", description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      toast({ title: 'Nothing to export', description: 'No readings match your current filters.', variant: 'destructive' });
      return;
    }

    const singleInflatable = filterInflatable !== 'all'
      ? inflatables.find(r => r.id === filterInflatable)?.ride_name
      : undefined;

    generateWindLogPdf({
      entries: filteredLogs,
      title: singleInflatable ? `Wind Log — ${singleInflatable}` : 'Wind Speed Log',
      subtitle: 'Site Wind Reading Report',
      inflatableName: singleInflatable,
      companyName: companyName || undefined,
      controllerName: controllerName || undefined,
      userId: effectiveUserId || undefined,
      dateRange: {
        from: filterDateFrom ? format(filterDateFrom, 'd MMM yyyy') : undefined,
        to: filterDateTo ? format(filterDateTo, 'd MMM yyyy') : undefined,
      },
      location: filterLocation || undefined,
    });
  };

  const hasAnemometerDetails = (entry: WindLogEntry) =>
    entry.anemometer_make || entry.anemometer_model || entry.anemometer_serial;

  // ─── Reading Card (used for both mobile and desktop) ───
  const renderReadingCard = (entry: WindLogEntry) => (
    <div key={entry.id} className="bg-card rounded-xl border border-border p-4 hover:border-primary/20 transition-colors">
      {/* Top row: date/time + speed badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{formatDate(entry.log_date)}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />{entry.log_time.slice(0, 5)}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{entry.recorded_by}</span>
            </span>
            {entry.location && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{entry.location}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 bg-primary/10 px-3 py-2 rounded-lg">
          <Gauge className="h-4 w-4 text-primary" />
          <span className="text-lg font-bold text-primary tabular-nums">{entry.wind_speed}</span>
          <span className="text-xs font-medium text-primary/70">{entry.wind_unit}</span>
        </div>
      </div>

      {/* Applies to — prominent display */}
      {entry.linked_rides && entry.linked_rides.length > 0 && (
        <div className="mb-3">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
            Applies to
          </span>
          <div className="flex flex-wrap gap-1.5">
            {entry.linked_rides.map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-xs font-medium bg-secondary text-secondary-foreground px-2.5 py-1 rounded-md border border-border"
              >
                <Wind className="h-3 w-3 text-muted-foreground" />
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action taken */}
      {entry.action_taken && (
        <div className="mb-2 bg-muted/50 rounded-lg px-3 py-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Action</span>
          <p className="text-xs text-foreground">{entry.action_taken}</p>
        </div>
      )}

      {/* Notes */}
      {entry.notes && (
        <p className="text-xs text-muted-foreground italic mb-2">{entry.notes}</p>
      )}

      {/* Anemometer details (expandable) */}
      {hasAnemometerDetails(entry) && (
        <Collapsible open={expandedId === entry.id} onOpenChange={(open) => setExpandedId(open ? entry.id : null)}>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={cn("h-3 w-3 transition-transform", expandedId === entry.id && "rotate-180")} />
            Anemometer details
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="grid grid-cols-3 gap-2 text-[11px] bg-muted/30 rounded-lg px-3 py-2">
              {entry.anemometer_make && (
                <div>
                  <span className="font-semibold text-muted-foreground block">Make</span>
                  <span className="text-foreground">{entry.anemometer_make}</span>
                </div>
              )}
              {entry.anemometer_model && (
                <div>
                  <span className="font-semibold text-muted-foreground block">Model</span>
                  <span className="text-foreground">{entry.anemometer_model}</span>
                </div>
              )}
              {entry.anemometer_serial && (
                <div>
                  <span className="font-semibold text-muted-foreground block">Serial</span>
                  <span className="text-foreground">{entry.anemometer_serial}</span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );

  return (
    <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-4">
      <PageHeader title="Wind Log" />

      {/* ─── Header bar ─── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Wind className="h-5 w-5 text-primary shrink-0" />
            <h2 className="text-base font-semibold text-foreground md:text-lg">Wind Speed Register</h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-lg">
            Record site wind readings and link them to your inflatables. Each reading can apply to multiple items at once.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasFilters && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{filteredLogs.length}</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5" disabled={filteredLogs.length === 0}>
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
          <Button onClick={handleOpenSheet} size="sm" className="gap-1.5" disabled={inflatables.length === 0}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Reading</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* ─── Filters ─── */}
      {showFilters && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-muted-foreground" /> Filters
            </span>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7 gap-1">
                <X className="h-3 w-3" /> Clear all
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-xs h-9 w-full", filterDateFrom && "text-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                  {filterDateFrom ? format(filterDateFrom, 'd MMM yyyy') : 'From date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filterDateFrom} onSelect={setFilterDateFrom} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-xs h-9 w-full", filterDateTo && "text-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                  {filterDateTo ? format(filterDateTo, 'd MMM yyyy') : 'To date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filterDateTo} onSelect={setFilterDateTo} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Select value={filterLocation || '__all__'} onValueChange={(v) => setFilterLocation(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All locations</SelectItem>
                {uniqueLocations.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterInflatable} onValueChange={setFilterInflatable}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All inflatables" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All inflatables</SelectItem>
                {inflatables.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.ride_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRecordedBy} onValueChange={setFilterRecordedBy}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {uniqueRecordedBy.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>
      )}

      {/* ─── No inflatables ─── */}
      {inflatables.length === 0 && !loading && (
        <Card className="p-6 text-center">
          <Wind className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No inflatables found.</p>
          <p className="text-xs text-muted-foreground mt-1">Add an inflatable to your equipment list to start logging wind readings.</p>
        </Card>
      )}

      {/* ─── Loading ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 && inflatables.length > 0 ? (
        <Card className="p-8 text-center">
          <Wind className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No wind readings yet</p>
          <p className="text-xs text-muted-foreground">Tap "Add Reading" to log your first wind speed entry.</p>
        </Card>
      ) : (
        <>
          {/* Summary bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {filteredLogs.length} reading{filteredLogs.length !== 1 ? 's' : ''}
              {hasFilters ? ' (filtered)' : ''}
            </span>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-6 gap-1 px-2">
                <X className="h-3 w-3" /> Clear filters
              </Button>
            )}
          </div>

          {/* Card grid */}
          {filteredLogs.length === 0 ? (
            <Card className="p-8 text-center">
              <Wind className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No readings match your filters</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredLogs.map(entry => renderReadingCard(entry))}
            </div>
          )}
        </>
      )}

      {/* ─── Add Reading Sheet ─── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle>Add Wind Reading</SheetTitle>
            <SheetDescription>Record a wind speed measurement and link it to your inflatables.</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 pb-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Time</Label>
                <Input type="time" value={logTime} onChange={(e) => setLogTime(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Wind Speed *</Label>
                <Input type="number" inputMode="decimal" min="0" step="0.1" placeholder="e.g. 15" value={windSpeed} onChange={(e) => setWindSpeed(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unit</Label>
                <Select value={windUnit} onValueChange={setWindUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Recorded By *</Label>
              <Input placeholder="Name of person" value={recordedBy} onChange={(e) => setRecordedBy(e.target.value)} maxLength={100} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Location</Label>
              <Input placeholder="e.g. Main field, Site entrance" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
            </div>

            {/* Inflatable selector */}
            <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs font-semibold">Applies to *</Label>
                <div className="flex items-center gap-1.5">
                  <button type="button" className="text-[11px] text-primary font-medium hover:underline" onClick={() => setSelectedRideIds(inflatables.map(r => r.id))}>
                    Select all
                  </button>
                  <span className="text-[11px] text-muted-foreground">•</span>
                  <button type="button" className="text-[11px] text-primary font-medium hover:underline" onClick={() => setSelectedRideIds([])}>
                    Clear all
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Choose which inflatables this reading applies to.</p>
              <div className="space-y-1.5 max-h-44 overflow-y-auto rounded-lg border border-border p-2">
                {inflatables.map((ride) => (
                  <label key={ride.id} className="flex items-center gap-2.5 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={selectedRideIds.includes(ride.id)} onCheckedChange={() => toggleRide(ride.id)} />
                    <span className="text-sm truncate">{ride.ride_name}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{selectedRideIds.length} of {inflatables.length} selected</p>
            </div>

            {/* Anemometer Details */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1">
                <ChevronDown className="h-3.5 w-3.5" />
                Anemometer Details
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Make</Label>
                  <Input placeholder="e.g. Kestrel" value={anemometerMake} onChange={(e) => setAnemometerMake(e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Model</Label>
                  <Input placeholder="e.g. 3000" value={anemometerModel} onChange={(e) => setAnemometerModel(e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Serial Number</Label>
                  <Input placeholder="Serial number" value={anemometerSerial} onChange={(e) => setAnemometerSerial(e.target.value)} maxLength={100} />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Action taken */}
            <div className="space-y-1.5">
              <Label className="text-xs">Action Taken</Label>
              <Select value={actionTaken} onValueChange={setActionTaken}>
                <SelectTrigger><SelectValue placeholder="Select action..." /></SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {actionTaken && (
                <Textarea
                  placeholder={actionTaken === 'other' ? 'Describe action taken...' : 'Additional notes on action (optional)'}
                  value={actionNotes} onChange={(e) => setActionNotes(e.target.value)}
                  className="min-h-[60px] mt-1.5" maxLength={500}
                />
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea placeholder="Any additional notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px]" maxLength={500} />
            </div>

            <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] bg-background border-t border-border">
              <Button onClick={handleSave} disabled={saving || selectedRideIds.length === 0} className="w-full h-12">
                {saving ? 'Saving...' : selectedRideIds.length === 0 ? 'Select inflatables to save' : `Save to ${selectedRideIds.length} inflatable${selectedRideIds.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default WindLog;
