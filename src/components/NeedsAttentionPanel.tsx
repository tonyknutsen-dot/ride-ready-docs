import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, FileText, ClipboardCheck, Clock, CheckCircle, ChevronRight, ChevronDown, Gauge } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { isDocExpired, daysUntilExpiry, getExpiryLabel } from '@/utils/documentHelpers';
import { isOverdue, daysUntil } from '@/utils/complianceCounts';
import { isDefectCritical } from '@/hooks/useDefectSummary';

interface AttentionItem {
  id: string;
  type: 'stop_use' | 'doc_expiring' | 'check_due' | 'inspection_due' | 'pressure_failed';
  label: string;
  sublabel?: string;
  urgency: 'critical' | 'warning' | 'info';
  path?: string;
}

interface AttentionGroup {
  type: AttentionItem['type'];
  title: string;
  icon: typeof AlertOctagon;
  items: AttentionItem[];
  defaultOpen: boolean;
  headerStyle: { bg: string; border: string; iconColor: string; text: string };
}

const INITIAL_VISIBLE = 5;

const NeedsAttentionPanel = () => {
  const navigate = useNavigate();
  const { effectiveUserId } = useEffectiveUserId();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['needs-attention', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const thirtyDaysStr = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      const [defectsRes, docsRes, eventsRes, operatingRes, checksRes, pressureRes] = await Promise.all([
        supabase
          .from('defects')
          .select('id, description, ride_id, rides(ride_name)')
          .eq('severity', 'stop_operation')
          .neq('status', 'resolved')
          .order('reported_at', { ascending: false })
          .limit(50),
        supabase
          .from('documents')
          .select('id, document_name, expires_at, ride_id, rides(ride_name)')
          .eq('user_id', effectiveUserId)
          .eq('is_latest_version', true)
          .not('expires_at', 'is', null)
          .lte('expires_at', thirtyDaysStr)
          .order('expires_at', { ascending: true })
          .limit(50),
        supabase
          .from('compliance_events')
          .select('id, event_name, due_date, ride_id, event_type, category, rides(ride_name)')
          .eq('user_id', effectiveUserId)
          .in('status', ['scheduled', 'open'])
          .lte('due_date', thirtyDaysStr)
          .order('due_date', { ascending: true })
          .limit(50),
        // Fetch which rides are in use today
        supabase
          .from('ride_daily_status' as any)
          .select('ride_id')
          .eq('status_date', todayStr)
          .eq('is_operating', true) as any,
        // Fetch today's completed checks (daily or preopening) to know if operational check was done
        supabase
          .from('checks')
          .select('ride_id, check_frequency')
          .eq('user_id', effectiveUserId)
          .eq('check_date', todayStr)
          .in('check_frequency', ['daily', 'preopening']),
        // Fetch recent pressure sessions that are out of range (last 7 days)
        supabase
          .from('pressure_sessions')
          .select('id, ride_id, session_date, session_time, is_complete, rides(ride_name)')
          .eq('user_id', effectiveUserId)
          .gte('session_date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
          .order('session_date', { ascending: false })
          .limit(100),
      ]);

      // Build set of rides operating today
      const operatingRideIds = new Set<string>(
        (operatingRes.data || []).map((r: any) => r.ride_id)
      );

      // Build set of rides that have completed any operational check today
      const operationalCheckDoneTodayIds = new Set<string>(
        (checksRes.data || []).map((c: any) => c.ride_id)
      );

      const result: AttentionItem[] = [];

      (defectsRes.data || []).forEach((d: any) => {
        result.push({
          id: `defect-${d.id}`,
          type: 'stop_use',
          label: d.rides?.ride_name || 'Equipment',
          sublabel: d.description?.substring(0, 80),
          urgency: 'critical',
          path: d.ride_id ? `/defects?rideId=${d.ride_id}&severity=stop_operation&defectId=${d.id}` : '/defects?severity=stop_operation',
        });
      });

      (docsRes.data || []).forEach((doc: any) => {
        const expired = isDocExpired(doc.expires_at);
        const days = daysUntilExpiry(doc.expires_at);
        const dateLabel = expired
          ? `Expired ${Math.abs(days)}d ago`
          : days === 0 ? 'Expires today'
          : days === 1 ? 'Expires tomorrow'
          : `Expires in ${days}d`;
        result.push({
          id: `doc-${doc.id}`,
          type: 'doc_expiring',
          label: doc.document_name,
          sublabel: `${dateLabel}${doc.rides?.ride_name ? ` • ${doc.rides.ride_name}` : ''}`,
          urgency: expired || days <= 7 ? 'warning' : 'info',
          path: doc.ride_id ? `/rides/${doc.ride_id}?tab=documents` : '/documents',
        });
      });

      (eventsRes.data || []).forEach((evt: any) => {
        const evtType = (evt.event_type as string) || '';
        const evtCategory = (evt.category as string) || '';
        const isOperationalCheck = evtType === 'daily_check' || evtType === 'pre_opening_check';

        // ── Showmen logic: daily/pre-opening checks are same-day reminders only ──
        // Skip operational checks from past days (don't accumulate overdue)
        // Skip operational checks for today if the ride is NOT currently in use
        // Skip if an operational check was already completed today for this ride
        if (isOperationalCheck) {
          if (evt.due_date !== todayStr) return; // past-day → skip entirely
          if (evt.ride_id && !operatingRideIds.has(evt.ride_id)) return; // not in use → skip
          if (evt.ride_id && operationalCheckDoneTodayIds.has(evt.ride_id)) return; // already checked today
        }

        const evtOverdue = isOverdue(evt.due_date);
        const evtDaysUntil = daysUntil(evt.due_date);
        const dateLabel = isOperationalCheck
          ? 'Ready to complete'
          : evtOverdue
            ? `${Math.abs(evtDaysUntil)}d overdue`
            : evtDaysUntil === 0 ? 'Due today'
            : evtDaysUntil === 1 ? 'Due tomorrow'
            : `Due in ${evtDaysUntil}d`;

        let path = '/calendar';
        if (evtType === 'pre_opening_check' || evtType === 'daily_check') {
          path = evt.ride_id ? `/checks/${evt.ride_id}/daily/execute` : '/checks';
        } else if (evtType === 'ndt') {
          path = evt.ride_id ? `/rides/${evt.ride_id}?tab=checks&checksSubTab=ndt` : '/calendar';
        } else if (evtCategory === 'inspection' || evtType === 'in-service' || evtType === 'electrical') {
          path = evt.ride_id ? `/rides/${evt.ride_id}?tab=checks&checksSubTab=annual` : '/calendar';
        } else if (evtCategory === 'doc_expiry') {
          path = evt.ride_id ? `/rides/${evt.ride_id}?tab=documents&eventId=${evt.id}` : '/documents';
        } else if (evt.ride_id) {
          path = `/rides/${evt.ride_id}?tab=overview`;
        }

        const rideName = (evt as any).rides?.ride_name;
        result.push({
          id: `event-${evt.id}`,
          type: isOperationalCheck ? 'check_due' : 'inspection_due',
          label: evt.event_name,
          sublabel: `${dateLabel}${rideName ? ` • ${rideName}` : ''}`,
          urgency: evtOverdue ? 'warning' : 'info',
          path,
        });
      });

      // Pressure out-of-range sessions
      // We need to check session lines against ride limits — fetch lines for recent sessions
      const pressureSessions = (pressureRes.data || []) as any[];
      if (pressureSessions.length > 0) {
        const sessionIds = pressureSessions.map((s: any) => s.id);
        // Fetch lines in chunks
        const allLines: any[] = [];
        for (let i = 0; i < sessionIds.length; i += 100) {
          const chunk = sessionIds.slice(i, i + 100);
          const { data: lineData } = await supabase
            .from('pressure_session_lines')
            .select('session_id, pressure_value')
            .in('session_id', chunk);
          if (lineData) allLines.push(...lineData);
        }
        // Fetch ride configs for these rides
        const rideIds = [...new Set(pressureSessions.map((s: any) => s.ride_id))];
        const { data: rideConfigs } = await supabase
          .from('rides')
          .select('id, section_config')
          .in('id', rideIds);
        const rideConfigMap = new Map((rideConfigs || []).map((r: any) => [r.id, (r.section_config || []) as Array<{ min_pressure?: number; max_pressure?: number }>]));

        const linesBySession: Record<string, any[]> = {};
        for (const l of allLines) {
          if (!linesBySession[l.session_id]) linesBySession[l.session_id] = [];
          linesBySession[l.session_id].push(l);
        }

        for (const s of pressureSessions) {
          const sLines = linesBySession[s.id] || [];
          const config = rideConfigMap.get(s.ride_id) || [];
          if (config.length === 0) continue;
          const hasOutOfRange = sLines.some((l: any, idx: number) => {
            const sc = config[idx];
            if (!sc || l.pressure_value == null) return false;
            if (sc.min_pressure != null && l.pressure_value < sc.min_pressure) return true;
            if (sc.max_pressure != null && l.pressure_value > sc.max_pressure) return true;
            return false;
          });
          if (hasOutOfRange) {
            result.push({
              id: `pressure-${s.id}`,
              type: 'pressure_failed',
              label: `Pressure — ${(s as any).rides?.ride_name || 'Equipment'}`,
              sublabel: `Out of range · ${s.session_date}`,
              urgency: 'warning',
              path: `/pressure-readings/register?rideId=${s.ride_id}`,
            });
          }
        }
      }

      return result;
    },
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
  });

  // Group items by type
  const groups: AttentionGroup[] = useMemo(() => {
    const groupDefs: { type: AttentionItem['type']; title: string; icon: typeof AlertOctagon; defaultOpen: boolean; headerStyle: AttentionGroup['headerStyle'] }[] = [
      {
        type: 'stop_use',
        title: 'Stop Use Defects',
        icon: AlertOctagon,
        defaultOpen: true,
        headerStyle: { bg: 'bg-destructive/5', border: 'border-destructive/30', iconColor: 'text-destructive', text: 'text-destructive' },
      },
      {
        type: 'check_due',
        title: 'Routine Checks',
        icon: ClipboardCheck,
        defaultOpen: false,
        headerStyle: { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800', iconColor: 'text-amber-600', text: 'text-foreground' },
      },
      {
        type: 'doc_expiring',
        title: 'Documents Expiring',
        icon: FileText,
        defaultOpen: false,
        headerStyle: { bg: 'bg-card', border: 'border-border', iconColor: 'text-muted-foreground', text: 'text-foreground' },
      },
      {
        type: 'inspection_due',
        title: 'Inspections Due',
        icon: Clock,
        defaultOpen: false,
        headerStyle: { bg: 'bg-card', border: 'border-border', iconColor: 'text-muted-foreground', text: 'text-foreground' },
      },
    ];

    return groupDefs
      .map((def) => ({
        ...def,
        items: items.filter((i) => i.type === def.type),
      }))
      .filter((g) => g.items.length > 0);
  }, [items]);

  if (isLoading) return null;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-4 py-6 text-center">
        <CheckCircle className="h-6 w-6 text-success" />
        <p className="text-sm font-semibold text-foreground">All clear — nothing needs attention</p>
        <p className="text-xs text-muted-foreground">No outstanding items, expiring documents, or open defects.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-foreground tracking-[1px] uppercase">Needs Attention</h2>
        <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="h-px bg-border" />

      <div className="space-y-3">
        {groups.map((group) => (
          <AttentionGroupSection key={group.type} group={group} navigate={navigate} />
        ))}
      </div>
    </div>
  );
};

/* ── Group Section ── */

const AttentionGroupSection = ({
  group,
  navigate,
}: {
  group: AttentionGroup;
  navigate: ReturnType<typeof useNavigate>;
}) => {
  const [open, setOpen] = useState(group.defaultOpen);
  const [showAll, setShowAll] = useState(false);
  const Icon = group.icon;
  const hasMore = group.items.length > INITIAL_VISIBLE;
  const visibleItems = showAll ? group.items : group.items.slice(0, INITIAL_VISIBLE);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${group.headerStyle.border} ${group.headerStyle.bg} transition-colors`}>
          <Icon className={`h-4 w-4 shrink-0 ${group.headerStyle.iconColor}`} />
          <span className={`text-sm font-semibold flex-1 text-left ${group.headerStyle.text}`}>
            {group.title}
          </span>
          <span className={`text-xs font-bold tabular-nums ${group.headerStyle.iconColor}`}>
            {group.items.length}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-1.5 pt-1.5">
          {visibleItems.map((item) => (
            <AttentionItemRow key={item.id} item={item} navigate={navigate} />
          ))}

          {hasMore && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full text-center py-1.5 text-xs font-medium text-primary hover:underline"
            >
              Show all {group.items.length} items
            </button>
          )}
          {hasMore && showAll && (
            <button
              onClick={() => setShowAll(false)}
              className="w-full text-center py-1.5 text-xs font-medium text-muted-foreground hover:underline"
            >
              Show fewer
            </button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

/* ── Single Item Row ── */

const AttentionItemRow = ({
  item,
  navigate,
}: {
  item: AttentionItem;
  navigate: ReturnType<typeof useNavigate>;
}) => {
  const rowStyle =
    item.type === 'stop_use'
      ? 'bg-destructive/5 border-destructive/20'
      : item.urgency === 'warning'
      ? 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/60 dark:border-amber-800/40'
      : 'bg-card border-border';

  return (
    <button
      onClick={() => item.path && navigate(item.path)}
      className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg border ${rowStyle} hover:shadow-sm transition-all active:scale-[0.98]`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
        {item.sublabel && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.sublabel}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
    </button>
  );
};

export default NeedsAttentionPanel;
