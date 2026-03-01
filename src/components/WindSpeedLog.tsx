import { useState, useEffect } from 'react';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wind, Plus, MapPin, Clock, ChevronDown, Gauge, User } from 'lucide-react';
import { format } from 'date-fns';

interface WindSpeedLogProps {
  rideId: string;
  rideName: string;
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

const WindSpeedLog = ({ rideId, rideName }: WindSpeedLogProps) => {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const { formatDate } = useDateTimeSettings();

  const [logs, setLogs] = useState<WindLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Defaults loaded from profile / last entry
  const [defaultRecordedBy, setDefaultRecordedBy] = useState('');
  const [defaultLocation, setDefaultLocation] = useState('');

  // Form state
  const now = new Date();
  const [logDate, setLogDate] = useState(format(now, 'yyyy-MM-dd'));
  const [logTime, setLogTime] = useState(format(now, 'HH:mm'));
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

  // Load user name for default "Recorded By"
  useEffect(() => {
    const loadDefaults = async () => {
      if (!effectiveUserId) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('controller_name')
          .eq('user_id', effectiveUserId)
          .maybeSingle();
        if (data?.controller_name) {
          setDefaultRecordedBy(data.controller_name);
        }
      } catch (err) {
        console.error('Error loading profile for wind log:', err);
      }
    };
    loadDefaults();
  }, [effectiveUserId]);

  useEffect(() => {
    loadLogs();
  }, [rideId, effectiveUserId]);

  const loadLogs = async () => {
    if (!effectiveUserId) return;
    try {
      const { data, error } = await supabase
        .from('wind_speed_logs')
        .select('*')
        .eq('ride_id', rideId)
        .order('log_date', { ascending: false })
        .order('log_time', { ascending: false })
        .limit(100);

      if (error) throw error;
      const entries = (data as WindLogEntry[]) || [];
      setLogs(entries);

      // Prefill location from most recent entry for this ride
      if (entries.length > 0 && entries[0].location) {
        setDefaultLocation(entries[0].location);
      }
    } catch (err) {
      console.error('Error loading wind logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
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
  };

  // When opening the sheet, prefill defaults
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
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!effectiveUserId || !windSpeed || !recordedBy) {
      toast({ title: 'Missing fields', description: 'Wind speed and recorded by are required.', variant: 'destructive' });
      return;
    }

    // Build action_taken string from structured selection
    let finalAction: string | null = null;
    if (actionTaken === 'other') {
      finalAction = actionNotes || null;
    } else if (actionTaken) {
      const label = ACTION_LABEL_MAP[actionTaken] || actionTaken;
      finalAction = actionNotes ? `${label} — ${actionNotes}` : label;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('wind_speed_logs').insert({
        user_id: effectiveUserId,
        ride_id: rideId,
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

      toast({ title: 'Reading saved' });
      setSheetOpen(false);
      resetForm();
      loadLogs();
    } catch (err: any) {
      console.error('Error saving wind log:', err);
      toast({ title: 'Error saving reading', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const hasAnemometerDetails = (entry: WindLogEntry) =>
    entry.anemometer_make || entry.anemometer_model || entry.anemometer_serial;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wind className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Wind Log</h2>
        </div>
        <Button onClick={handleOpenSheet} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Reading
        </Button>
      </div>

      {/* Log list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      ) : logs.length === 0 ? (
        <Card className="p-6 text-center">
          <Wind className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No wind speed readings recorded yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Tap "Add Reading" to log your first entry.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((entry) => (
            <Card key={entry.id} className="p-3.5 space-y-2">
              {/* Primary info: date, time, speed */}
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

              {/* Action taken */}
              {entry.action_taken && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1.5">
                  <span className="font-medium text-foreground">Action: </span>{entry.action_taken}
                </p>
              )}

              {/* Notes */}
              {entry.notes && (
                <p className="text-xs text-muted-foreground italic">{entry.notes}</p>
              )}

              {/* Anemometer details — collapsible */}
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
            <SheetDescription>Record a wind speed measurement for {rideName}.</SheetDescription>
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
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  placeholder="e.g. 15"
                  value={windSpeed}
                  onChange={(e) => setWindSpeed(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unit</Label>
                <Select value={windUnit} onValueChange={setWindUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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

            {/* Action taken — structured */}
            <div className="space-y-1.5">
              <Label className="text-xs">Action Taken</Label>
              <Select value={actionTaken} onValueChange={setActionTaken}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action..." />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {actionTaken && (
                <Textarea
                  placeholder={actionTaken === 'other' ? 'Describe action taken...' : 'Additional notes on action (optional)'}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="min-h-[60px] mt-1.5"
                  maxLength={500}
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

export default WindSpeedLog;
