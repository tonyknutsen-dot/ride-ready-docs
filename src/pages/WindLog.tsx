import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';
import { useDateTimeSettings } from '@/hooks/useDateTimeSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wind, Plus, MapPin, Clock, ChevronDown, Gauge, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/PageHeader';

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

  const [logs, setLogs] = useState<WindLogEntry[]>([]);
  const [inflatables, setInflatables] = useState<InflatableRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Defaults
  const [defaultRecordedBy, setDefaultRecordedBy] = useState('');
  const [defaultLocation, setDefaultLocation] = useState('');

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
        .select('controller_name')
        .eq('user_id', effectiveUserId)
        .maybeSingle();
      if (data?.controller_name) setDefaultRecordedBy(data.controller_name);
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
      // Get all wind logs for this user
      const { data: windLogs, error } = await supabase
        .from('wind_speed_logs')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('log_date', { ascending: false })
        .order('log_time', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get junction rows for ride names
      if (windLogs && windLogs.length > 0) {
        const logIds = windLogs.map((l: any) => l.id);
        const { data: junctions } = await supabase
          .from('wind_log_rides')
          .select('wind_log_id, ride_id')
          .in('wind_log_id', logIds);

        // Build a map of log_id -> ride_names
        const rideIdToName = Object.fromEntries(inflatables.map(r => [r.id, r.ride_name]));
        const logRideMap: Record<string, string[]> = {};
        for (const j of (junctions || [])) {
          if (!logRideMap[j.wind_log_id]) logRideMap[j.wind_log_id] = [];
          logRideMap[j.wind_log_id].push(rideIdToName[j.ride_id] || 'Unknown');
        }

        setLogs(windLogs.map((l: any) => ({
          ...l,
          linked_rides: logRideMap[l.id] || [],
        })));
      } else {
        setLogs([]);
      }

      // Prefill location from most recent
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
    // Default to none selected — user picks which inflatables apply
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
      // Insert the wind log entry (ride_id null since linked via junction)
      const { data: inserted, error } = await supabase.from('wind_speed_logs').insert({
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
      }).select('id').single();

      if (error) throw error;

      // Insert junction rows
      const junctionRows = selectedRideIds.map(rideId => ({
        wind_log_id: inserted.id,
        ride_id: rideId,
      }));
      const { error: jError } = await supabase.from('wind_log_rides').insert(junctionRows);
      if (jError) throw jError;

      toast({ title: 'Reading saved' });
      setSheetOpen(false);
      loadLogs();
    } catch (err: any) {
      console.error('Error saving wind log:', err);
      toast({ title: "Couldn't save wind reading", description: 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const hasAnemometerDetails = (entry: WindLogEntry) =>
    entry.anemometer_make || entry.anemometer_model || entry.anemometer_serial;

  return (
    <div className="space-y-4">
      <PageHeader title="Wind Log" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wind className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">
            Log wind readings and link them to your inflatables.
          </p>
        </div>
        <Button onClick={handleOpenSheet} size="sm" className="gap-1.5" disabled={inflatables.length === 0}>
          <Plus className="h-4 w-4" />
          Add Reading
        </Button>
      </div>

      {inflatables.length === 0 && !loading && (
        <Card className="p-6 text-center">
          <Wind className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No inflatables found.</p>
          <p className="text-xs text-muted-foreground mt-1">Add an inflatable to your equipment list to start logging wind readings.</p>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 && inflatables.length > 0 ? (
        <Card className="p-6 text-center">
          <Wind className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No wind speed readings recorded yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Tap "Add Reading" to log your first entry.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((entry) => (
            <Card key={entry.id} className="p-3.5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">
                      {formatDate(entry.log_date)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {entry.log_time.slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{entry.recorded_by}</span>
                  </div>
                  {entry.location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{entry.location}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 bg-primary/10 px-3 py-1.5 rounded-lg">
                  <Gauge className="h-4 w-4 text-primary" />
                  <span className="text-base font-bold text-primary">{entry.wind_speed}</span>
                  <span className="text-xs font-medium text-primary/70">{entry.wind_unit}</span>
                </div>
              </div>

              {/* Linked inflatables */}
              {entry.linked_rides && entry.linked_rides.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {entry.linked_rides.map((name, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                      {name}
                    </span>
                  ))}
                </div>
              )}

              {entry.action_taken && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1.5">
                  <span className="font-medium text-foreground">Action: </span>{entry.action_taken}
                </p>
              )}

              {entry.notes && (
                <p className="text-xs text-muted-foreground italic">{entry.notes}</p>
              )}

              {hasAnemometerDetails(entry) && (
                <Collapsible open={expandedId === entry.id} onOpenChange={(open) => setExpandedId(open ? entry.id : null)}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronDown className={`h-3 w-3 transition-transform ${expandedId === entry.id ? 'rotate-180' : ''}`} />
                    Anemometer details
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-1.5">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-2.5 py-2">
                      {entry.anemometer_make && <span><span className="font-medium">Make:</span> {entry.anemometer_make}</span>}
                      {entry.anemometer_model && <span><span className="font-medium">Model:</span> {entry.anemometer_model}</span>}
                      {entry.anemometer_serial && <span><span className="font-medium">Serial:</span> {entry.anemometer_serial}</span>}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add Reading Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="mb-4">
            <SheetTitle>Add Wind Reading</SheetTitle>
            <SheetDescription>Record a wind speed measurement and link it to your inflatables.</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 pb-6">
            {/* Date & Time */}
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

            {/* Speed & Unit */}
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

            {/* Recorded by */}
            <div className="space-y-1.5">
              <Label className="text-xs">Recorded By *</Label>
              <Input placeholder="Name of person" value={recordedBy} onChange={(e) => setRecordedBy(e.target.value)} maxLength={100} />
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label className="text-xs">Location</Label>
              <Input placeholder="e.g. Main field, Site entrance" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
            </div>

            {/* Inflatable selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Applies to *</Label>
                <button
                  type="button"
                  className="text-[11px] text-primary font-medium hover:underline"
                  onClick={() => {
                    if (selectedRideIds.length === inflatables.length) {
                      setSelectedRideIds([]);
                    } else {
                      setSelectedRideIds(inflatables.map(r => r.id));
                    }
                  }}
                >
                  {selectedRideIds.length === inflatables.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-border p-2">
                {inflatables.map((ride) => (
                  <label key={ride.id} className="flex items-center gap-2.5 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      checked={selectedRideIds.includes(ride.id)}
                      onCheckedChange={() => toggleRide(ride.id)}
                    />
                    <span className="text-sm">{ride.ride_name}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{selectedRideIds.length} of {inflatables.length} selected</p>
            </div>

            {/* Anemometer Details — collapsible */}
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

            <Button onClick={handleSave} disabled={saving} className="w-full h-12">
              {saving ? 'Saving...' : 'Save Reading'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default WindLog;
