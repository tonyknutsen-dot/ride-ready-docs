import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useDateTimeSettings } from '@/hooks/useDateTimeSettings';
import { Badge } from '@/components/ui/badge';
import { Wind, MapPin, Loader2, ExternalLink, Download, ChevronDown, Gauge, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { generateWindLogPdf } from '@/utils/windLogPdf';
import { cn } from '@/lib/utils';

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

const DEFAULT_LIMIT = 20;

const HIGH_WIND_MPH = 24;
function toMph(speed: number, unit: string): number {
  if (unit === 'mph') return speed;
  if (unit === 'km/h') return speed * 0.621371;
  if (unit === 'm/s') return speed * 2.23694;
  return speed;
}

const WindSpeedLog = ({ rideId, rideName }: WindSpeedLogProps) => {
  const { effectiveUserId } = useEffectiveUserId();
  const { formatDate } = useDateTimeSettings();
  const navigate = useNavigate();

  const [allLogs, setAllLogs] = useState<WindLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveUserId) return;
    const load = async () => {
      try {
        const { data: junctions, error: jErr } = await supabase
          .from('wind_log_rides')
          .select('wind_log_id')
          .eq('ride_id', rideId);

        if (jErr) throw jErr;

        if (!junctions || junctions.length === 0) {
          setAllLogs([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }

        const logIds = junctions.map(j => j.wind_log_id);
        setTotalCount(logIds.length);

        const { data, error } = await supabase
          .from('wind_speed_logs')
          .select('*')
          .in('id', logIds)
          .order('log_date', { ascending: false })
          .order('log_time', { ascending: false })
          .limit(200);

        if (error) throw error;
        setAllLogs((data as WindLogEntry[]) || []);
      } catch (err) {
        console.error('Error loading wind logs:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [rideId, effectiveUserId]);

  const displayLogs = useMemo(() => {
    return showAll ? allLogs : allLogs.slice(0, DEFAULT_LIMIT);
  }, [allLogs, showAll]);

  const handleExport = () => {
    if (allLogs.length === 0) return;
    generateWindLogPdf({
      entries: allLogs,
      title: `Wind Log – ${rideName}`,
      inflatableName: rideName,
      singleRideId: rideId,
    });
  };

  const formatAnemometer = (entry: WindLogEntry) => {
    const parts = [entry.anemometer_make, entry.anemometer_model, entry.anemometer_serial ? `S/N ${entry.anemometer_serial}` : null].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : null;
  };

  const hasMissingAnem = (entry: WindLogEntry) => !entry.anemometer_make && !entry.anemometer_model;
  const isHighWind = (entry: WindLogEntry) => toMph(entry.wind_speed, entry.wind_unit) >= HIGH_WIND_MPH;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Wind className="h-4 w-4 text-primary" />
          <h2 className="text-[13px] font-semibold text-foreground">Wind Log</h2>
          {!loading && totalCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{totalCount}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => navigate(`/wind-log?prelink=${rideId}`)}
            className="gap-1 min-h-[36px] h-auto text-[11px] px-2"
          >
            <Plus className="h-3 w-3" />Add wind reading
          </Button>
          {allLogs.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 min-h-[36px] h-auto text-[11px] px-2">
              <Download className="h-3 w-3" />Export
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="gap-1 min-h-[36px] h-auto text-[11px] px-2">
            <Link to="/wind-log">
              <ExternalLink className="h-3 w-3" />Full Register
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : allLogs.length === 0 ? (
        <div className="text-center py-6 border border-border rounded-lg">
          <Wind className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground">No wind readings linked to {rideName}.</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Use the <Link to="/wind-log" className="text-primary underline">Wind Speed Register</Link> to add readings.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            {displayLogs.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const anemStr = formatAnemometer(entry);
              const missingAnem = hasMissingAnem(entry);
              const highWind = isHighWind(entry);

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "border-b border-border last:border-b-0",
                    isExpanded && "bg-muted/5",
                    highWind && "border-l-2 border-l-destructive"
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5 min-h-[48px] active:bg-muted/20 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    {/* Row 1: Date + Time + Speed + chevron */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[12px] font-medium text-foreground tabular-nums whitespace-nowrap">{formatDate(entry.log_date)}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">{entry.log_time.slice(0, 5)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {highWind ? (
                          <Badge variant="destructive" className="text-[12px] px-2 py-0.5 font-bold tabular-nums whitespace-nowrap">
                            {entry.wind_speed} {entry.wind_unit}
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded whitespace-nowrap">
                            <span className="text-[13px] font-bold text-primary tabular-nums">{entry.wind_speed}</span>
                            <span className="text-[10px] text-primary/60">{entry.wind_unit}</span>
                          </div>
                        )}
                        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground/40 transition-transform shrink-0", isExpanded && "rotate-180")} />
                      </div>
                    </div>
                    {/* Row 2: Location */}
                    {entry.location && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 break-words leading-snug">
                        <MapPin className="h-2.5 w-2.5 inline-block mr-0.5 -mt-px" />
                        {entry.location}
                      </p>
                    )}
                    {/* Row 3: warnings */}
                    {missingAnem && (
                      <div className="mt-1">
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0 opacity-80 whitespace-nowrap">No anem.</Badge>
                      </div>
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2 mx-3">
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 gap-2">
            <span>Showing {displayLogs.length} of {totalCount}</span>
            {!showAll && allLogs.length > DEFAULT_LIMIT && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="text-[11px] min-h-[36px] h-auto gap-1 px-2">
                View all {totalCount}
              </Button>
            )}
            {showAll && allLogs.length > DEFAULT_LIMIT && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll(false)} className="text-[11px] min-h-[36px] h-auto gap-1 px-2">
                Show latest {DEFAULT_LIMIT}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default WindSpeedLog;