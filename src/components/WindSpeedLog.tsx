import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useDateTimeSettings } from '@/hooks/useDateTimeSettings';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Wind, MapPin, Clock, ChevronDown, Gauge, User, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

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

const WindSpeedLog = ({ rideId, rideName }: WindSpeedLogProps) => {
  const { effectiveUserId } = useEffectiveUserId();
  const { formatDate } = useDateTimeSettings();

  const [logs, setLogs] = useState<WindLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveUserId) return;
    const load = async () => {
      try {
        // Get wind_log_ids linked to this ride via junction table
        const { data: junctions, error: jErr } = await supabase
          .from('wind_log_rides')
          .select('wind_log_id')
          .eq('ride_id', rideId);

        if (jErr) throw jErr;

        if (!junctions || junctions.length === 0) {
          setLogs([]);
          setLoading(false);
          return;
        }

        const logIds = junctions.map(j => j.wind_log_id);

        const { data, error } = await supabase
          .from('wind_speed_logs')
          .select('*')
          .in('id', logIds)
          .order('log_date', { ascending: false })
          .order('log_time', { ascending: false })
          .limit(100);

        if (error) throw error;
        setLogs((data as WindLogEntry[]) || []);
      } catch (err) {
        console.error('Error loading wind logs:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [rideId, effectiveUserId]);

  const hasAnemometerDetails = (entry: WindLogEntry) =>
    entry.anemometer_make || entry.anemometer_model || entry.anemometer_serial;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wind className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Wind Log</h2>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link to="/wind-log">Go to Wind Log</Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <Card className="p-6 text-center">
          <Wind className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No wind readings linked to {rideName} yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Use the <Link to="/wind-log" className="text-primary underline">Wind Log</Link> page to record readings for multiple inflatables at once.
          </p>
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
    </div>
  );
};

export default WindSpeedLog;
