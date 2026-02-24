import { useNavigate } from 'react-router-dom';
import { AlertOctagon, CheckSquare, PauseCircle, PlayCircle, Wrench, ChevronRight, Eye, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useOperationsOverview } from '@/hooks/useOperationsOverview';
import { format } from 'date-fns';

const OperationsOverviewPanel = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useOperationsOverview();

  if (isLoading || !data) return null;

  const hasCritical = data.openCriticalDefects.length > 0;
  const hasOutstandingChecks = data.checksOutstandingRides.length > 0;
  const hasNotOperating = data.notOperatingRides.length > 0;

  const hasExceptions = hasCritical || hasOutstandingChecks || hasNotOperating;

  // Don't show panel if no rides at all
  if (data.operatingCount === 0 && data.notOperatingCount === 0) return null;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div>
        <h2 className="text-[13px] font-bold text-foreground mb-2 tracking-[1px] uppercase">Operations Today</h2>
        <div className="h-px bg-border mb-4" />
      </div>

      {/* All-clear state */}
      {!hasExceptions && (
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/20 px-4 py-3">
          <PlayCircle className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{data.operatingCount} operating</span>
            {data.notOperatingCount === 0 ? ' — no exceptions.' : ` · ${data.notOperatingCount} not operating — no exceptions.`}
          </p>
        </div>
      )}

      {/* A) Critical defects list — red */}
      {hasCritical && (
        <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-destructive" />
            <span className="text-sm font-bold text-destructive">Open Critical Defects</span>
          </div>
          <div className="space-y-2">
            {data.openCriticalDefects.map((d) => (
              <div key={d.id} className="flex items-start gap-3 bg-white/60 dark:bg-card rounded-xl p-3 border border-destructive/20">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{d.ride_name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{d.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">Open</Badge>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(d.reported_at), 'dd MMM HH:mm')}</span>
                    <Badge variant="outline" className={`text-[10px] ${d.is_operating ? 'border-green-300 text-green-700' : 'border-border text-muted-foreground'}`}>
                      {d.is_operating ? 'Operating' : 'Not Operating'}
                    </Badge>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/rides?rideId=${d.ride_id}`)}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                >
                  <ChevronRight className="h-4 w-4 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* B) Operating with checks outstanding — amber */}
      {hasOutstandingChecks && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Checks Outstanding ({data.operatingWithChecksOutstanding})</span>
          </div>
          <div className="space-y-1">
            {data.checksOutstandingRides.map((r) => (
              <button
                key={r.ride_id}
                onClick={() => navigate(`/rides?rideId=${r.ride_id}&tab=checks`)}
                className="flex items-center justify-between w-full bg-white/60 dark:bg-card rounded-xl px-3 py-2 border border-amber-200 hover:border-amber-400 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <PlayCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  <span className="text-xs font-medium text-foreground truncate">{r.ride_name}</span>
                </div>
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">No check today</Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* C) Not operating rides — grey */}
      {hasNotOperating && (
        <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <PauseCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold text-muted-foreground">Not Operating ({data.notOperatingCount})</span>
          </div>
          <div className="space-y-1">
            {data.notOperatingRides.map((r) => (
              <button
                key={r.ride_id}
                onClick={() => navigate(`/rides?rideId=${r.ride_id}`)}
                className="flex items-center justify-between w-full bg-white/60 dark:bg-card rounded-xl px-3 py-2 border border-border hover:border-primary/30 transition-colors"
              >
                <span className="text-xs font-medium text-foreground truncate">{r.ride_name}</span>
                {r.reason && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[50%] text-right">{r.reason}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationsOverviewPanel;
