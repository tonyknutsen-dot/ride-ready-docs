import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, BellRing, Check, X,
  AlertTriangle, Info, CheckCircle,
  FileText, Wrench, ClipboardCheck, Send, Bug
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, isToday, isThisWeek } from 'date-fns';

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

type FilterTab = 'all' | 'compliance' | 'documents' | 'maintenance' | 'system';

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'documents', label: 'Documents' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'system', label: 'System' },
];

// Map notification to a category for filtering
const getCategory = (n: Notification): FilterTab => {
  const t = n.type?.toLowerCase() ?? '';
  const title = n.title?.toLowerCase() ?? '';
  if (t === 'warning' && (title.includes('overdue') || title.includes('inspection') || title.includes('check') || title.includes('ndt'))) return 'compliance';
  if (title.includes('document') || title.includes('expir') || n.related_table === 'documents') return 'documents';
  if (title.includes('maintenance') || title.includes('repair') || n.related_table === 'maintenance_records') return 'maintenance';
  if (t === 'bug_status' || title.includes('system') || title.includes('update')) return 'system';
  if (t === 'warning' || t === 'error') return 'compliance';
  return 'system';
};

// Priority sort: overdue > expired doc > upcoming expiry > maintenance > rest
const getPriority = (n: Notification): number => {
  const title = n.title?.toLowerCase() ?? '';
  if (title.includes('overdue')) return 0;
  if (title.includes('expir')) return 1;
  if (title.includes('upcoming') || title.includes('due')) return 2;
  if (title.includes('maintenance')) return 3;
  return 4;
};

// Left bar colour by type
const getBarColor = (n: Notification): string => {
  const cat = getCategory(n);
  switch (cat) {
    case 'compliance': return 'bg-[#DC2626]';
    case 'documents':  return 'bg-[#2563EB]';
    case 'maintenance':return 'bg-[#F59E0B]';
    default: {
      if (n.type === 'success') return 'bg-[#16A34A]';
      return 'bg-[#64748B]';
    }
  }
};

const getIcon = (n: Notification) => {
  const cat = getCategory(n);
  const cls = 'h-4 w-4';
  switch (cat) {
    case 'compliance':  return <AlertTriangle className={cn(cls, 'text-[#DC2626]')} />;
    case 'documents':   return <FileText className={cn(cls, 'text-[#2563EB]')} />;
    case 'maintenance': return <Wrench className={cn(cls, 'text-[#F59E0B]')} />;
    default: {
      if (n.type === 'success') return <CheckCircle className={cn(cls, 'text-[#16A34A]')} />;
      if (n.type === 'bug_status') return <Bug className={cn(cls, 'text-purple-500')} />;
      return <Info className={cn(cls, 'text-[#64748B]')} />;
    }
  }
};

const groupByDate = (items: Notification[]): { label: string; items: Notification[] }[] => {
  const today: Notification[] = [];
  const week: Notification[] = [];
  const older: Notification[] = [];

  items.forEach(n => {
    const d = new Date(n.created_at);
    if (isToday(d)) today.push(n);
    else if (isThisWeek(d)) week.push(n);
    else older.push(n);
  });

  return [
    { label: 'Today', items: today },
    { label: 'This Week', items: week },
    { label: 'Older', items: older },
  ].filter(g => g.items.length > 0);
};

const NotificationCenter = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

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
        await createNotification('Documents Expiring Soon', `${expiringDocs.length} document(s) will expire within 30 days. Please review and renew as needed.`, 'warning');
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

  // Filtered + priority-sorted list
  const filtered = useMemo(() => {
    const list = activeTab === 'all'
      ? notifications
      : notifications.filter(n => getCategory(n) === activeTab);
    return [...list].sort((a, b) => getPriority(a) - getPriority(b));
  }, [notifications, activeTab]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-[14px] bg-[#F1F5F9] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-[#1E3A5F] text-white'
                : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
            )}
          >
            {tab.label}
            {tab.id === 'all' && unreadCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#DC2626] text-white text-[10px] font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        ))}

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#475569] bg-[#F1F5F9] hover:bg-[#E2E8F0] transition-all"
          >
            <Check className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notification Feed */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#E2E8F0] rounded-2xl">
          <Bell className="mx-auto h-10 w-10 text-[#CBD5E1] mb-3" />
          <p className="text-sm font-semibold text-[#0F172A]">No notifications</p>
          <p className="text-xs text-[#64748B] mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.label}>
              {/* Group heading */}
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.items.map(n => (
                  <div
                    key={n.id}
                    onClick={() => { if (!n.is_read) markAsRead(n.id); }}
                    className={cn(
                      'flex gap-0 bg-white border border-[#E2E8F0] rounded-[14px] overflow-hidden shadow-[0_2px_6px_rgba(0,0,0,0.05)] transition-all cursor-pointer',
                      !n.is_read && 'ring-1 ring-[#1E3A5F]/10'
                    )}
                  >
                    {/* Left colour bar */}
                    <div className={cn('w-1 flex-shrink-0', getBarColor(n))} />

                    <div className="flex-1 flex items-start gap-3 p-3.5">
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {getIcon(n)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[#0F172A] leading-tight">
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-[#1E3A5F]" />
                          )}
                        </div>
                        <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
                          {n.message}
                        </p>
                        <p className="text-[11px] text-[#94A3B8] mt-1.5">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>

                      {/* Actions — only dismiss for non-source-of-truth notifications */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!n.is_read && (
                          <button
                            onClick={e => { e.stopPropagation(); markAsRead(n.id); }}
                            className="p-1 rounded-lg text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9] transition-all"
                            title="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* Hide dismiss for compliance/document reminders tied to real unresolved data */}
                        {getCategory(n) === 'system' && (
                          <button
                            onClick={e => { e.stopPropagation(); deleteNotification(n.id); }}
                            className="p-1 rounded-lg text-[#94A3B8] hover:text-muted-foreground hover:bg-muted transition-all"
                            title="Dismiss"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
