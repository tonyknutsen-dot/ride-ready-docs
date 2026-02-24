import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertOctagon, PauseCircle, PlayCircle, ChevronRight,
  AlertTriangle, CheckSquare, Search, Filter, ShieldAlert,
  Clock, CheckCircle, Eye
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useOperationsOverview } from '@/hooks/useOperationsOverview';
import { format } from 'date-fns';

type ActiveKpiFilter = 'all' | 'operating' | 'not_operating' | 'checks_outstanding' | 'critical' | 'high';

const OperationsOverviewPanel = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useOperationsOverview();
  const [exceptionsOnly, setExceptionsOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [kpiFilter, setKpiFilter] = useState<ActiveKpiFilter>('all');

  // Filtered all-rides for table view (must be before early returns)
  const filteredRides = useMemo(() => {
    if (!data) return [];
    let rides = data.allRides;
    if (search.trim()) {
      const q = search.toLowerCase();
      rides = rides.filter(r => r.ride_name.toLowerCase().includes(q));
    }
    switch (kpiFilter) {
      case 'operating': return rides.filter(r => r.is_operating);
      case 'not_operating': return rides.filter(r => !r.is_operating);
      case 'checks_outstanding': return rides.filter(r => r.is_operating && r.requires_checks && !r.checks_done_today);
      case 'critical': return rides.filter(r => r.open_critical > 0);
      case 'high': return rides.filter(r => r.open_high > 0);
      default: return rides;
    }
  }, [data, search, kpiFilter]);

  if (isLoading || !data) return null;
  if (data.allRides.length === 0) return null;

  const hasCritical = data.openCriticalDefects.length > 0;
  const hasOutstandingChecks = data.checksOutstandingRides.length > 0;
  const hasNotOperating = data.notOperatingRides.length > 0;
  const hasExceptions = hasCritical || hasOutstandingChecks || hasNotOperating;

  const handleKpiClick = (filter: ActiveKpiFilter) => {
    if (filter !== 'all') setExceptionsOnly(false);
    setKpiFilter(prev => prev === filter ? 'all' : filter);
  };

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div>
        <h2 className="text-[13px] font-bold text-foreground mb-2 tracking-[1px] uppercase">Operations Today</h2>
        <div className="h-px bg-border" />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {([
          { key: 'operating' as const, label: 'Operating', value: data.operatingCount, icon: PlayCircle, accent: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30', borderActive: 'border-green-400' },
          { key: 'not_operating' as const, label: 'Not Operating', value: data.notOperatingCount, icon: PauseCircle, accent: 'text-muted-foreground', bg: 'bg-muted/40', borderActive: 'border-muted-foreground' },
          { key: 'checks_outstanding' as const, label: 'Checks Due', value: data.operatingWithChecksOutstanding, icon: AlertTriangle, accent: data.operatingWithChecksOutstanding > 0 ? 'text-amber-600' : 'text-muted-foreground', bg: data.operatingWithChecksOutstanding > 0 ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-muted/40', borderActive: 'border-amber-400' },
          { key: 'critical' as const, label: 'Critical', value: data.openCriticalDefects.length, icon: AlertOctagon, accent: data.openCriticalDefects.length > 0 ? 'text-destructive' : 'text-muted-foreground', bg: data.openCriticalDefects.length > 0 ? 'bg-destructive/5' : 'bg-muted/40', borderActive: 'border-destructive' },
          { key: 'high' as const, label: 'High', value: data.openHighDefects, icon: ShieldAlert, accent: data.openHighDefects > 0 ? 'text-orange-600' : 'text-muted-foreground', bg: data.openHighDefects > 0 ? 'bg-orange-50 dark:bg-orange-950/20' : 'bg-muted/40', borderActive: 'border-orange-400' },
          { key: 'all' as const, label: 'Checks Done', value: `${data.preOpeningCompletedToday}/${data.preOpeningDueToday}`, icon: CheckSquare, accent: 'text-primary', bg: 'bg-primary/5', borderActive: 'border-primary' },
        ]).map(({ key, label, value, icon: Icon, accent, bg, borderActive }) => (
          <button
            key={key}
            onClick={() => key !== 'all' ? handleKpiClick(key) : undefined}
            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
              kpiFilter === key ? `${borderActive} border-2 shadow-sm` : 'border-border'
            } ${bg} ${key !== 'all' ? 'cursor-pointer hover:border-primary/40 active:scale-[0.97]' : 'cursor-default'}`}
          >
            <Icon className={`h-3.5 w-3.5 ${accent}`} strokeWidth={2} />
            <span className={`text-lg font-bold leading-none ${accent}`}>{value}</span>
            <span className="text-[9px] font-medium text-muted-foreground text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Controls bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Switch
            id="exceptions-toggle"
            checked={exceptionsOnly}
            onCheckedChange={(v) => { setExceptionsOnly(v); if (v) setKpiFilter('all'); }}
            className="data-[state=checked]:bg-primary"
          />
          <Label htmlFor="exceptions-toggle" className="text-xs font-medium text-muted-foreground cursor-pointer">
            Exceptions only
          </Label>
        </div>
        {!exceptionsOnly && (
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rides…"
              className="h-8 pl-8 text-xs"
            />
          </div>
        )}
        {kpiFilter !== 'all' && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setKpiFilter('all')}>
            <Filter className="h-3 w-3" /> Clear filter
          </Button>
        )}
      </div>

      {/* ── EXCEPTIONS VIEW ─────────────── */}
      {exceptionsOnly && (
        <>
          {/* All clear state */}
          {!hasExceptions && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">No exceptions</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No critical defects or outstanding pre-opening checks for rides marked operating today.
                </p>
              </div>
            </div>
          )}

          {/* A) Critical defects — red */}
          {hasCritical && (
            <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-destructive" />
                <span className="text-sm font-bold text-destructive">Open Critical Defects ({data.openCriticalDefects.length})</span>
              </div>
              <div className="space-y-2">
                {data.openCriticalDefects.map((d) => (
                  <div key={d.id} className="flex items-start gap-3 bg-card rounded-xl p-3 border border-destructive/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{d.ride_name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{d.description}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">Open</Badge>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(d.reported_at), 'dd MMM HH:mm')}</span>
                        <Badge variant="outline" className={`text-[10px] ${d.is_operating ? 'border-green-300 text-green-700' : 'border-border text-muted-foreground'}`}>
                          {d.is_operating ? 'Operating' : 'Not Operating'}
                        </Badge>
                        {d.check_id && (
                          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">From check</Badge>
                        )}
                      </div>
                      {!d.is_operating && d.not_operating_reason && (
                        <p className="text-[10px] text-muted-foreground italic mt-1 truncate">Reason: {d.not_operating_reason}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => navigate(`/rides?rideId=${d.ride_id}`)}>
                        <Eye className="h-3 w-3" /> Ride
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate(`/maintenance`)}>
                        Maint.
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* B) Checks outstanding — amber */}
          {hasOutstandingChecks && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Checks Outstanding ({data.operatingWithChecksOutstanding})</span>
              </div>
              <div className="space-y-1.5">
                {data.checksOutstandingRides.map((r) => (
                  <div key={r.ride_id} className="flex items-center justify-between bg-card rounded-xl px-3 py-2.5 border border-amber-200">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <PlayCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-foreground truncate block">{r.ride_name}</span>
                        <span className="text-[10px] text-muted-foreground">{r.check_label}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.last_check_time && (
                        <span className="text-[10px] text-muted-foreground">Last: {format(new Date(r.last_check_time), 'HH:mm')}</span>
                      )}
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-amber-300" onClick={() => navigate(`/rides?rideId=${r.ride_id}&tab=checks`)}>
                        <CheckSquare className="h-3 w-3" /> Checks
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* C) Not operating — grey */}
          {hasNotOperating && (
            <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <PauseCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-bold text-muted-foreground">Not Operating ({data.notOperatingCount})</span>
              </div>
              <div className="space-y-1.5">
                {data.notOperatingRides.map((r) => (
                  <button
                    key={r.ride_id}
                    onClick={() => navigate(`/rides?rideId=${r.ride_id}`)}
                    className="flex items-center justify-between w-full bg-card rounded-xl px-3 py-2.5 border border-border hover:border-primary/30 transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-foreground truncate block">{r.ride_name}</span>
                      {r.reason && (
                        <span className="text-[10px] text-muted-foreground truncate block">{r.reason}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-right">
                      {r.changed_at && (
                        <div className="text-[10px] text-muted-foreground leading-tight">
                          <span>{format(new Date(r.changed_at), 'HH:mm')}</span>
                          {r.changed_by_name && (
                            <span className="block">{r.changed_by_name}</span>
                          )}
                        </div>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ALL RIDES TABLE VIEW ─────────── */}
      {!exceptionsOnly && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Ride</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground">Operating</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground">Checks</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground">Defects</th>
                  <th className="text-left px-2 py-2.5 font-semibold text-muted-foreground">Reason / Notes</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground">Last Activity</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRides.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No rides match filters</td></tr>
                )}
                {filteredRides.map((r) => (
                  <tr key={r.ride_id} className="border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-foreground">{r.ride_name}</td>
                    <td className="text-center px-2 py-2.5">
                      <Badge variant="outline" className={`text-[10px] ${r.is_operating ? 'border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30' : 'border-border text-muted-foreground'}`}>
                        {r.is_operating ? 'ON' : 'OFF'}
                      </Badge>
                    </td>
                    <td className="text-center px-2 py-2.5">
                      {!r.requires_checks ? (
                        <span className="text-muted-foreground">—</span>
                      ) : r.checks_done_today ? (
                        <Badge variant="outline" className="text-[10px] border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30">Done</Badge>
                      ) : r.is_operating ? (
                        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/20">Due</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-center px-2 py-2.5">
                      {r.open_critical > 0 && (
                        <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive mr-0.5">{r.open_critical} crit</Badge>
                      )}
                      {r.open_high > 0 && (
                        <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600">{r.open_high} high</Badge>
                      )}
                      {r.open_critical === 0 && r.open_high === 0 && <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-2 py-2.5 text-muted-foreground max-w-[200px] truncate">
                      {r.not_operating_reason || '—'}
                    </td>
                    <td className="text-center px-2 py-2.5 text-muted-foreground">
                      {r.last_activity ? format(new Date(r.last_activity), 'HH:mm') : '—'}
                    </td>
                    <td className="text-right px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => navigate(`/rides?rideId=${r.ride_id}`)}>View</Button>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => navigate(`/rides?rideId=${r.ride_id}&tab=checks`)}>Checks</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-border">
            {filteredRides.length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground">No rides match filters</div>
            )}
            {filteredRides.map((r) => (
              <button
                key={r.ride_id}
                onClick={() => navigate(`/rides?rideId=${r.ride_id}`)}
                className="w-full text-left px-4 py-3 hover:bg-muted/10 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground truncate">{r.ride_name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className={`text-[10px] ${r.is_operating ? 'border-green-300 text-green-700' : 'border-border text-muted-foreground'}`}>
                      {r.is_operating ? 'ON' : 'OFF'}
                    </Badge>
                    {r.open_critical > 0 && <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">{r.open_critical} crit</Badge>}
                    {r.is_operating && r.requires_checks && !r.checks_done_today && (
                      <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">Due</Badge>
                    )}
                  </div>
                </div>
                {r.not_operating_reason && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{r.not_operating_reason}</p>
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
