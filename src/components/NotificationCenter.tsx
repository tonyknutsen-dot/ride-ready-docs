import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  Bell, Check, X, AlertTriangle, Info, CheckCircle,
  FileText, Wrench, ClipboardCheck, Shield, Wind,
  CreditCard, ChevronRight, Clock, AlertOctagon,
  Send, Gauge, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAppRole } from '@/hooks/useAppRole';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { formatDistanceToNow, differenceInDays, parseISO } from 'date-fns';
import {
  getNotificationCategory,
  isNotificationActionable,
  type NotificationCategory,
} from '@/utils/notificationClassification';
import { isDefectCritical } from '@/hooks/useDefectSummary';

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

type DomainTab = 'all' | 'defects' | 'compliance' | 'checks' | 'documents' | 'maintenance';

/* ── Classification helpers ── */

const getCategory = (n: Notification): NotificationCategory => getNotificationCategory(n);
const isActionable = (n: Notification): boolean => isNotificationActionable(n);

const isUrgent = (n: Notification): boolean => {
  const title = n.title?.toLowerCase() ?? '';
  if (title.includes('stop use') || title.includes('critical')) return true;
  if (title.includes('overdue') || title.includes('expired')) return true;
  if (title.includes('failed check') || title.includes('check failure')) return true;
  return false;
};

const isSentDocument = (n: Notification): boolean => {
  const title = n.title?.toLowerCase() ?? '';
  return title.includes('sent') || title.includes('shared') || title.includes('document pack');
};

const isDefectRelatedNotification = (n: Notification): boolean => {
  const title = n.title?.toLowerCase() ?? '';
  if (n.related_table === 'defects') return true;
  if (title.includes('defect') || title.includes('stop use')) return true;
  return false;
};

/* ── Routing helpers ── */

const buildDefectRoute = (defectId?: string | null): string =>
  defectId ? `/defects?defectId=${defectId}&status=open` : '/defects?status=open';

const buildCheckRoute = (checkId?: string | null): string =>
  checkId ? `/checks?checkId=${checkId}` : '/checks';

const getActionRoute = (n: Notification): string | null => {
  const title = n.title?.toLowerCase() ?? '';
  if (isSentDocument(n)) return '/batch-send';
  if (n.related_table === 'pressure_sessions' || title.includes('pressure')) return '/pressure-readings';
  if (isDefectRelatedNotification(n)) return buildDefectRoute(n.related_id);
  if (n.related_table === 'checks') return buildCheckRoute(n.related_id);
  if (title.includes('check') || title.includes('missed')) return '/checks';
  if (title.includes('inspection') || title.includes('ndt')) return '/compliance';
  if (n.related_table === 'documents' && n.related_id) return `/documents/${n.related_id}`;
  if (title.includes('document') || title.includes('expir') || title.includes('certificate')) {
    return n.related_id ? `/documents/${n.related_id}` : '/global-documents';
  }
  if (n.related_table === 'documents') return '/global-documents';
  if (title.includes('maintenance') || n.related_table === 'maintenance_records') return '/maintenance';
  if (title.includes('wind') || title.includes('threshold') || title.includes('pack-away')) return '/wind-log';
  if (title.includes('billing') || title.includes('plan') || title.includes('limit')) return '/billing';
  return null;
};

const getActionLabel = (n: Notification): string => {
  const title = n.title?.toLowerCase() ?? '';
  if (isSentDocument(n)) return 'View';
  if (isDefectRelatedNotification(n)) return 'Review';
  if (title.includes('check')) return 'View';
  if (title.includes('pressure')) return 'Review';
  if (title.includes('inspection') || title.includes('ndt')) return 'View';
  if (title.includes('expir') || title.includes('document') || title.includes('certificate')) return 'Review';
  if (title.includes('maintenance')) return 'View';
  if (title.includes('billing') || title.includes('plan')) return 'Manage';
  return 'View';
};

const getIcon = (n: Notification) => {
  const title = n.title?.toLowerCase() ?? '';
  const cls = 'h-3.5 w-3.5';
  if (title.includes('stop use') || title.includes('critical')) return <AlertOctagon className={cn(cls, 'text-destructive')} />;
  if (title.includes('defect')) return <AlertTriangle className={cn(cls, 'text-destructive')} />;
  if (title.includes('pressure')) return <Gauge className={cn(cls, 'text-destructive')} />;
  if (title.includes('wind') || title.includes('threshold')) return <Wind className={cn(cls, 'text-primary')} />;
  if (title.includes('check') || title.includes('missed')) return <ClipboardCheck className={cn(cls, 'text-accent-foreground')} />;
  if (title.includes('inspection') || title.includes('ndt')) return <Shield className={cn(cls, 'text-primary')} />;
  if (title.includes('sent') || title.includes('shared')) return <Send className={cn(cls, 'text-primary')} />;
  if (title.includes('document') || title.includes('expir') || title.includes('certificate')) return <FileText className={cn(cls, 'text-primary')} />;
  if (title.includes('maintenance') || title.includes('repair')) return <Wrench className={cn(cls, 'text-accent-foreground')} />;
  if (title.includes('billing') || title.includes('plan')) return <CreditCard className={cn(cls, 'text-accent-foreground')} />;
  if (n.type === 'success') return <CheckCircle className={cn(cls, 'text-primary')} />;
  return <Info className={cn(cls, 'text-muted-foreground')} />;
};

/** Extract equipment name from the message (appears after " — ") */
const extractEquipmentName = (message?: string): string | null => {
  if (!message) return null;
  const dashMatch = message.match(/\s[—–-]\s(.+?)(?:\.|$)/);
  if (dashMatch) {
    const name = dashMatch[1].trim().replace(/\.$/, '');
    if (name.length > 0 && name.length < 40 && !name.includes('expired') && !name.includes('overdue')) {
      return name;
    }
  }
  return null;
};

/** Format a compact time string */
const compactTime = (dateStr: string): string => {
  const str = formatDistanceToNow(new Date(dateStr), { addSuffix: false });
  return str
    .replace(' minutes', 'm').replace(' minute', 'm')
    .replace(' hours', 'h').replace(' hour', 'h')
    .replace(' days', 'd').replace(' day', 'd')
    .replace('about ', '~')
    .replace('less than a', '<1')
    .replace('over ', '>');
};

/* ── Dedup window ── */
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/* ── Domain tab config ── */
const DOMAIN_TABS: { id: DomainTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'defects', label: 'Defects' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'checks', label: 'Checks' },
  { id: 'documents', label: 'Docs' },
  { id: 'maintenance', label: 'Maint.' },
];

/* ── Component ─────────────────────────────────── */

const NotificationCenter = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { effectiveUserId } = useEffectiveUserId();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainTab, setDomainTab] = useState<DomainTab>('all');
  const [showOlder, setShowOlder] = useState(false);
  const role = useAppRole();
  const isController = role === 'controller';

  useEffect(() => {
    if (user && effectiveUserId) {
      loadNotifications();
      generateComplianceNotifications();
    }
  }, [user, effectiveUserId]);

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setNotifications((data as Notification[]) || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast({ title: 'Error loading notifications', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

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

  /** ── Stale notification cleanup ── */
  const cleanupStaleNotifications = async () => {
    if (!effectiveUserId) return;
    try {
      const { data: unreadWithRefs } = await supabase
        .from('notifications')
        .select('id, related_table, related_id')
        .eq('user_id', user?.id)
        .eq('is_read', false)
        .not('related_id', 'is', null);

      if (!unreadWithRefs || unreadWithRefs.length === 0) return;

      const staleIds: string[] = [];

      const defectNotifs = unreadWithRefs.filter(n => n.related_table === 'defects');
      if (defectNotifs.length > 0) {
        const defectIds = [...new Set(defectNotifs.map(n => n.related_id!))];
        const { data: resolvedDefects } = await supabase
          .from('defects')
          .select('id')
          .in('id', defectIds)
          .eq('status', 'resolved');
        const resolvedSet = new Set((resolvedDefects || []).map(d => d.id));
        defectNotifs.forEach(n => {
          if (resolvedSet.has(n.related_id!)) staleIds.push(n.id);
        });
      }

      const compNotifs = unreadWithRefs.filter(n => n.related_table === 'compliance_events');
      if (compNotifs.length > 0) {
        const compIds = [...new Set(compNotifs.map(n => n.related_id!))];
        const { data: completedEvents } = await supabase
          .from('compliance_events')
          .select('id')
          .in('id', compIds)
          .eq('status', 'completed');
        const completedSet = new Set((completedEvents || []).map(e => e.id));
        compNotifs.forEach(n => {
          if (completedSet.has(n.related_id!)) staleIds.push(n.id);
        });
      }

      if (staleIds.length > 0) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .in('id', staleIds);
        console.info(`[Notifications] Auto-dismissed ${staleIds.length} stale notifications`);
      }
    } catch (error) {
      console.error('Error cleaning up stale notifications:', error);
    }
  };

  const generateComplianceNotifications = async () => {
    if (!effectiveUserId) return;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const daysLabel = (d: number) => d === 1 ? '1 day' : `${d} days`;

    try {
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
        const rideName = doc.ride_id ? rideMap.get(doc.ride_id) || '' : '';
        const ctx = rideName ? ` — ${rideName}` : '';

        if (daysUntil < 0) {
          await ensureNotification(
            `Expired: ${doc.document_name}`,
            `This document expired ${daysLabel(Math.abs(daysUntil))} ago. Upload a new version or remove it${ctx}.`,
            'error', 'documents', doc.id
          );
        } else if (daysUntil <= 7) {
          await ensureNotification(
            `Expiring in ${daysLabel(daysUntil)}: ${doc.document_name}`,
            `Renew or replace before it expires${ctx}.`,
            'warning', 'documents', doc.id
          );
        } else if (daysUntil <= 14) {
          await ensureNotification(
            `Expiring in ${daysLabel(daysUntil)}: ${doc.document_name}`,
            `Renewal recommended soon${ctx}.`,
            'warning', 'documents', doc.id
          );
        } else if (daysUntil <= 30) {
          await ensureNotification(
            `Expiring soon: ${doc.document_name}`,
            `Expires in ${daysLabel(daysUntil)}${ctx}.`,
            'info', 'documents', doc.id
          );
        }
      }

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
        const ctx = rideName ? ` — ${rideName}` : '';

        if (daysUntil < 0) {
          await ensureNotification(
            `Overdue: ${evt.event_name}`,
            `Was due ${daysLabel(Math.abs(daysUntil))} ago. Arrange this urgently${ctx}.`,
            'error', 'compliance_events', evt.id
          );
        } else if (daysUntil <= 7) {
          await ensureNotification(
            `Due in ${daysLabel(daysUntil)}: ${evt.event_name}`,
            `Book or confirm this soon${ctx}.`,
            'warning', 'compliance_events', evt.id
          );
        } else if (daysUntil <= 14) {
          await ensureNotification(
            `Due in ${daysLabel(daysUntil)}: ${evt.event_name}`,
            `Plan ahead for this inspection${ctx}.`,
            'warning', 'compliance_events', evt.id
          );
        } else if (daysUntil <= 30) {
          await ensureNotification(
            `Coming up: ${evt.event_name}`,
            `Due in ${daysLabel(daysUntil)}${ctx}.`,
            'info', 'compliance_events', evt.id
          );
        }
      }

      const { data: openDefects } = await supabase
        .from('defects')
        .select('id, description, severity, ride_id, reported_at, status')
        .eq('user_id', effectiveUserId)
        .eq('is_test_data', false)
        .neq('status', 'resolved');

      for (const d of openDefects || []) {
        const rideName = d.ride_id ? rideMap.get(d.ride_id) || '' : '';
        const daysOpen = differenceInDays(today, parseISO(d.reported_at));
        const ctx = rideName ? ` — ${rideName}` : '';
        // Create a clean summary: first sentence or first 80 chars
        const rawDesc = d.description || '';
        const firstSentence = rawDesc.split(/[.!]\s/)[0].slice(0, 80);

        if (isDefectCritical(d.severity)) {
          await ensureNotification(
            `Stop Use: ${rideName || 'equipment'}`,
            `${firstSentence}. Do not operate until resolved. Open ${daysLabel(daysOpen)}${ctx}.`,
            'error', 'defects', d.id
          );
        } else if (d.severity === 'urgent') {
          await ensureNotification(
            `Repair needed: ${rideName || 'equipment'}`,
            `${firstSentence}. Open ${daysLabel(daysOpen)}${ctx}.`,
            'warning', 'defects', d.id
          );
        } else {
          await ensureNotification(
            `Open defect: ${rideName || 'equipment'}`,
            `${firstSentence}. Open ${daysLabel(daysOpen)}${ctx}.`,
            'info', 'defects', d.id
          );
        }
      }

      const { data: maintenanceRecords } = await supabase
        .from('maintenance_records')
        .select('id, description, ride_id, next_maintenance_due, maintenance_date')
        .eq('user_id', effectiveUserId)
        .eq('is_test_data', false);

      for (const m of maintenanceRecords || []) {
        const rideName = m.ride_id ? rideMap.get(m.ride_id) || '' : '';
        const ctx = rideName ? ` — ${rideName}` : '';
        if (m.next_maintenance_due) {
          const dueDate = parseISO(m.next_maintenance_due);
          const daysUntil = differenceInDays(dueDate, today);
          if (daysUntil < 0) {
            await ensureNotification(
              `Maintenance overdue: ${rideName || 'equipment'}`,
              `Was due ${daysLabel(Math.abs(daysUntil))} ago${ctx}.`,
              'warning', 'maintenance_records', m.id
            );
          } else if (daysUntil <= 7) {
            await ensureNotification(
              `Maintenance due in ${daysLabel(daysUntil)}`,
              `${m.description.slice(0, 60)}${ctx}.`,
              'info', 'maintenance_records', m.id
            );
          }
        }
        if (m.maintenance_date) {
          const logDate = parseISO(m.maintenance_date);
          const daysAgo = differenceInDays(today, logDate);
          if (daysAgo >= 0 && daysAgo <= 7) {
            await ensureNotification(
              `Maintenance logged: ${rideName || 'equipment'}`,
              `${m.description.slice(0, 60)}${ctx}.`,
              'success', 'maintenance_records', m.id
            );
          }
        }
      }

      const { data: overdueChecks } = await supabase
        .from('checks')
        .select('id, ride_id, check_date')
        .eq('user_id', effectiveUserId)
        .eq('status', 'pending')
        .eq('is_test_data', false)
        .lt('check_date', todayStr);

      if (overdueChecks && overdueChecks.length > 0) {
        const byRide = new Map<string, number>();
        overdueChecks.forEach(c => byRide.set(c.ride_id, (byRide.get(c.ride_id) || 0) + 1));
        for (const [rideId, count] of byRide) {
          const rideName = rideMap.get(rideId) || 'Unknown';
          await ensureNotification(
            `Missed check: ${rideName}`,
            `${count} overdue check${count > 1 ? 's' : ''} — complete or review.`,
            'warning', 'checks'
          );
        }
      }

      const { data: failedChecks } = await supabase
        .from('checks')
        .select('id, ride_id')
        .eq('user_id', effectiveUserId)
        .eq('check_date', todayStr)
        .eq('status', 'failed');

      for (const fc of failedChecks || []) {
        const rideName = fc.ride_id ? rideMap.get(fc.ride_id) || '' : '';
        const { data: linkedDefect } = await supabase
          .from('defects')
          .select('id, severity')
          .eq('check_id', fc.id)
          .neq('status', 'resolved')
          .limit(1)
          .maybeSingle();

        if (linkedDefect?.id) {
          await ensureNotification(
            `Check failed with defect: ${rideName || 'asset'}`,
            `A failed check raised a defect — review and resolve.`,
            'warning', 'defects', linkedDefect.id
          );
        } else {
          await ensureNotification(
            `Failed check: ${rideName || 'asset'}`,
            `Today's check failed — review the results.`,
            'warning', 'checks', fc.id
          );
        }
      }

      // Pressure sessions — out-of-range readings (last 7 days)
      const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000).toISOString().split('T')[0];
      const { data: pressureSessions } = await supabase
        .from('pressure_sessions')
        .select('id, ride_id, session_date, session_time, site_name, is_complete')
        .eq('user_id', effectiveUserId)
        .gte('session_date', sevenDaysAgo);

      if (pressureSessions && pressureSessions.length > 0) {
        const sessionIds = pressureSessions.map(s => s.id);
        const { data: allPressureLines } = await supabase
          .from('pressure_session_lines')
          .select('session_id, section_number, section_name, pressure_value, pressure_unit')
          .in('session_id', sessionIds);

        for (const ps of pressureSessions) {
          const psLines = (allPressureLines || []).filter(l => l.session_id === ps.id);
          const psRideName = ps.ride_id ? rideMap.get(ps.ride_id) || '' : '';
          const { data: rideData } = await supabase
            .from('rides')
            .select('section_config')
            .eq('id', ps.ride_id)
            .single();
          const sConfig = (rideData?.section_config as any[]) || [];
          const outOfRange = psLines.filter(l => {
            const limits = sConfig[l.section_number - 1];
            if (!limits) return false;
            const val = l.pressure_value;
            if (val == null) return false;
            if (limits.min_pressure != null && val < limits.min_pressure) return true;
            if (limits.max_pressure != null && val > limits.max_pressure) return true;
            return false;
          });

          if (outOfRange.length > 0) {
            const sectionNames = outOfRange.map(l => l.section_name).join(', ');
            await ensureNotification(
              `Pressure out of range: ${psRideName || 'inflatable'}`,
              `${outOfRange.length} section${outOfRange.length > 1 ? 's' : ''} outside limits (${sectionNames}).`,
              'warning', 'pressure_sessions', ps.id
            );
          }
        }
      }

      // Cleanup stale notifications then reload
      await cleanupStaleNotifications();
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
    toast({ title: 'All marked as read' });
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id).eq('user_id', user?.id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  /* ── Derived data ── */

  const urgentItems = useMemo(() =>
    notifications.filter(n => !n.is_read && isUrgent(n) && isActionable(n))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [notifications]
  );

  const actionItems = useMemo(() =>
    notifications.filter(n => !n.is_read && isActionable(n) && !isUrgent(n))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [notifications]
  );

  const updateItems = useMemo(() =>
    notifications.filter(n => n.is_read || !isActionable(n))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [notifications]
  );

  // Domain filtering for the browse section
  const domainFiltered = useMemo(() => {
    const nonUrgent = updateItems;
    if (domainTab === 'all') return nonUrgent;
    return nonUrgent.filter(n => getCategory(n) === domainTab);
  }, [updateItems, domainTab]);

  const domainCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, defects: 0, compliance: 0, checks: 0, documents: 0, maintenance: 0 };
    updateItems.forEach(n => {
      counts.all++;
      const cat = getCategory(n);
      if (counts[cat] !== undefined) counts[cat]++;
    });
    return counts;
  }, [updateItems]);

  const handleNavigate = useCallback(async (n: Notification) => {
    const route = getActionRoute(n);
    if (!route) return;
    if (!n.is_read && isController) await markAsRead(n.id);
    navigate(route);
  }, [isController, navigate]);

  /* ── Render ── */

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const totalActionable = urgentItems.length + actionItems.length;
  const BROWSE_INITIAL = 15;
  const browseSlice = showOlder ? domainFiltered : domainFiltered.slice(0, BROWSE_INITIAL);
  const hasMoreBrowse = domainFiltered.length > BROWSE_INITIAL;

  return (
    <div className="space-y-5">
      {/* ── Summary line ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {urgentItems.length > 0 && (
            <span className="text-destructive font-semibold">{urgentItems.length} urgent</span>
          )}
          {urgentItems.length > 0 && actionItems.length > 0 && ' · '}
          {actionItems.length > 0 && (
            <span className="font-semibold text-foreground">{actionItems.length} action</span>
          )}
          {totalActionable > 0 && updateItems.length > 0 && ' · '}
          {updateItems.length > 0 && (
            <span>{updateItems.length} older</span>
          )}
          {totalActionable === 0 && updateItems.length === 0 && 'No notifications'}
        </p>
        {isController && notifications.some(n => !n.is_read) && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <Check className="h-3 w-3" />
            Read all
          </button>
        )}
      </div>

      {/* ── URGENT section ── */}
      {urgentItems.length > 0 && (
        <section className="space-y-1.5">
          <div className="flex items-center gap-1.5 px-1">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-destructive">
              Urgent
            </p>
            <Badge variant="destructive" className="text-[9px] h-4 px-1.5 ml-auto">{urgentItems.length}</Badge>
          </div>
          <div className="rounded-xl border border-destructive/20 bg-destructive/[0.03] overflow-hidden divide-y divide-destructive/10">
            {urgentItems.map(n => (
              <NotificationRow
                key={n.id}
                notification={n}
                variant="urgent"
                onNavigate={handleNavigate}
                onDelete={isController ? deleteNotification : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── ACTION NEEDED section ── */}
      {actionItems.length > 0 && (
        <section className="space-y-1.5">
          <div className="flex items-center gap-1.5 px-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-foreground">
              Action needed
            </p>
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 ml-auto">{actionItems.length}</Badge>
          </div>
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.02] overflow-hidden divide-y divide-amber-500/10">
            {actionItems.map(n => (
              <NotificationRow
                key={n.id}
                notification={n}
                variant="action"
                onNavigate={handleNavigate}
                onDelete={isController ? deleteNotification : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── All clear ── */}
      {totalActionable === 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <CheckCircle className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">All clear</p>
            <p className="text-[11px] text-muted-foreground">No items need attention right now.</p>
          </div>
        </div>
      )}

      {/* ── BROWSE / OLDER section ── */}
      {domainFiltered.length > 0 && (
        <section className="space-y-2 pt-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-1">
            Updates & history
          </p>

          {/* Domain tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
            {DOMAIN_TABS.map(tab => {
              const count = domainCounts[tab.id] || 0;
              const isActive = domainTab === tab.id;
              if (count === 0 && tab.id !== 'all') return null;
              return (
                <button
                  key={tab.id}
                  onClick={() => setDomainTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all shrink-0',
                    isActive ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-accent'
                  )}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={cn(
                      'text-[9px] font-bold',
                      isActive ? 'text-background/70' : 'text-muted-foreground/60'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Filtered list */}
          <div className="space-y-0.5">
            {browseSlice.map(n => (
              <NotificationRow
                key={n.id}
                notification={n}
                variant="browse"
                onNavigate={handleNavigate}
                onDelete={isController && getCategory(n) === 'system' ? deleteNotification : undefined}
              />
            ))}
          </div>

          {/* Show more */}
          {hasMoreBrowse && !showOlder && (
            <button
              onClick={() => setShowOlder(true)}
              className="flex items-center gap-1 mx-auto px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <ChevronDown className="h-3 w-3" />
              Show {domainFiltered.length - BROWSE_INITIAL} older
            </button>
          )}
        </section>
      )}
    </div>
  );
};

/* ── Compact Notification Row ── */

interface NotificationRowProps {
  notification: Notification;
  variant: 'urgent' | 'action' | 'browse' | 'default';
  onNavigate: (n: Notification) => void;
  onDelete?: (id: string) => void;
}

const NotificationRow = ({ notification: n, variant, onNavigate, onDelete }: NotificationRowProps) => {
  const route = getActionRoute(n);
  const hasAction = route != null;
  const equipment = extractEquipmentName(n.message);
  const isBrowse = variant === 'browse' || variant === 'default';

  return (
    <div
      onClick={() => hasAction && onNavigate(n)}
      className={cn(
        'flex items-start gap-2.5 px-3 py-2 rounded-xl border transition-all group',
        variant === 'urgent' && 'border-destructive/20 bg-destructive/[0.04]',
        variant === 'action' && 'border-border bg-card hover:border-primary/30',
        isBrowse && n.is_read && 'border-transparent bg-transparent hover:bg-muted/60',
        isBrowse && !n.is_read && 'border-border/50 bg-card/50 hover:bg-card',
        hasAction && 'cursor-pointer active:scale-[0.995]'
      )}
    >
      {/* Icon */}
      <div className={cn(
        'flex items-center justify-center w-6 h-6 rounded-md shrink-0 mt-0.5',
        variant === 'urgent' ? 'bg-destructive/10' : variant === 'action' ? 'bg-accent' : 'bg-muted'
      )}>
        {getIcon(n)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={cn(
            'text-[13px] font-medium leading-snug line-clamp-1',
            n.is_read && isBrowse ? 'text-muted-foreground' : 'text-foreground'
          )}>
            {n.title}
          </p>
          {!n.is_read && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />}
        </div>

        {/* Message preview — only for urgent/action, or unread browse */}
        {(variant === 'urgent' || variant === 'action' || (!n.is_read && isBrowse)) && n.message && (
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-1">
            {n.message}
          </p>
        )}

        {/* Meta line: equipment tag + time */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {equipment && (
            <span className="text-[10px] font-medium text-primary bg-primary/8 px-1.5 py-0 rounded shrink-0 max-w-[120px] truncate">
              {equipment}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/60">
            {compactTime(n.created_at)}
          </span>
        </div>
      </div>

      {/* Action */}
      {hasAction && (
        <div className="flex items-center gap-0.5 shrink-0 mt-1">
          <span className={cn(
            'text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
            variant === 'urgent' ? 'text-destructive bg-destructive/8' :
            variant === 'action' ? 'text-foreground bg-accent' :
            'text-muted-foreground'
          )}>
            {getActionLabel(n)}
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
        </div>
      )}

      {onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(n.id); }}
          className="p-1 rounded-md text-muted-foreground/30 hover:text-foreground hover:bg-muted transition-all opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

export default NotificationCenter;
