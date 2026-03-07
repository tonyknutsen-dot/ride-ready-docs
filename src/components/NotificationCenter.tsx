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
import { formatDistanceToNow, isToday, isThisWeek } from 'date-fns';

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

type FilterTab = 'all' | 'action' | 'compliance' | 'documents' | 'maintenance' | 'system';

/* ── Classification helpers ────────────────────── */

type Category = 'compliance' | 'documents' | 'maintenance' | 'system';

const getCategory = (n: Notification): Category => {
  const t = n.type?.toLowerCase() ?? '';
  const title = n.title?.toLowerCase() ?? '';
  if (t === 'warning' && (title.includes('overdue') || title.includes('inspection') || title.includes('check') || title.includes('ndt') || title.includes('missed'))) return 'compliance';
  if (title.includes('document') || title.includes('expir') || title.includes('certificate') || n.related_table === 'documents') return 'documents';
  if (title.includes('maintenance') || title.includes('repair') || n.related_table === 'maintenance_records') return 'maintenance';
  if (title.includes('defect') || title.includes('stop use') || title.includes('stop_operation')) return 'compliance';
  if (title.includes('wind') || title.includes('anemometer')) return 'compliance';
  if (t === 'warning' || t === 'error') return 'compliance';
  return 'system';
};

const isActionable = (n: Notification): boolean => {
  const title = n.title?.toLowerCase() ?? '';
  const t = n.type?.toLowerCase() ?? '';
  if (title.includes('overdue') || title.includes('expired') || title.includes('expiring')) return true;
  if (title.includes('missing') || title.includes('missed') || title.includes('stop use')) return true;
  if (title.includes('unresolved') || title.includes('high priority') || title.includes('critical')) return true;
  if (title.includes('wind') && title.includes('warning')) return true;
  if (title.includes('billing') || title.includes('plan') || title.includes('limit')) return true;
  if (title.includes('failed')) return true;
  if (t === 'warning' || t === 'error') return true;
  return false;
};

const isSentDocument = (n: Notification): boolean => {
  const title = n.title?.toLowerCase() ?? '';
  return title.includes('sent') || title.includes('shared') || title.includes('document pack');
};

const getPriority = (n: Notification): number => {
  const title = n.title?.toLowerCase() ?? '';
  if (title.includes('stop use') || title.includes('critical')) return 0;
  if (title.includes('overdue')) return 1;
  if (title.includes('expired')) return 2;
  if (title.includes('missing') || title.includes('missed')) return 3;
  if (title.includes('expiring') || title.includes('due')) return 4;
  if (title.includes('maintenance')) return 5;
  if (title.includes('wind')) return 6;
  return 7;
};

const getBarColor = (n: Notification): string => {
  if (isActionable(n)) {
    const title = n.title?.toLowerCase() ?? '';
    if (title.includes('stop use') || title.includes('critical') || title.includes('overdue') || title.includes('expired')) return 'bg-destructive';
    if (title.includes('expiring') || title.includes('missed') || title.includes('warning')) return 'bg-accent-foreground/60';
    return 'bg-destructive';
  }
  const cat = getCategory(n);
  switch (cat) {
    case 'compliance': return 'bg-destructive/60';
    case 'documents':  return 'bg-primary/60';
    case 'maintenance': return 'bg-accent-foreground/60';
    default: return 'bg-muted-foreground/30';
  }
};

const getIcon = (n: Notification) => {
  const title = n.title?.toLowerCase() ?? '';
  const cls = 'h-[18px] w-[18px]';
  if (title.includes('stop use') || title.includes('critical')) return <AlertOctagon className={cn(cls, 'text-destructive')} />;
  if (title.includes('defect')) return <AlertTriangle className={cn(cls, 'text-destructive')} />;
  if (title.includes('inspection') || title.includes('check') || title.includes('missed')) return <ClipboardCheck className={cn(cls, 'text-accent-foreground')} />;
  if (title.includes('sent') || title.includes('shared') || title.includes('document pack')) return <Send className={cn(cls, 'text-primary')} />;
  if (title.includes('document') || title.includes('expir') || title.includes('certificate')) return <FileText className={cn(cls, 'text-primary')} />;
  if (title.includes('maintenance') || title.includes('repair')) return <Wrench className={cn(cls, 'text-accent-foreground')} />;
  if (title.includes('wind')) return <Wind className={cn(cls, 'text-primary')} />;
  if (title.includes('billing') || title.includes('plan') || title.includes('limit')) return <CreditCard className={cn(cls, 'text-accent-foreground')} />;
  if (title.includes('security') || title.includes('role')) return <Shield className={cn(cls, 'text-primary')} />;
  if (n.type === 'success') return <CheckCircle className={cn(cls, 'text-primary')} />;
  return <Info className={cn(cls, 'text-muted-foreground')} />;
};

const getActionRoute = (n: Notification): string | null => {
  const title = n.title?.toLowerCase() ?? '';
  if (isSentDocument(n)) return '/batch-send';
  if (title.includes('check') || title.includes('missed')) return '/checks';
  if (title.includes('inspection')) return '/compliance';
  if (title.includes('document') || title.includes('expir') || title.includes('certificate')) return '/documents';
  if (title.includes('defect')) return '/defects';
  if (title.includes('maintenance')) return '/maintenance';
  if (title.includes('wind')) return '/wind-log';
  if (title.includes('billing') || title.includes('plan') || title.includes('limit')) return '/plan-billing';
  if (title.includes('security') || title.includes('role')) return '/security';
  if (n.related_table === 'documents') return '/documents';
  if (n.related_table === 'maintenance_records') return '/maintenance';
  if (n.related_table === 'defects') return '/defects';
  return null;
};

const getActionLabel = (n: Notification): string => {
  const title = n.title?.toLowerCase() ?? '';
  if (isSentDocument(n)) return 'View record';
  if (title.includes('check') || title.includes('missed')) return 'Start check';
  if (title.includes('inspection')) return 'View';
  if (title.includes('expir') || title.includes('document') || title.includes('certificate')) return 'Review';
  if (title.includes('defect')) return 'View defect';
  if (title.includes('maintenance')) return 'View';
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
  { id: 'documents',   label: 'Documents' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'system',      label: 'System' },
];

/* ── Component ─────────────────────────────────── */

const NotificationCenter = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const role = useAppRole();
  const isController = role === 'controller';

  useEffect(() => {
    if (user) {
      loadNotifications();
      generateSystemNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNotifications((data as Notification[]) || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast({ title: 'Error loading notifications', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const generateSystemNotifications = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: overdueChecks } = await supabase
        .from('checks')
        .select('id')
        .eq('user_id', user?.id)
        .eq('status', 'pending')
        .eq('is_test_data', false)
        .lt('check_date', today);

      if (overdueChecks && overdueChecks.length > 0) {
        await createNotification('Overdue Checks', `You have ${overdueChecks.length} overdue check(s) requiring immediate attention.`, 'warning');
      }

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const { data: expiringDocs } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', user?.id)
        .not('expires_at', 'is', null)
        .lte('expires_at', thirtyDaysFromNow.toISOString().split('T')[0]);

      if (expiringDocs && expiringDocs.length > 0) {
        await createNotification('Documents Expiring Soon', `${expiringDocs.length} document(s) will expire within 30 days. Please review and renew.`, 'warning');
      }
    } catch (error) {
      console.error('Error generating system notifications:', error);
    }
  };

  const createNotification = async (title: string, message: string, type: string) => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user?.id)
        .eq('title', title)
        .gte('created_at', yesterday.toISOString());
      if (existing && existing.length > 0) return;
      await supabase.from('notifications').insert({ user_id: user?.id, title, message, type });
      await loadNotifications();
    } catch (error) {
      console.error('Error creating notification:', error);
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
    const counts: Record<FilterTab, number> = { all: notifications.length, action: 0, compliance: 0, documents: 0, maintenance: 0, system: 0 };
    notifications.forEach(n => {
      const cat = getCategory(n);
      counts[cat] = (counts[cat] || 0) + 1;
      if (isActionable(n) && !n.is_read) counts.action++;
    });
    return counts;
  }, [notifications]);

  const handleCardAction = useCallback((n: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    const route = getActionRoute(n);
    if (route) {
      if (!n.is_read) markAsRead(n.id);
      navigate(route);
    }
  }, [navigate]);

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
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0',
                isActive
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {tab.label}
              {tab.id === 'action' && actionCount > 0 && (
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold',
                  isActive ? 'bg-destructive text-destructive-foreground' : 'bg-destructive/15 text-destructive'
                )}>
                  {actionCount}
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
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/8">
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
          {grouped.map(group => (
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

              <div className="space-y-1.5">
                {group.items.map(n => {
                  const actionable = isActionable(n);
                  const sentDoc = isSentDocument(n);
                  const route = getActionRoute(n);
                  const hasAction = (actionable && route) || (sentDoc && route);

                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.is_read && isController) markAsRead(n.id);
                        if (route) navigate(route);
                      }}
                      className={cn(
                        'flex bg-card border rounded-2xl overflow-hidden transition-all',
                        actionable && !n.is_read
                          ? 'border-destructive/20 shadow-[0_2px_8px_rgba(220,38,38,0.06)]'
                          : 'border-border',
                        route && 'cursor-pointer hover:border-primary/30 active:scale-[0.995]',
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
                            <p className={cn(
                              'text-[13px] font-semibold leading-tight truncate',
                              actionable && !n.is_read ? 'text-foreground' : 'text-foreground'
                            )}>
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
                          </div>
                        </div>

                        {/* Right side: action button or controls */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {hasAction && (
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
