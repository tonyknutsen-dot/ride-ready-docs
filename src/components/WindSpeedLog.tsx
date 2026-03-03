import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useDateTimeSettings } from '@/hooks/useDateTimeSettings';
import { Badge } from '@/components/ui/badge';
import { Wind, MapPin, Loader2, ExternalLink, Download, ChevronRight, Gauge } from 'lucide-react';
import { Link } from 'react-router-dom';
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

const WindSpeedLog = ({ rideId, rideName }: WindSpeedLogProps) => {
  const { effectiveUserId } = useEffectiveUserId();
  const { formatDate } = useDateTimeSettings();

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
          {allLogs.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 h-7 text-[11px]">
              <Download className="h-3 w-3" />Export
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="gap-1 h-7 text-[11px]">
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
              return (
                <div
                  key={entry.id}
                  className={cn("border-b border-border last:border-0", isExpanded && "bg-muted/10")}
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-medium text-foreground tabular-nums">{formatDate(entry.log_date)}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{entry.log_time.slice(0, 5)}</span>
                        {entry.location && (
                          <span className="text-[10px] text-muted-foreground truncate flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />{entry.location}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{entry.recorded_by}</span>
                        {anemStr && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            · <Gauge className="h-2.5 w-2.5" /> {anemStr}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 bg-primary/8 px-2 py-0.5 rounded">
                      <span className="text-[13px] font-bold text-primary tabular-nums">{entry.wind_speed}</span>
                      <span className="text-[10px] text-primary/60">{entry.wind_unit}</span>
                    </div>
                    <ChevronRight className={cn("h-3 w-3 text-muted-foreground/40 shrink-0 transition-transform", isExpanded && "rotate-90")} />
                  </div>
                  {isExpanded && (
                    <div className="px-3 pb-2 space-y-1">
                      {entry.action_taken && (
                        <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">Action:</span> {entry.action_taken}</p>
                      )}
                      {entry.notes && (
                        <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">Notes:</span> {entry.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span>Showing {displayLogs.length} of {totalCount} readings</span>
            {!showAll && allLogs.length > DEFAULT_LIMIT && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="text-[11px] h-6 gap-1 px-2">
                View all {totalCount} readings
              </Button>
            )}
            {showAll && allLogs.length > DEFAULT_LIMIT && (
              <Button variant="ghost" size="sm" onClick={() => setShowAll(false)} className="text-[11px] h-6 gap-1 px-2">
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
