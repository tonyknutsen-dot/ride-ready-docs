import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  Bell, Check, X, AlertTriangle, Info, CheckCircle,
  FileText, Wrench, ClipboardCheck, Shield, Wind,
  CreditCard, ChevronRight, Clock, AlertOctagon,
  CircleDot, Send, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAppRole } from '@/hooks/useAppRole';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { formatDistanceToNow, isToday, isThisWeek, differenceInDays, parseISO } from 'date-fns';
import {
  getNotificationCategory,
  isNotificationActionable,
  type NotificationCategory,
} from '@/utils/notificationClassification';
import { isDefectCritical } from '@/hooks/useDefectSummary';
import { isMaintenanceOverdue, isMaintenanceNotificationWorthy } from '@/hooks/useMaintenanceSummary';
import { DEFECT_SEVERITY_CONFIG } from '@/utils/uiConstants';

/* ── Types ─────────────────────────────────────── */

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  related_table?: string;
  related_id?: string;
  created_at: string;
}

type FilterTab = 'all' | 'action' | 'compliance' | 'defects' | 'checks' | 'documents' | 'maintenance' | 'system';
type Category = NotificationCategory;

/* ── Classification helpers — delegates to shared module ── */

const getCategory = (n: Notification): Category => getNotificationCategory(n);

const isActionable = (n: Notification): boolean => isNotificationActionable(n);


const isSentDocument = (n: Notification): boolean => {
  const title = n.title?.toLowerCase() ?? '';
  return title.includes('sent') || title.includes('shared') || title.includes('document pack');
};

const isDefectRelatedNotification = (n: Notification): boolean => {
  const title = n.title?.toLowerCase() ?? '';
  const message = n.message?.toLowerCase() ?? '';
  const type = n.type?.toLowerCase() ?? '';

  if (n.related_table === 'defects') return true;
  if (title.includes('defect') || message.includes('defect')) return true;
  if (title.includes('stop use') || message.includes('stop use')) return true;
  if (title.includes('high-priority defect') || title.includes('unresolved defect')) return true;
  if (type === 'defect') return true;

  return false;
};

const buildDefectRoute = (defectId?: string | null): string => {
  if (defectId) return `/defects?defectId=${defectId}&status=open`;
  return '/defects?status=open';
};

const buildCheckRoute = (checkId?: string | null): string => {
  if (checkId) return `/checks?checkId=${checkId}`;
  return '/checks';
};

const getPriority = (n: Notification): number => {
  const title = n.title?.toLowerCase() ?? '';
  if (title.includes('stop use') || title.includes('critical')) return 0;
  if (title.includes('overdue') || title.includes('expired')) return 1;
  if (title.includes('failed check')) return 2;
  if (title.includes('missing') || title.includes('missed')) return 3;
  if (title.includes('high-priority defect') || title.includes('new defect')) return 4;
  if (title.includes('expiring') || title.includes('due soon') || title.includes('due in')) return 5;
  if (title.includes('wind') || title.includes('threshold')) return 6;
  if (title.includes('maintenance')) return 7;
  return 8;
};

const getBarColor = (n: Notification): string => {
  const cat = getCategory(n);
  if (isActionable(n)) {
    const title = n.title?.toLowerCase() ?? '';
    if (title.includes('stop use') || title.includes('critical') || title.includes('overdue') || title.includes('expired') || title.includes('failed')) return 'bg-destructive';
    if (title.includes('expiring') || title.includes('missed') || title.includes('warning') || title.includes('due')) return 'bg-accent-foreground/60';
    return 'bg-destructive';
  }
  switch (cat) {
    case 'compliance': return 'bg-destructive/50';
    case 'defects':    return 'bg-destructive/60';
    case 'checks':     return 'bg-primary/60';
    case 'documents':  return 'bg-primary/50';
    case 'maintenance': return 'bg-accent-foreground/50';
    default: return 'bg-muted-foreground/30';
  }
};

const getIcon = (n: Notification) => {
  const title = n.title?.toLowerCase() ?? '';
  const cls = 'h-[18px] w-[18px]';
  if (title.includes('stop use') || title.includes('critical')) return <AlertOctagon className={cn(cls, 'text-destructive')} />;
  if (title.includes('defect')) return <AlertTriangle className={cn(cls, 'text-destructive')} />;
  if (title.includes('wind') || title.includes('threshold') || title.includes('pack-away')) return <Wind className={cn(cls, 'text-primary')} />;
  if (title.includes('check') || title.includes('missed')) return <ClipboardCheck className={cn(cls, 'text-accent-foreground')} />;
  if (title.includes('inspection') || title.includes('ndt')) return <Shield className={cn(cls, 'text-primary')} />;
  if (title.includes('sent') || title.includes('shared') || title.includes('document pack')) return <Send className={cn(cls, 'text-primary')} />;
  if (title.includes('document') || title.includes('expir') || title.includes('certificate')) return <FileText className={cn(cls, 'text-primary')} />;
  if (title.includes('maintenance') || title.includes('repair')) return <Wrench className={cn(cls, 'text-accent-foreground')} />;
  if (title.includes('billing') || title.includes('plan') || title.includes('limit')) return <CreditCard className={cn(cls, 'text-accent-foreground')} />;
  if (title.includes('security') || title.includes('role')) return <Shield className={cn(cls, 'text-primary')} />;
  if (n.type === 'success') return <CheckCircle className={cn(cls, 'text-primary')} />;
  return <Info className={cn(cls, 'text-muted-foreground')} />;
};

const getActionRoute = (n: Notification): string | null => {
  const title = n.title?.toLowerCase() ?? '';
  if (isSentDocument(n)) return '/batch-send';

  // Hard routing rule: defect-like notifications go to Defects only
  if (isDefectRelatedNotification(n)) return buildDefectRoute(n.related_id);

  if (n.related_table === 'checks') return buildCheckRoute(n.related_id);
  if (title.includes('check') || title.includes('missed')) return '/checks';
  if (title.includes('inspection') || title.includes('ndt')) return '/compliance';
  if (n.related_table === 'documents' && n.related_id) return `/documents/${n.related_id}`;
  if (title.includes('document') || title.includes('expir') || title.includes('certificate')) {
    if (n.related_id) return `/documents/${n.related_id}`;
    return '/global-documents';
  }
  if (n.related_table === 'documents') return '/global-documents';
  if (title.includes('maintenance')) return '/maintenance';
  if (n.related_table === 'maintenance_records') return '/maintenance';
  if (title.includes('wind') || title.includes('threshold') || title.includes('pack-away')) return '/wind-log';
  if (title.includes('billing') || title.includes('plan') || title.includes('limit')) return '/plan-billing';
  if (title.includes('security') || title.includes('role')) return '/security';
  return null;
};

const getActionLabel = (n: Notification): string => {
  const title = n.title?.toLowerCase() ?? '';
  if (isSentDocument(n)) return 'View record';
  // Defect notifications — always say "defect"
  if (isDefectRelatedNotification(n)) {
    if (title.includes('linked defect')) return 'Open linked defect';
    if (title.includes('stop use')) return 'Review defect';
    if (title.includes('unresolved')) return 'Review defect';
    return 'View defect';
  }
  // Checks — always say "check", never ambiguous "Review"
  if (title.includes('check') && title.includes('missed')) return 'Start check';
  if (title.includes('check') && title.includes('failed')) return 'Review check';
  if (title.includes('check') && title.includes('completed')) return 'View check';
  if (n.related_table === 'checks') return 'View check';
  // Other categories
  if (title.includes('inspection') || title.includes('ndt')) return 'View';
  if (title.includes('expir') || title.includes('document') || title.includes('certificate')) return 'Review certificate';
  if (title.includes('maintenance') && (title.includes('overdue') || title.includes('due'))) return 'View';
  if (title.includes('maintenance') && title.includes('logged')) return 'View';
  if (title.includes('wind') || title.includes('threshold')) return 'View log';
  if (title.includes('billing') || title.includes('plan')) return 'Manage';
  return 'View';
};

/* ── Grouping ──────────────────────────────────── */

interface NotificationGroup {
  label: string;
  items: Notification[];
}

const groupNotifications = (items: Notification[]): NotificationGroup[] => {
  const actionNeeded: Notification[] = [];
  const recent: Notification[] = [];
  const older: Notification[] = [];

  items.forEach(n => {
    if (isActionable(n) && !n.is_read) {
      actionNeeded.push(n);
    } else {
      const d = new Date(n.created_at);
      if (isToday(d) || isThisWeek(d)) recent.push(n);
      else older.push(n);
    }
  });

  return [
    { label: 'Action needed', items: actionNeeded },
    { label: 'Recent updates', items: recent },
    { label: 'Older', items: older },
  ].filter(g => g.items.length > 0);
};

/* ── Filter tabs ───────────────────────────────── */

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',         label: 'All' },
  { id: 'action',      label: 'Action needed' },
  { id: 'compliance',  label: 'Compliance' },
  { id: 'defects',     label: 'Defects' },
  { id: 'checks',      label: 'Checks' },
  { id: 'documents',   label: 'Documents' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'system',      label: 'System' },
];

/* ── Dedup helper (title-based within 24h window) ─ */
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/* ── Component ─────────────────────────────────── */

const NotificationCenter = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { effectiveUserId } = useEffectiveUserId();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [linkedDefectByNotification, setLinkedDefectByNotification] = useState<Record<string, string>>({});
  const role = useAppRole();
  const isController = role === 'controller';

  useEffect(() => {
    if (user && effectiveUserId) {
      loadNotifications();
      generateComplianceNotifications();
    }
  }, [user, effectiveUserId]);

  useEffect(() => {
    const linkCheckNotificationsToDefects = async () => {
      // Gather both checks-table AND defects-table failed-check notifications
      const checkNotifications = notifications.filter(
        (n) => !!n.related_id && (
          n.related_table === 'checks' ||
          (n.related_table === 'defects' && (n.title || '').toLowerCase().includes('check failure'))
        )
      );

      if (checkNotifications.length === 0) {
        setLinkedDefectByNotification({});
        return;
      }

      const mapping: Record<string, string> = {};

      // ── Type A: notifications pointing directly at a defect (related_table='defects') ──
      const directDefectNotifications = checkNotifications.filter(n => n.related_table === 'defects');
      directDefectNotifications.forEach(n => {
        mapping[n.id] = n.related_id!;
        console.info('[Notifications] Direct defect link from notification', {
          notification_id: n.id, linked_defect_id: n.related_id,
        });
      });

      // ── Type B: notifications pointing at a check (related_table='checks') ──
      const checksTableNotifications = checkNotifications.filter(n => n.related_table === 'checks');
      if (checksTableNotifications.length > 0) {
        const checkIds = [...new Set(checksTableNotifications.map(n => n.related_id!))];

        // Step 1: try direct check_id match
        const { data: byCheckId } = await supabase
          .from('defects')
          .select('id, check_id, reported_at')
          .in('check_id', checkIds)
          .neq('status', 'resolved')
          .order('reported_at', { ascending: false });

        const defectByCheck = new Map<string, string>();
        (byCheckId || []).forEach((row: any) => {
          if (row.check_id && !defectByCheck.has(row.check_id)) {
            defectByCheck.set(row.check_id, row.id);
          }
        });

        // Step 2: for unmatched checks, look up the check's ride_id, then find defects by ride_id
        const unmatchedCheckIds = checkIds.filter(id => !defectByCheck.has(id));
        const defectByRide = new Map<string, string>();

        if (unmatchedCheckIds.length > 0) {
          const { data: checksData } = await supabase
            .from('checks')
            .select('id, ride_id')
            .in('id', unmatchedCheckIds);

          if (checksData && checksData.length > 0) {
            const rideIds = [...new Set(checksData.map(c => c.ride_id).filter(Boolean))];
            const checkToRide = new Map<string, string>();
            checksData.forEach(c => { if (c.ride_id) checkToRide.set(c.id, c.ride_id); });

            if (rideIds.length > 0) {
              const { data: byRide } = await supabase
                .from('defects')
                .select('id, ride_id, reported_at')
                .in('ride_id', rideIds)
                .neq('status', 'resolved')
                .order('reported_at', { ascending: false });

              (byRide || []).forEach((row: any) => {
                if (row.ride_id && !defectByRide.has(row.ride_id)) {
                  defectByRide.set(row.ride_id, row.id);
                }
              });
            }

            // Map unmatched checks via ride_id
            unmatchedCheckIds.forEach(checkId => {
              const rideId = checkToRide.get(checkId);
              if (rideId && defectByRide.has(rideId)) {
                defectByCheck.set(checkId, defectByRide.get(rideId)!);
              }
            });
          }
        }

        // Build final mapping for checks-table notifications
        checksTableNotifications.forEach((n) => {
          const defectId = defectByCheck.get(n.related_id!);
          if (defectId) {
            mapping[n.id] = defectId;
            console.info('[Notifications] Linked defect for check notification', {
              notification_id: n.id, check_id: n.related_id, linked_defect_id: defectId,
            });
          }
        });
      }

      console.info('[Notifications] Final linked defect mapping', mapping);
      setLinkedDefectByNotification(mapping);
    };

    void linkCheckNotificationsToDefects();
  }, [notifications]);

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setNotifications((data as Notification[]) || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast({ title: 'Error loading notifications', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  /** Idempotent notification creator — deduplicates by title within 24h */
  const ensureNotification = async (title: string, message: string, type: string, relatedTable?: string, relatedId?: string) => {
    try {
      const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user?.id)
        .eq('title', title)
        .gte('created_at', cutoff)
        .limit(1);
      if (existing && existing.length > 0) return;

      const row: any = { user_id: user?.id, title, message, type };
      if (relatedTable) row.related_table = relatedTable;
      if (relatedId) row.related_id = relatedId;
      await supabase.from('notifications').insert(row);
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  /** ── Compliance-driven notification generation ── */
  const generateComplianceNotifications = async () => {
    if (!effectiveUserId) return;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Helper for day labels
    const daysLabel = (d: number) => d === 1 ? '1 day' : `${d} days`;

    try {
      // ─── 1. Document expiries (30d, 14d, 7d, overdue) ───
      const { data: docsWithExpiry } = await supabase
        .from('documents')
        .select('id, document_name, expires_at, ride_id')
        .eq('user_id', effectiveUserId)
        .eq('is_latest_version', true)
        .eq('is_test_data', false)
        .not('expires_at', 'is', null);

      const { data: rides } = await supabase
        .from('rides')
        .select('id, ride_name')
        .eq('user_id', effectiveUserId);

      const rideMap = new Map((rides || []).map(r => [r.id, r.ride_name]));

      for (const doc of docsWithExpiry || []) {
        const expDate = parseISO(doc.expires_at!);
        const daysUntil = differenceInDays(expDate, today);
        const rideName = doc.ride_id ? rideMap.get(doc.ride_id) || '' : 'Global';

        if (daysUntil < 0) {
          await ensureNotification(
            `Document expired: ${doc.document_name}`,
            `${doc.document_name}${rideName ? ` (${rideName})` : ''} expired ${daysLabel(Math.abs(daysUntil))} ago. Renew immediately.`,
            'error', 'documents', doc.id
          );
        } else if (daysUntil <= 7) {
          await ensureNotification(
            `Document expiring in ${daysLabel(daysUntil)}`,
            `${doc.document_name}${rideName ? ` (${rideName})` : ''} expires in ${daysLabel(daysUntil)}.`,
            'warning', 'documents', doc.id
          );
        } else if (daysUntil <= 14) {
          await ensureNotification(
            `Document expiring in ${daysLabel(daysUntil)}`,
            `${doc.document_name}${rideName ? ` (${rideName})` : ''} expires in ${daysLabel(daysUntil)}.`,
            'warning', 'documents', doc.id
          );
        } else if (daysUntil <= 30) {
          await ensureNotification(
            `Document expiring soon: ${doc.document_name}`,
            `${doc.document_name}${rideName ? ` (${rideName})` : ''} expires in ${daysLabel(daysUntil)}.`,
            'info', 'documents', doc.id
          );
        }
      }

      // ─── 2. Compliance events / Inspections (30d, 14d, 7d, overdue) ───
      const { data: scheduledEvents } = await supabase
        .from('compliance_events')
        .select('id, event_name, due_date, ride_id, category, event_category')
        .eq('user_id', effectiveUserId)
        .eq('status', 'scheduled')
        .eq('event_category', 'regulatory');

      for (const evt of scheduledEvents || []) {
        const dueDate = parseISO(evt.due_date);
        const daysUntil = differenceInDays(dueDate, today);
        const rideName = evt.ride_id ? rideMap.get(evt.ride_id) || '' : '';

        if (daysUntil < 0) {
          await ensureNotification(
            `Inspection overdue: ${evt.event_name}`,
            `${evt.event_name}${rideName ? ` — ${rideName}` : ''} was due ${daysLabel(Math.abs(daysUntil))} ago.`,
            'error', 'compliance_events', evt.id
          );
        } else if (daysUntil <= 7) {
          await ensureNotification(
            `Inspection due in ${daysLabel(daysUntil)}`,
            `${evt.event_name}${rideName ? ` — ${rideName}` : ''} is due in ${daysLabel(daysUntil)}.`,
            'warning', 'compliance_events', evt.id
          );
        } else if (daysUntil <= 14) {
          await ensureNotification(
            `Inspection due in ${daysLabel(daysUntil)}`,
            `${evt.event_name}${rideName ? ` — ${rideName}` : ''} is due in ${daysLabel(daysUntil)}.`,
            'warning', 'compliance_events', evt.id
          );
        } else if (daysUntil <= 30) {
          await ensureNotification(
            `Inspection due soon: ${evt.event_name}`,
            `${evt.event_name}${rideName ? ` — ${rideName}` : ''} is due in ${daysLabel(daysUntil)}.`,
            'info', 'compliance_events', evt.id
          );
        }
      }

      // ─── 3. ALL open defects ───
      const { data: openDefects } = await supabase
        .from('defects')
        .select('id, description, severity, ride_id, reported_at, status')
        .eq('user_id', effectiveUserId)
        .eq('is_test_data', false)
        .neq('status', 'resolved');

      for (const d of openDefects || []) {
        const rideName = d.ride_id ? rideMap.get(d.ride_id) || '' : '';
        const daysOpen = differenceInDays(today, parseISO(d.reported_at));

        if (d.severity === 'stop_operation') {
          await ensureNotification(
            `Stop Use defect unresolved`,
            `${d.description.slice(0, 80)}${rideName ? ` — ${rideName}` : ''}. Open ${daysLabel(daysOpen)}.`,
            'error', 'defects', d.id
          );
        } else if (d.severity === 'urgent') {
          await ensureNotification(
            `High-priority defect unresolved`,
            `${d.description.slice(0, 80)}${rideName ? ` — ${rideName}` : ''}. Open ${daysLabel(daysOpen)}.`,
            'warning', 'defects', d.id
          );
        } else {
          // non_urgent and other severities still surfaced
          await ensureNotification(
            `Open defect: ${rideName || 'equipment'}`,
            `${d.description.slice(0, 80)}${rideName ? ` — ${rideName}` : ''}. Open ${daysLabel(daysOpen)}.`,
            'info', 'defects', d.id
          );
        }
      }

      // ─── 4. Maintenance — overdue/due-soon + recent activity ───
      const { data: maintenanceRecords } = await supabase
        .from('maintenance_records')
        .select('id, description, ride_id, next_maintenance_due, maintenance_date')
        .eq('user_id', effectiveUserId)
        .eq('is_test_data', false);

      for (const m of maintenanceRecords || []) {
        const rideName = m.ride_id ? rideMap.get(m.ride_id) || '' : '';

        // 4a. Overdue / due-soon (when next_maintenance_due is set)
        if (m.next_maintenance_due) {
          const dueDate = parseISO(m.next_maintenance_due);
          const daysUntil = differenceInDays(dueDate, today);

          if (daysUntil < 0) {
            await ensureNotification(
              `Maintenance overdue`,
              `${m.description.slice(0, 60)}${rideName ? ` — ${rideName}` : ''} was due ${daysLabel(Math.abs(daysUntil))} ago.`,
              'warning', 'maintenance_records', m.id
            );
          } else if (daysUntil <= 7) {
            await ensureNotification(
              `Maintenance due in ${daysLabel(daysUntil)}`,
              `${m.description.slice(0, 60)}${rideName ? ` — ${rideName}` : ''}.`,
              'info', 'maintenance_records', m.id
            );
          }
        }

        // 4b. Recent maintenance activity (logged within last 7 days) — confirmation
        if (m.maintenance_date) {
          const logDate = parseISO(m.maintenance_date);
          const daysAgo = differenceInDays(today, logDate);
          if (daysAgo >= 0 && daysAgo <= 7) {
            await ensureNotification(
              `Maintenance logged: ${rideName || 'equipment'}`,
              `${m.description.slice(0, 60)}${rideName ? ` — ${rideName}` : ''}. Logged ${daysAgo === 0 ? 'today' : daysLabel(daysAgo) + ' ago'}.`,
              'success', 'maintenance_records', m.id
            );
          }
        }
      }

      // ─── 5. Overdue / missed checks (pending checks with past date) ───
      const { data: overdueChecks } = await supabase
        .from('checks')
        .select('id, ride_id, check_date')
        .eq('user_id', effectiveUserId)
        .eq('status', 'pending')
        .eq('is_test_data', false)
        .lt('check_date', todayStr);

      if (overdueChecks && overdueChecks.length > 0) {
        // Group by ride to avoid spamming
        const byRide = new Map<string, number>();
        overdueChecks.forEach(c => byRide.set(c.ride_id, (byRide.get(c.ride_id) || 0) + 1));

        for (const [rideId, count] of byRide) {
          const rideName = rideMap.get(rideId) || 'Unknown';
          await ensureNotification(
            `Missed check: ${rideName}`,
            `${count} overdue check${count > 1 ? 's' : ''} for ${rideName} requiring attention.`,
            'warning', 'checks'
          );
        }
      }

      // ─── 6. Failed checks (today) — check for linked defects ───
      const { data: failedChecks } = await supabase
        .from('checks')
        .select('id, ride_id')
        .eq('user_id', effectiveUserId)
        .eq('check_date', todayStr)
        .eq('status', 'failed');

      for (const fc of failedChecks || []) {
        const rideName = fc.ride_id ? rideMap.get(fc.ride_id) || '' : '';

        // Check if this failed check has a linked open defect
        const { data: linkedDefect } = await supabase
          .from('defects')
          .select('id, severity')
          .eq('check_id', fc.id)
          .neq('status', 'resolved')
          .limit(1)
          .maybeSingle();

        if (linkedDefect?.id) {
          // Show as a linked-defect notification routed to defect register
          await ensureNotification(
            `Check failure linked defect: ${rideName || 'asset'}`,
            `A failed check for ${rideName || 'an asset'} has created an open defect. Review and close the defect.`,
            'warning', 'defects', linkedDefect.id
          );
        } else {
          // Pure checks notification — no defect link
          await ensureNotification(
            `Failed check: ${rideName || 'asset'}`,
            `A check for ${rideName || 'an asset'} failed today. Review the check result and take corrective action.`,
            'warning', 'checks', fc.id
          );
        }
      }

      // Done — reload notifications
      await loadNotifications();
    } catch (error) {
      console.error('Error generating compliance notifications:', error);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', user?.id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user?.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    toast({ title: 'All notifications marked as read' });
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id).eq('user_id', user?.id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  /* ── Derived data ─────────────────────── */

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);
  const actionCount = useMemo(() => notifications.filter(n => isActionable(n) && !n.is_read).length, [notifications]);

  const filtered = useMemo(() => {
    let list: Notification[];
    if (activeTab === 'all') list = notifications;
    else if (activeTab === 'action') list = notifications.filter(n => isActionable(n));
    else list = notifications.filter(n => getCategory(n) === activeTab);
    return [...list].sort((a, b) => getPriority(a) - getPriority(b));
  }, [notifications, activeTab]);

  const grouped = useMemo(() => groupNotifications(filtered), [filtered]);

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = { all: notifications.length, action: 0, compliance: 0, defects: 0, checks: 0, documents: 0, maintenance: 0, system: 0 };
    notifications.forEach(n => {
      const cat = getCategory(n);
      counts[cat] = (counts[cat] || 0) + 1;
      if (isActionable(n) && !n.is_read) counts.action++;
    });
    return counts;
  }, [notifications]);

  const resolveRouteForNotification = useCallback(async (n: Notification): Promise<{ route: string | null; reason: string }> => {
    // Checks notifications with a linked open defect must open defect close-out first
    if (n.related_table === 'checks') {
      const linkedDefectId = linkedDefectByNotification[n.id];
      if (linkedDefectId) {
        return {
          route: buildDefectRoute(linkedDefectId),
          reason: 'check_has_linked_open_defect',
        };
      }
      return { route: getActionRoute(n), reason: 'checks_primary_route' };
    }

    if (isDefectRelatedNotification(n)) {
      return { route: buildDefectRoute(n.related_id), reason: 'defect_indicators' };
    }

    if (n.related_id) {
      const { data: matchedDefect } = await supabase
        .from('defects')
        .select('id')
        .eq('id', n.related_id)
        .maybeSingle();

      if (matchedDefect?.id) {
        return { route: buildDefectRoute(matchedDefect.id), reason: 'related_id_maps_to_defect' };
      }
    }

    return { route: getActionRoute(n), reason: 'default_mapping' };
  }, [linkedDefectByNotification]);

  const handleNotificationNavigate = useCallback(async (n: Notification) => {
    const linkedDefectId = linkedDefectByNotification[n.id] || null;

    console.info('[Notifications] Clicked notification', {
      id: n.id,
      title: n.title,
      type: n.type,
      category: getCategory(n),
      related_table: n.related_table,
      related_id: n.related_id,
      linked_defect_id: linkedDefectId,
      is_read: n.is_read,
    });

    const { route, reason } = await resolveRouteForNotification(n);

    console.info('[Notifications] Generated route', {
      id: n.id,
      linked_defect_id: linkedDefectId,
      action_route: route,
      reason,
    });

    if (!route) return;

    if (!n.is_read && isController) {
      await markAsRead(n.id);
    }

    navigate(route);

    setTimeout(() => {
      console.info('[Notifications] Navigated', {
        id: n.id,
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
      });
    }, 0);
  }, [isController, linkedDefectByNotification, markAsRead, navigate, resolveRouteForNotification]);

  const handleCardAction = useCallback(async (n: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    await handleNotificationNavigate(n);
  }, [handleNotificationNavigate]);

  const handleOpenCheckFromNotification = useCallback(async (n: Notification, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!n.is_read && isController) {
      await markAsRead(n.id);
    }

    const route = buildCheckRoute(n.related_id);
    console.info('[Notifications] Open check from linked-defect card', {
      notification_id: n.id,
      check_id: n.related_id,
      action_route: route,
    });
    navigate(route);
  }, [isController, markAsRead, navigate]);

  const handleOpenLinkedDefect = useCallback(async (n: Notification, defectId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!n.is_read && isController) {
      await markAsRead(n.id);
    }

    const route = buildDefectRoute(defectId);
    console.info('[Notifications] Open linked defect action', {
      notification_id: n.id,
      linked_defect_id: defectId,
      action_route: route,
    });
    navigate(route);
  }, [isController, markAsRead, navigate]);

  /* ── Render ───────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* ── Summary strip ────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground leading-none">{unreadCount}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Unread</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card">
          <div className={cn(
            'flex items-center justify-center w-9 h-9 rounded-xl',
            actionCount > 0 ? 'bg-destructive/10' : 'bg-muted'
          )}>
            <AlertTriangle className={cn('h-4 w-4', actionCount > 0 ? 'text-destructive' : 'text-muted-foreground')} />
          </div>
          <div>
            <p className={cn('text-xl font-bold leading-none', actionCount > 0 ? 'text-destructive' : 'text-foreground')}>{actionCount}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Action needed</p>
          </div>
        </div>
      </div>

      {/* ── Filter tabs ──────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none">
      {FILTER_TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id];
          // Compute unread count for this tab
          const tabUnread = tab.id === 'all'
            ? unreadCount
            : tab.id === 'action'
              ? actionCount
              : notifications.filter(n => !n.is_read && getCategory(n) === tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0',
                isActive
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-accent',
                count === 0 && tab.id !== 'all' && tab.id !== 'action' && !isActive && 'opacity-60'
              )}
            >
              {tab.label}
              {tabUnread > 0 && (
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold',
                  tab.id === 'action' || isActive
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-primary/15 text-primary'
                )}>
                  {tabUnread}
                </span>
              )}
            </button>
          );
        })}

        {isController && unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all shrink-0"
          >
            <Check className="h-3 w-3" />
            Read all
          </button>
        )}
      </div>

      {/* ── Action-needed empty state (when tab = all and 0 actions) ── */}
      {activeTab === 'all' && actionCount === 0 && filtered.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <CheckCircle className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">No action needed right now</p>
            <p className="text-[11px] text-muted-foreground">{"You're up to date. Older updates are listed below."}</p>
          </div>
        </div>
      )}

      {/* ── Notification feed ────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-14 bg-card border border-border rounded-2xl">
          <Bell className="mx-auto h-9 w-9 text-muted-foreground/30 mb-2.5" />
          <p className="text-sm font-semibold text-foreground">
            {activeTab === 'action' ? 'No action needed' : 'No notifications'}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto">
            {activeTab === 'action'
              ? "You're up to date. Recent updates and older notifications are shown below."
              : 'Recent updates and older notifications will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Always show section headings for the 3 groups when on 'all' tab */}
          {(() => {
            // Ensure all three groups are always visible (even if empty) on the 'all' tab
            const allGroups = activeTab === 'all'
              ? (['Action needed', 'Recent updates', 'Older'] as const).map(label => {
                  const found = grouped.find(g => g.label === label);
                  return found || { label, items: [] as Notification[] };
                }).filter(g => g.items.length > 0 || g.label !== 'Older') // hide empty Older
              : grouped;

            return allGroups.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-2">
                {group.label === 'Action needed' && (
                  <CircleDot className="h-3 w-3 text-destructive" />
                )}
                <p className={cn(
                  'text-[11px] font-bold uppercase tracking-widest',
                  group.label === 'Action needed' ? 'text-destructive' : 'text-muted-foreground'
                )}>
                  {group.label}
                </p>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-medium">
                  {group.items.length}
                </Badge>
              </div>

              {group.items.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/60 pl-5 py-1">
                  {group.label === 'Action needed' ? 'Nothing needs attention' : 'No items'}
                </p>
              ) : (
              <div className="space-y-1.5">
                {group.items.map(n => {
                  const actionable = isActionable(n);
                  const sentDoc = isSentDocument(n);
                  const route = getActionRoute(n);
                  const linkedDefectId = linkedDefectByNotification[n.id];
                  const isFailedCheckRelated = getCategory(n) === 'checks' || n.related_table === 'checks' || (n.title || '').toLowerCase().includes('check failure') || (n.title || '').toLowerCase().includes('failed check');
                  const showLinkedDefectAction = Boolean(linkedDefectId) && isFailedCheckRelated;
                  const hasAction = route != null || !!n.related_id || showLinkedDefectAction;

                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (showLinkedDefectAction) return;
                        void handleNotificationNavigate(n);
                      }}
                      className={cn(
                        'flex bg-card border rounded-2xl overflow-hidden transition-all',
                        actionable && !n.is_read
                          ? 'border-destructive/20 shadow-[0_2px_8px_rgba(220,38,38,0.06)]'
                          : 'border-border',
                        !showLinkedDefectAction && hasAction && 'cursor-pointer hover:border-primary/30 active:scale-[0.995]',
                        !actionable && n.is_read && 'opacity-90'
                      )}
                    >
                      {/* Left colour bar */}
                      <div className={cn('w-1 shrink-0', getBarColor(n))} />

                      <div className="flex-1 flex items-start gap-3 p-3">
                        {/* Icon circle */}
                        <div className={cn(
                          'flex items-center justify-center w-8 h-8 rounded-xl shrink-0 mt-0.5',
                          actionable && !n.is_read ? 'bg-destructive/10' : 'bg-muted'
                        )}>
                          {getIcon(n)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-semibold leading-tight truncate text-foreground">
                              {n.title}
                            </p>
                            {!n.is_read && (
                              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                            )}
                          </div>

                          <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                            {n.message}
                          </p>

                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                            </span>

                            {actionable && !n.is_read && (
                              <Badge
                                variant="destructive"
                                className="text-[9px] h-4 px-1.5 font-semibold"
                              >
                                Action needed
                              </Badge>
                            )}

                            {showLinkedDefectAction && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-semibold">
                                Linked defect
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Right side: action button or controls */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {showLinkedDefectAction ? (
                            <>
                              <button
                                onClick={(e) => handleOpenCheckFromNotification(n, e)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all bg-muted text-foreground hover:bg-accent"
                              >
                                Review check
                                <ChevronRight className="h-3 w-3" />
                              </button>
                              <button
                                onClick={(e) => handleOpenLinkedDefect(n, linkedDefectId!, e)}
                                className={cn(
                                  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
                                  actionable && !n.is_read
                                    ? 'bg-foreground text-background hover:bg-foreground/90'
                                    : 'bg-muted text-foreground hover:bg-accent'
                                )}
                              >
                                Open linked defect
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            </>
                          ) : hasAction && (
                            <button
                              onClick={(e) => handleCardAction(n, e)}
                              className={cn(
                                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
                                actionable && !n.is_read
                                  ? 'bg-foreground text-background hover:bg-foreground/90'
                                  : 'bg-muted text-foreground hover:bg-accent'
                              )}
                            >
                              {getActionLabel(n)}
                              {sentDoc && !actionable ? <ExternalLink className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </button>
                          )}


                          {isController && getCategory(n) === 'system' && (
                            <button
                              onClick={e => { e.stopPropagation(); deleteNotification(n.id); }}
                              className="p-1 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-all"
                              title="Dismiss"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          ));
          })()}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
