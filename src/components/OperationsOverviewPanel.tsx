import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertOctagon, PauseCircle, PlayCircle, ChevronRight,
  AlertTriangle, CheckSquare, Search, Filter, ShieldAlert,
  Clock, CheckCircle, Eye, HelpCircle, Info, X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useOperationsOverview } from '@/hooks/useOperationsOverview';
import { format } from 'date-fns';

type ActiveKpiFilter = 'all' | 'operating' | 'not_operating' | 'checks_outstanding' | 'critical' | 'high';

/* ── Tooltip text constants ─────────────── */
const KPI_TOOLTIPS: Record<string, string> = {
  operating: 'Rides marked as in use today.',
  not_operating: 'Rides not in use today (with reason if provided).',
  checks_outstanding: 'Rides in use that still require a pre-opening/daily check today.',
  critical: 'Count of rides with open critical/stop-operation defects.',
  high: 'Count of rides with open high-severity defects.',
  checks_done: 'Completed checks today compared with checks currently due.',
};

/* ── Small inline tooltip helper ─────────── */
const KpiTooltip = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="inline-flex items-center justify-center" aria-label="More info">
        <Info className="h-2.5 w-2.5 text-muted-foreground/60" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-[220px] text-xs font-normal">
      {text}
    </TooltipContent>
  </Tooltip>
);

/* ── Help panel content ──────────────────── */
const DashboardHelpPanel = ({ onClose }: { onClose: () => void }) => (
  <div className="rounded-2xl border border-border bg-card p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Dashboard Guide</span>
      </div>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose} aria-label="Close help">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>

    <p className="text-xs text-muted-foreground leading-relaxed">
      This is your <span className="font-medium text-foreground">exceptions-first operations overview</span>. It surfaces issues that need attention so you can run the day without opening each ride individually.
    </p>

    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-foreground">Exceptions Only</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        When ON (default), only rides needing attention are shown: critical defects, outstanding checks, and rides not in use. Toggle OFF to see all rides.
      </p>
    </div>

    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-foreground">KPI Cards</p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li className="flex gap-1.5"><PlayCircle className="h-3 w-3 text-green-600 mt-0.5 shrink-0" /> <span><span className="font-medium text-foreground">In Use</span> — rides marked in use today.</span></li>
        <li className="flex gap-1.5"><PauseCircle className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" /> <span><span className="font-medium text-foreground">Not In Use</span> — rides not running, with reason if provided.</span></li>
        <li className="flex gap-1.5"><AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" /> <span><span className="font-medium text-foreground">Checks Due</span> — rides in use still needing a check today.</span></li>
        <li className="flex gap-1.5"><AlertOctagon className="h-3 w-3 text-destructive mt-0.5 shrink-0" /> <span><span className="font-medium text-foreground">Critical</span> — rides with open stop-operation defects.</span></li>
        <li className="flex gap-1.5"><ShieldAlert className="h-3 w-3 text-orange-600 mt-0.5 shrink-0" /> <span><span className="font-medium text-foreground">High</span> — rides with open high-severity defects.</span></li>
        <li className="flex gap-1.5"><CheckSquare className="h-3 w-3 text-primary mt-0.5 shrink-0" /> <span><span className="font-medium text-foreground">Checks Done</span> — checks completed today vs checks due.</span></li>
      </ul>
    </div>

    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-foreground">Priority Sections</p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li><span className="font-medium text-destructive">Red</span> — Critical defects requiring immediate action.</li>
        <li><span className="font-medium text-amber-600">Amber</span> — Rides in use with checks still outstanding.</li>
        <li><span className="font-medium text-muted-foreground">Grey</span> — Rides not in use (informational).</li>
      </ul>
    </div>

    <p className="text-[10px] text-muted-foreground italic">
      Tap any KPI card to filter the list below. Tap again to clear the filter.
    </p>
  </div>
);

/* ── Checks Done display helper ──────────── */
const ChecksDoneDisplay = ({ completed, due }: { completed: number; due: number }) => {
  if (due === 0 && completed === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (due === 0 && completed > 0) {
    return (
      <span>
        <span className="text-green-600 font-bold">{completed}</span>
        <span className="text-[9px] text-muted-foreground block leading-tight">done (none due)</span>
      </span>
    );
  }
  const allDone = completed >= due;
  return (
    <span>
      <span className={allDone ? 'text-green-600 font-bold' : 'text-primary font-bold'}>{completed}</span>
      <span className="text-muted-foreground font-normal">/{due}</span>
    </span>
  );
};

const OperationsOverviewPanel = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useOperationsOverview();
  const [exceptionsOnly, setExceptionsOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [kpiFilter, setKpiFilter] = useState<ActiveKpiFilter>('all');
  const [showHelp, setShowHelp] = useState(false);

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
    <TooltipProvider delayDuration={300}>
      <div className="space-y-5">
        {/* Section header with help icon */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[13px] font-bold text-foreground tracking-[1px] uppercase">Operations Today</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowHelp(v => !v)}
                  aria-label="Dashboard help"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">Dashboard guide</TooltipContent>
            </Tooltip>
          </div>
          <div className="h-px bg-border" />
        </div>

        {/* Help panel */}
        {showHelp && <DashboardHelpPanel onClose={() => setShowHelp(false)} />}

        {/* KPI strip */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {([
            { key: 'operating' as const, label: 'In Use', value: data.operatingCount, icon: PlayCircle, accent: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30', borderActive: 'border-green-400', tooltip: KPI_TOOLTIPS.operating },
            { key: 'not_operating' as const, label: 'Not In Use', value: data.notOperatingCount, icon: PauseCircle, accent: 'text-muted-foreground', bg: 'bg-muted/40', borderActive: 'border-muted-foreground', tooltip: KPI_TOOLTIPS.not_operating },
            { key: 'checks_outstanding' as const, label: 'Checks Due', value: data.operatingWithChecksOutstanding, icon: AlertTriangle, accent: data.operatingWithChecksOutstanding > 0 ? 'text-amber-600' : 'text-muted-foreground', bg: data.operatingWithChecksOutstanding > 0 ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-muted/40', borderActive: 'border-amber-400', tooltip: KPI_TOOLTIPS.checks_outstanding },
            { key: 'critical' as const, label: 'Critical', value: data.openCriticalDefects.length, icon: AlertOctagon, accent: data.openCriticalDefects.length > 0 ? 'text-destructive' : 'text-muted-foreground', bg: data.openCriticalDefects.length > 0 ? 'bg-destructive/5' : 'bg-muted/40', borderActive: 'border-destructive', tooltip: KPI_TOOLTIPS.critical },
            { key: 'high' as const, label: 'High', value: data.openHighDefects, icon: ShieldAlert, accent: data.openHighDefects > 0 ? 'text-orange-600' : 'text-muted-foreground', bg: data.openHighDefects > 0 ? 'bg-orange-50 dark:bg-orange-950/20' : 'bg-muted/40', borderActive: 'border-orange-400', tooltip: KPI_TOOLTIPS.high },
          ]).map(({ key, label, value, icon: Icon, accent, bg, borderActive, tooltip }) => (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleKpiClick(key)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                    kpiFilter === key ? `${borderActive} border-2 shadow-sm` : 'border-border'
                  } ${bg} cursor-pointer hover:border-primary/40 active:scale-[0.97]`}
                >
                  <Icon className={`h-3.5 w-3.5 ${accent}`} strokeWidth={2} />
                  <span className={`text-lg font-bold leading-none ${accent}`}>{value}</span>
                  <span className="text-[9px] font-medium text-muted-foreground text-center leading-tight">{label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs font-normal">{tooltip}</TooltipContent>
            </Tooltip>
          ))}

          {/* Checks Done KPI — separate for custom display */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all border-border bg-primary/5 cursor-default`}
              >
                <CheckSquare className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                <div className="text-lg font-bold leading-none text-primary">
                  <ChecksDoneDisplay completed={data.preOpeningCompletedToday} due={data.preOpeningDueToday} />
                </div>
                <span className="text-[9px] font-medium text-muted-foreground text-center leading-tight">Checks Done</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px] text-xs font-normal">
              {data.preOpeningDueToday === 0 && data.preOpeningCompletedToday === 0
                ? 'No routine checks recorded today.'
                : data.preOpeningDueToday === 0
                  ? `${data.preOpeningCompletedToday} check(s) completed today.`
                  : `${data.preOpeningCompletedToday} of ${data.preOpeningDueToday} routine checks completed today.`}
            </TooltipContent>
          </Tooltip>
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
            <KpiTooltip text="Shows only rides needing attention (critical defects, checks outstanding, and not operating rides)." />
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
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-4 py-6 text-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-foreground">No exceptions requiring attention</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All operating rides have completed checks. No critical defects open.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 mt-1"
                  onClick={() => setExceptionsOnly(false)}
                >
                  <Eye className="h-3 w-3" /> Show all rides
                </Button>
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
    </TooltipProvider>
  );
};

export default OperationsOverviewPanel;
