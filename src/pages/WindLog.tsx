import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Wind, Plus, MapPin, Clock, ChevronDown, ChevronRight, Gauge, User, Loader2,
  Download, Filter, CalendarIcon, X, ChevronsLeft, ChevronsRight, ChevronLeft, Save,
  AlertTriangle,
} from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import { generateWindLogPdf } from '@/utils/windLogPdf';
import ExportActionsDialog, { type ExportResult } from '@/components/ExportActionsDialog';

interface InflatableRide {
  id: string;
  ride_name: string;
}

interface AnemometerProfile {
  id: string;
  make: string;
  model: string;
  serial_number: string | null;
  label: string | null;
  is_default: boolean;
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

const ACTION_FILTER_OPTIONS = [
  { value: 'all', label: 'All actions' },
  { value: 'continue', label: 'Continue operating' },
  { value: 'monitoring', label: 'Increased monitoring' },
  { value: 'restricted', label: 'Restricted use' },
  { value: 'ceased', label: 'Ceased operation' },
  { value: 'none', label: 'No action recorded' },
];

const PAGE_SIZE = 50;

// High-wind threshold: 24 mph = ~38.6 km/h = ~10.7 m/s
const HIGH_WIND_MPH = 24;
function toMph(speed: number, unit: string): number {
  if (unit === 'mph') return speed;
  if (unit === 'km/h') return speed * 0.621371;
  if (unit === 'm/s') return speed * 2.23694;
  return speed;
}

const WindLog = () => {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const { formatDate } = useDateTimeSettings();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const [logs, setLogs] = useState<WindLogEntry[]>([]);
  const [inflatables, setInflatables] = useState<InflatableRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Anemometer profiles
  const [anemometerProfiles, setAnemometerProfiles] = useState<AnemometerProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('manual');
  const [savingProfile, setSavingProfile] = useState(false);

  // High-wind alert
  const [highWindDialogOpen, setHighWindDialogOpen] = useState(false);
  const [highWindAcknowledged, setHighWindAcknowledged] = useState(false);

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterInflatable, setFilterInflatable] = useState('all');
  const [filterRecordedBy, setFilterRecordedBy] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

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

  useEffect(() => {
    if (!effectiveUserId) return;
    const load = async () => {
      const { data } = await supabase
        .from('anemometer_profiles')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (data) setAnemometerProfiles(data as AnemometerProfile[]);
    };
    load();
  }, [effectiveUserId]);

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
        .limit(1000);

      if (error) throw error;

      if (windLogs && windLogs.length > 0) {
        const logIds = windLogs.map((l: any) => l.id);
        const allJunctions: any[] = [];
        for (let i = 0; i < logIds.length; i += 200) {
          const chunk = logIds.slice(i, i + 200);
          const { data: junctions } = await supabase
            .from('wind_log_rides')
            .select('wind_log_id, ride_id')
            .in('wind_log_id', chunk);
          if (junctions) allJunctions.push(...junctions);
        }

        const rideIdToName = Object.fromEntries(inflatables.map(r => [r.id, r.ride_name]));
        const logRideMap: Record<string, string[]> = {};
        const logRideIdMap: Record<string, string[]> = {};
        for (const j of allJunctions) {
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

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const uniqueRecordedBy = useMemo(() => {
    const set = new Set(logs.map(l => l.recorded_by));
    return Array.from(set).sort();
  }, [logs]);

  const uniqueLocations = useMemo(() => {
    const set = new Set(logs.map(l => l.location).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [logs]);

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
      if (filterAction !== 'all') {
        if (filterAction === 'none') {
          if (entry.action_taken) return false;
        } else {
          if (!entry.action_taken?.toLowerCase().includes(ACTION_LABEL_MAP[filterAction]?.toLowerCase() || filterAction)) return false;
        }
      }
      return true;
    });
  }, [logs, filterDateFrom, filterDateTo, filterLocation, filterInflatable, filterRecordedBy, filterAction]);

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const pagedLogs = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, page]);

  useEffect(() => { setPage(0); }, [filterDateFrom, filterDateTo, filterLocation, filterInflatable, filterRecordedBy, filterAction]);

  const hasFilters = filterDateFrom || filterDateTo || filterLocation || filterInflatable !== 'all' || filterRecordedBy !== 'all' || filterAction !== 'all';

  const clearFilters = () => {
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
    setFilterLocation('');
    setFilterInflatable('all');
    setFilterRecordedBy('all');
    setFilterAction('all');
  };

  const handleSelectProfile = (profileId: string) => {
    setSelectedProfileId(profileId);
    if (profileId === 'manual') {
      setAnemometerMake('');
      setAnemometerModel('');
      setAnemometerSerial('');
    } else {
      const profile = anemometerProfiles.find(p => p.id === profileId);
      if (profile) {
        setAnemometerMake(profile.make);
        setAnemometerModel(profile.model);
        setAnemometerSerial(profile.serial_number || '');
      }
    }
  };

  const handleSaveAsProfile = async () => {
    if (!effectiveUserId || !anemometerMake || !anemometerModel) return;
    setSavingProfile(true);
    try {
      const label = `${anemometerMake} ${anemometerModel}${anemometerSerial ? ` (${anemometerSerial})` : ''}`;
      const { data, error } = await supabase
        .from('anemometer_profiles')
        .insert({
          user_id: effectiveUserId,
          make: anemometerMake,
          model: anemometerModel,
          serial_number: anemometerSerial || null,
          label,
          is_default: anemometerProfiles.length === 0,
        })
        .select()
        .single();
      if (error) throw error;
      setAnemometerProfiles(prev => [data as AnemometerProfile, ...prev]);
      setSelectedProfileId(data.id);
      toast({ title: 'Anemometer saved', description: 'You can select it for future readings.' });
    } catch (err: any) {
      toast({ title: 'Could not save profile', description: err?.message, variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenSheet = (prelinkRideId?: string) => {
    const n = new Date();
    setLogDate(format(n, 'yyyy-MM-dd'));
    setLogTime(format(n, 'HH:mm'));
    setWindSpeed('');
    setWindUnit('mph');
    setRecordedBy(defaultRecordedBy);
    setLocation(defaultLocation);
    setActionTaken('');
    setActionNotes('');
    setNotes('');
    // Pre-link if a ride ID was passed
    setSelectedRideIds(prelinkRideId ? [prelinkRideId] : []);
    setHighWindAcknowledged(false);
    const defaultProfile = anemometerProfiles.find(p => p.is_default);
    if (defaultProfile) {
      setSelectedProfileId(defaultProfile.id);
      setAnemometerMake(defaultProfile.make);
      setAnemometerModel(defaultProfile.model);
      setAnemometerSerial(defaultProfile.serial_number || '');
    } else {
      setSelectedProfileId('manual');
      setAnemometerMake('');
      setAnemometerModel('');
      setAnemometerSerial('');
    }
    setSheetOpen(true);
  };

  // Auto-open sheet if ?prelink=rideId is present
  const [prelinkHandled, setPrelinkHandled] = useState(false);
  useEffect(() => {
    if (prelinkHandled) return;
    const prelinkId = searchParams.get('prelink');
    if (prelinkId && inflatables.length > 0 && !loading) {
      setPrelinkHandled(true);
      // Clear the param
      searchParams.delete('prelink');
      setSearchParams(searchParams, { replace: true });
      handleOpenSheet(prelinkId);
    }
  }, [searchParams, inflatables, loading, prelinkHandled]);

  const toggleRide = (rideId: string) => {
    setSelectedRideIds(prev =>
      prev.includes(rideId) ? prev.filter(id => id !== rideId) : [...prev, rideId]
    );
  };

  // Check if current speed is high wind
  const isHighWind = windSpeed ? toMph(parseFloat(windSpeed), windUnit) >= HIGH_WIND_MPH : false;

  const validateAndSave = () => {
    if (!effectiveUserId || !windSpeed || !recordedBy) {
      toast({ title: 'Missing fields', description: 'Wind speed and recorded by are required.', variant: 'destructive' });
      return;
    }
    if (!anemometerMake || !anemometerModel) {
      toast({ title: 'Anemometer required', description: 'Please enter the anemometer make and model used for this reading.', variant: 'destructive' });
      return;
    }
    if (selectedRideIds.length === 0) {
      toast({ title: 'No inflatables selected', description: 'Select at least one inflatable for this reading.', variant: 'destructive' });
      return;
    }

    // High-wind gate
    if (isHighWind && !highWindAcknowledged) {
      if (!actionTaken) {
        toast({ title: 'Action required', description: 'High wind readings require an action to be selected.', variant: 'destructive' });
        return;
      }
      setHighWindDialogOpen(true);
      return;
    }

    executeSave();
  };

  const executeSave = async () => {
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

  const handleHighWindConfirm = () => {
    setHighWindAcknowledged(true);
    setHighWindDialogOpen(false);
    executeSave();
  };

  const handleExport = async () => {
    if (filteredLogs.length === 0) {
      toast({ title: 'Nothing to export', description: 'No readings match your current filters.', variant: 'destructive' });
      return;
    }

    const singleInflatable = filterInflatable !== 'all'
      ? inflatables.find(r => r.id === filterInflatable)?.ride_name
      : undefined;

    const reportTitle = singleInflatable
      ? `Wind Log – ${singleInflatable}`
      : 'Wind Speed Register';

    const result = await generateWindLogPdf({
      entries: filteredLogs,
      title: reportTitle,
      inflatableName: singleInflatable,
      companyName: companyName || undefined,
      controllerName: controllerName || undefined,
      userId: effectiveUserId || undefined,
      singleRideId: filterInflatable !== 'all' ? filterInflatable : undefined,
      dateRange: {
        from: filterDateFrom ? format(filterDateFrom, 'd MMM yyyy') : undefined,
        to: filterDateTo ? format(filterDateTo, 'd MMM yyyy') : undefined,
      },
      location: filterLocation || undefined,
    });

    setExportResult({ blob: result.blob, fileName: result.fileName });
    setExportDialogOpen(true);
  };

  const formatAnemometer = (entry: WindLogEntry) => {
    const parts = [entry.anemometer_make, entry.anemometer_model, entry.anemometer_serial ? `S/N ${entry.anemometer_serial}` : null].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : null;
  };

  const hasMissingAnemometer = (entry: WindLogEntry) => !entry.anemometer_make && !entry.anemometer_model;

  const isEntryHighWind = (entry: WindLogEntry) => toMph(entry.wind_speed, entry.wind_unit) >= HIGH_WIND_MPH;

  // ─── Desktop row — 7-column: Date, Time, Speed, Location, Applies To, Action, Expand ───
  const renderDesktopRow = (entry: WindLogEntry) => {
    const isExpanded = expandedId === entry.id;
    const anemStr = formatAnemometer(entry);
    const missingAnem = hasMissingAnemometer(entry);
    const highWind = isEntryHighWind(entry);
    const rides = entry.linked_rides || [];

    return (
      <div key={entry.id}>
        <div
          className={cn(
            "grid grid-cols-[78px_48px_74px_1fr_1.2fr_1.4fr_32px] items-center px-4 py-2 text-[13px] border-b border-border hover:bg-muted/30 transition-colors cursor-pointer gap-x-3",
            isExpanded && "bg-muted/20 border-b-0"
          )}
          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
        >
          <span className="font-medium text-foreground tabular-nums">{formatDate(entry.log_date)}</span>
          <span className="text-muted-foreground tabular-nums">{entry.log_time.slice(0, 5)}</span>
          <div>
            {highWind ? (
              <Badge variant="destructive" className="text-[11px] px-1.5 py-0 font-bold tabular-nums">
                {entry.wind_speed} {entry.wind_unit}
              </Badge>
            ) : (
              <span className="font-semibold text-primary tabular-nums">
                {entry.wind_speed} <span className="font-normal text-[11px] text-muted-foreground">{entry.wind_unit}</span>
              </span>
            )}
          </div>
          <span className="text-muted-foreground truncate" title={entry.location || undefined}>{entry.location || '—'}</span>
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            {rides.length > 0 ? (
              <>
                {rides.slice(0, 2).map((name, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 font-medium whitespace-nowrap">{name}</Badge>
                ))}
                {rides.length > 2 && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">+{rides.length - 2}</Badge>
                )}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-muted-foreground break-words text-xs leading-snug" title={entry.action_taken || undefined}>
              {entry.action_taken || '—'}
            </span>
          </div>
          <button
            type="button"
            className="flex items-center justify-center h-7 w-7 rounded hover:bg-muted/60 transition-colors mx-auto"
            onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : entry.id); }}
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
          </button>
        </div>
        {isExpanded && (
          <div className="px-6 py-3 bg-muted/5 border-b border-border">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-3 text-xs">
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Recorded By</span>
                <p className="text-foreground">{entry.recorded_by}</p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Anemometer</span>
                {missingAnem ? (
                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0 opacity-80">No anemometer recorded</Badge>
                ) : (
                  <p className="text-foreground break-words">{anemStr}</p>
                )}
              </div>
              {entry.notes && (
                <div className="lg:col-span-2">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Notes</span>
                  <p className="text-muted-foreground break-words">{entry.notes}</p>
                </div>
              )}
              {rides.length > 2 && (
                <div className="col-span-2 lg:col-span-4">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">All Linked Inflatables</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {rides.map((name, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">{name}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Mobile row — compact summary with tap-to-expand ───
  const renderMobileRow = (entry: WindLogEntry) => {
    const anemStr = formatAnemometer(entry);
    const missingAnem = hasMissingAnemometer(entry);
    const highWind = isEntryHighWind(entry);
    const isExpanded = expandedId === entry.id;
    const rides = entry.linked_rides || [];

    return (
      <div
        key={entry.id}
        className={cn(
          "border-b border-border last:border-b-0 active:bg-muted/20 transition-colors",
          isExpanded && "bg-muted/5",
          highWind && "border-l-2 border-l-destructive"
        )}
      >
        {/* Tap target — entire summary area */}
        <button
          type="button"
          className="w-full text-left px-3 py-3 min-h-[56px]"
          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
        >
          {/* Row 1: Date + Time + Speed + chevron */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[13px] font-medium text-foreground tabular-nums whitespace-nowrap">{formatDate(entry.log_date)}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">{entry.log_time.slice(0, 5)}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {highWind ? (
                <Badge variant="destructive" className="text-[12px] px-2 py-0.5 font-bold tabular-nums whitespace-nowrap">
                  {entry.wind_speed} {entry.wind_unit}
                </Badge>
              ) : (
                <div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded whitespace-nowrap">
                  <span className="text-sm font-bold text-primary tabular-nums">{entry.wind_speed}</span>
                  <span className="text-[10px] text-primary/60">{entry.wind_unit}</span>
                </div>
              )}
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground/40 transition-transform shrink-0", isExpanded && "rotate-180")} />
            </div>
          </div>

          {/* Row 2: Location */}
          {entry.location && (
            <p className="text-[11px] text-muted-foreground mt-1 break-words leading-snug">
              <MapPin className="h-2.5 w-2.5 inline-block mr-0.5 -mt-px" />
              {entry.location}
            </p>
          )}

          {/* Row 3: Applies-to badges (max 2) + warnings */}
          {(rides.length > 0 || missingAnem) && (
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {rides.slice(0, 2).map((name, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 font-medium max-w-[140px] truncate">{name}</Badge>
              ))}
              {rides.length > 2 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground whitespace-nowrap">+{rides.length - 2}</Badge>
              )}
              {missingAnem && <Badge variant="destructive" className="text-[9px] px-1.5 py-0 opacity-80 whitespace-nowrap">No anem.</Badge>}
            </div>
          )}

          {/* Row 4: Action */}
          {entry.action_taken && (
            <p className="text-[11px] text-muted-foreground mt-1 break-words leading-snug">{entry.action_taken}</p>
          )}
        </button>

        {/* Expanded detail panel */}
        {isExpanded && (
          <div className="px-3 pb-3 space-y-2.5 border-t border-border/50 pt-2.5 mx-3">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Recorded by</span>
              <p className="text-[12px] text-foreground">{entry.recorded_by}</p>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Anemometer</span>
              {missingAnem ? (
                <Badge variant="destructive" className="text-[9px] px-1.5 py-0 opacity-80">No anemometer recorded</Badge>
              ) : (
                <p className="text-[11px] text-muted-foreground break-words leading-snug">{anemStr}</p>
              )}
            </div>
            {entry.action_taken && (
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Action</span>
                <p className="text-[11px] text-muted-foreground break-words leading-snug">{entry.action_taken}</p>
              </div>
            )}
            {entry.notes && (
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Notes</span>
                <p className="text-[11px] text-muted-foreground break-words leading-snug">{entry.notes}</p>
              </div>
            )}
            {rides.length > 2 && (
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">All linked inflatables</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {rides.map((name, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">{name}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-6">
      <PageHeader
        title="Wind Speed Register"
        icon={<Wind className="h-5 w-5 text-primary" />}
        subtitle="Record one reading and link it to one or more inflatables."
        showBackButton
        backTo="/overview"
        actions={
          <Button onClick={handleOpenSheet} size="sm" className="gap-1.5" disabled={inflatables.length === 0}>
            <Plus className="h-3.5 w-3.5" />
            Add wind reading
          </Button>
        }
      />

      {/* ─── Action bar ─── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className={cn("gap-1.5 min-h-[44px] h-auto px-3 text-xs", hasFilters && "border-primary/50")}>
          <Filter className="h-3.5 w-3.5" />
          {hasFilters ? `Filtered (${filteredLogs.length})` : 'Filter'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 min-h-[44px] h-auto px-3 text-xs" disabled={filteredLogs.length === 0}>
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export PDF</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </div>

      {/* ─── Filters ─── */}
      {showFilters && (
        <div className="bg-card rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1">
              <Filter className="h-3 w-3 text-muted-foreground" /> Filters
            </span>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[11px] h-6 gap-1 px-2">
                <X className="h-2.5 w-2.5" /> Clear
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-[11px] h-8 w-full", filterDateFrom && "text-foreground border-primary/30")}>
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {filterDateFrom ? format(filterDateFrom, 'd MMM yy') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filterDateFrom} onSelect={setFilterDateFrom} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("justify-start text-[11px] h-8 w-full", filterDateTo && "text-foreground border-primary/30")}>
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {filterDateTo ? format(filterDateTo, 'd MMM yy') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filterDateTo} onSelect={setFilterDateTo} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Select value={filterLocation || '__all__'} onValueChange={(v) => setFilterLocation(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-8 text-[11px]"><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All locations</SelectItem>
                {uniqueLocations.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterInflatable} onValueChange={setFilterInflatable}>
              <SelectTrigger className="h-8 text-[11px]"><SelectValue placeholder="Inflatable" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All inflatables</SelectItem>
                {inflatables.map(r => <SelectItem key={r.id} value={r.id}>{r.ride_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterRecordedBy} onValueChange={setFilterRecordedBy}>
              <SelectTrigger className="h-8 text-[11px]"><SelectValue placeholder="Recorded by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {uniqueRecordedBy.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="h-8 text-[11px]"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                {ACTION_FILTER_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* ─── No inflatables ─── */}
      {inflatables.length === 0 && !loading && (
        <div className="text-center py-8">
          <Wind className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No inflatables found. Add an inflatable to start logging wind readings.</p>
        </div>
      )}

      {/* ─── Loading / Content ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 && inflatables.length > 0 ? (
        <div className="text-center py-8">
          <Wind className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No wind readings recorded yet.</p>
          <p className="text-[11px] text-muted-foreground mt-1">Tap "Add" to log your first entry.</p>
        </div>
      ) : (
        <>
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            {/* Desktop column headers */}
            {!isMobile && (
              <div className="grid grid-cols-[78px_48px_74px_1fr_1.2fr_1.4fr_32px] items-center px-4 py-2 bg-muted/50 border-b border-border gap-x-3">
                {['Date', 'Time', 'Speed', 'Location', 'Applies To', 'Action / Status', ''].map((h, i) => (
                  <span key={i} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">{h}</span>
                ))}
              </div>
            )}

            {pagedLogs.length === 0 ? (
              <div className="text-center py-8">
                <Wind className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">No readings match your filters</p>
              </div>
            ) : (
              <div>
                {isMobile
                  ? pagedLogs.map(e => renderMobileRow(e))
                  : pagedLogs.map(e => renderDesktopRow(e))
                }
              </div>
            )}
          </div>

          {/* ─── Pagination ─── */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 gap-2 flex-wrap">
            <span className="whitespace-nowrap">
              {filteredLogs.length} reading{filteredLogs.length !== 1 ? 's' : ''}
              {hasFilters ? ' (filtered)' : ''}
              {totalPages > 1 && ` · Page ${page + 1}/${totalPages}`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 min-h-[36px]" disabled={page === 0} onClick={() => setPage(0)}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 min-h-[36px]" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 min-h-[36px]" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 min-h-[36px]" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
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
                    {UNIT_OPTIONS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* High wind inline warning */}
            {isHighWind && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold text-destructive">High wind warning — {HIGH_WIND_MPH} mph / 38 km/h</p>
                  <p className="text-muted-foreground">This reading is at or above the outdoor operating wind limit for inflatable play equipment under BS EN 14960-1. Operation should be reviewed immediately and the action taken must be recorded.</p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Recorded By *</Label>
              <Input placeholder="Name of person" value={recordedBy} onChange={(e) => setRecordedBy(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Location</Label>
              <Input placeholder="e.g. Main field, Site entrance" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
            </div>

            {/* Anemometer - Required, always visible */}
            <div className="space-y-2 rounded-lg border border-border bg-card p-3">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Gauge className="h-3 w-3 text-muted-foreground" /> Anemometer Used *
              </Label>
              {anemometerProfiles.length > 0 && (
                <Select value={selectedProfileId} onValueChange={handleSelectProfile}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select anemometer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {anemometerProfiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label || `${p.make} ${p.model}`}
                      </SelectItem>
                    ))}
                    <SelectItem value="manual">Enter manually</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Make *</Label>
                  <Input placeholder="e.g. Kestrel" value={anemometerMake} onChange={(e) => setAnemometerMake(e.target.value)} maxLength={100} className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Model *</Label>
                  <Input placeholder="e.g. 3000" value={anemometerModel} onChange={(e) => setAnemometerModel(e.target.value)} maxLength={100} className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Serial</Label>
                  <Input placeholder="Serial no." value={anemometerSerial} onChange={(e) => setAnemometerSerial(e.target.value)} maxLength={100} className="h-9 text-xs" />
                </div>
              </div>
              {selectedProfileId === 'manual' && anemometerMake && anemometerModel && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveAsProfile}
                  disabled={savingProfile}
                  className="text-[11px] h-7 gap-1 px-2"
                >
                  <Save className="h-3 w-3" />
                  {savingProfile ? 'Saving...' : 'Save as profile for future use'}
                </Button>
              )}
            </div>

            {/* Inflatable selector */}
            <div className="space-y-2 rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs font-semibold">Applies to *</Label>
                <div className="flex items-center gap-1.5">
                  <button type="button" className="text-[11px] text-primary font-medium hover:underline" onClick={() => setSelectedRideIds(inflatables.map(r => r.id))}>Select all</button>
                  <span className="text-[11px] text-muted-foreground">·</span>
                  <button type="button" className="text-[11px] text-primary font-medium hover:underline" onClick={() => setSelectedRideIds([])}>Clear</button>
                </div>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto rounded border border-border p-1.5">
                {inflatables.map((ride) => (
                  <label key={ride.id} className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={selectedRideIds.includes(ride.id)} onCheckedChange={() => toggleRide(ride.id)} />
                    <span className="text-[13px] truncate">{ride.ride_name}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{selectedRideIds.length} of {inflatables.length} selected</p>
            </div>

            {/* Action */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Action Taken{isHighWind ? ' *' : ''}
              </Label>
              <Select value={actionTaken} onValueChange={setActionTaken}>
                <SelectTrigger><SelectValue placeholder="Select action..." /></SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {actionTaken && (
                <Textarea placeholder={actionTaken === 'other' ? 'Describe action taken...' : 'Additional notes (optional)'} value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} className="min-h-[56px] mt-1" maxLength={500} />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Notes{isHighWind ? ' (recommended)' : ''}
              </Label>
              <Textarea placeholder="Any additional notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[56px]" maxLength={500} />
            </div>
            <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] bg-background border-t border-border">
              <Button onClick={validateAndSave} disabled={saving || selectedRideIds.length === 0} className="w-full h-11">
                {saving ? 'Saving...' : selectedRideIds.length === 0 ? 'Select inflatables to save' : `Save to ${selectedRideIds.length} inflatable${selectedRideIds.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── High Wind Confirmation Dialog ─── */}
      <Dialog open={highWindDialogOpen} onOpenChange={setHighWindDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Wind reading at or above limit
            </DialogTitle>
            <DialogDescription className="text-left space-y-2 pt-2">
              <p>
                This reading is at or above the <strong>{HIGH_WIND_MPH} mph (38 km/h)</strong> outdoor operating wind limit referenced for inflatable play equipment under BS EN 14960-1. Please confirm the action taken before saving this record.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setHighWindDialogOpen(false)} className="sm:flex-1">
              Go back
            </Button>
            <Button variant="destructive" onClick={handleHighWindConfirm} className="sm:flex-1">
              Confirm &amp; save reading
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExportActionsDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} result={exportResult} />
    </div>
  );
};

export default WindLog;
