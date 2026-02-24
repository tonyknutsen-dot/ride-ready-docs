import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, FileText, ClipboardCheck, Clock, CheckCircle, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { format } from 'date-fns';

interface AttentionItem {
  id: string;
  type: 'stop_use' | 'doc_expiring' | 'check_due' | 'inspection_due';
  label: string;
  sublabel?: string;
  urgency: 'critical' | 'warning' | 'info';
  path?: string;
}

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

      const [defectsRes, docsRes, eventsRes] = await Promise.all([
        // Open stop-use defects
        supabase
          .from('defects')
          .select('id, description, ride_id, rides(ride_name)')
          .eq('severity', 'stop_operation')
          .neq('status', 'resolved')
          .order('reported_at', { ascending: false })
          .limit(10),
        // Documents expiring within 30 days or already expired
        supabase
          .from('documents')
          .select('id, document_name, expires_at, ride_id, rides(ride_name)')
          .eq('user_id', effectiveUserId)
          .eq('is_latest_version', true)
          .not('expires_at', 'is', null)
          .lte('expires_at', thirtyDaysStr)
          .order('expires_at', { ascending: true })
          .limit(10),
        // Compliance events due within 30 days or overdue
        supabase
          .from('compliance_events')
          .select('id, event_name, due_date, ride_id')
          .eq('user_id', effectiveUserId)
          .in('status', ['scheduled', 'open'])
          .lte('due_date', thirtyDaysStr)
          .order('due_date', { ascending: true })
          .limit(10),
      ]);

      const result: AttentionItem[] = [];

      // Stop Use defects — always first, link to the ride's checks tab
      (defectsRes.data || []).forEach((d: any) => {
        result.push({
          id: `defect-${d.id}`,
          type: 'stop_use',
          label: d.rides?.ride_name || 'Equipment',
          sublabel: d.description?.substring(0, 80),
          urgency: 'critical',
          path: d.ride_id ? `/rides/${d.ride_id}?tab=checks` : '/rides',
        });
      });

      // Expired / expiring documents
      (docsRes.data || []).forEach((doc: any) => {
        const isExpired = doc.expires_at < todayStr;
        const daysUntil = Math.ceil((new Date(doc.expires_at).getTime() - today.getTime()) / 86400000);
        const dateLabel = isExpired
          ? `Expired ${Math.abs(daysUntil)}d ago`
          : daysUntil === 0 ? 'Expires today'
          : daysUntil === 1 ? 'Expires tomorrow'
          : `Expires in ${daysUntil}d`;
        result.push({
          id: `doc-${doc.id}`,
          type: 'doc_expiring',
          label: doc.document_name,
          sublabel: `${dateLabel}${doc.rides?.ride_name ? ` • ${doc.rides.ride_name}` : ''}`,
          urgency: isExpired || daysUntil <= 7 ? 'warning' : 'info',
          path: doc.ride_id ? `/rides/${doc.ride_id}?tab=documents` : '/documents',
        });
      });

      // Compliance events (inspections due)
      (eventsRes.data || []).forEach((evt: any) => {
        const isOverdue = evt.due_date < todayStr;
        const daysUntil = Math.ceil((new Date(evt.due_date).getTime() - today.getTime()) / 86400000);
        const dateLabel = isOverdue
          ? `${Math.abs(daysUntil)}d overdue`
          : daysUntil === 0 ? 'Due today'
          : daysUntil === 1 ? 'Due tomorrow'
          : `Due in ${daysUntil}d`;
        result.push({
          id: `event-${evt.id}`,
          type: 'inspection_due',
          label: evt.event_name,
          sublabel: dateLabel,
          urgency: isOverdue ? 'warning' : 'info',
          path: evt.ride_id ? `/rides/${evt.ride_id}?tab=overview` : '/calendar',
        });
      });

      return result;
    },
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
  });

  if (isLoading) return null;

  // All clear
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-4 py-6 text-center">
        <CheckCircle className="h-6 w-6 text-success" />
        <p className="text-sm font-semibold text-foreground">All clear — nothing needs attention</p>
        <p className="text-xs text-muted-foreground">No overdue items, expiring documents, or open defects.</p>
      </div>
    );
  }

  const getIcon = (type: AttentionItem['type']) => {
    switch (type) {
      case 'stop_use': return AlertOctagon;
      case 'doc_expiring': return FileText;
      case 'check_due': return ClipboardCheck;
      case 'inspection_due': return Clock;
    }
  };

  const getItemStyle = (item: AttentionItem) => {
    if (item.type === 'stop_use') return {
      bg: 'bg-destructive/5',
      border: 'border-destructive/30',
      iconColor: 'text-destructive',
      label: 'Stop Use Defect',
    };
    if (item.urgency === 'warning') return {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200 dark:border-amber-800',
      iconColor: 'text-amber-600',
      label: item.type === 'doc_expiring' ? 'Document' : 'Inspection',
    };
    return {
      bg: 'bg-card',
      border: 'border-border',
      iconColor: 'text-muted-foreground',
      label: item.type === 'doc_expiring' ? 'Document' : 'Inspection',
    };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-foreground tracking-[1px] uppercase">Needs Attention</h2>
        <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="h-px bg-border" />

      <div className="space-y-2">
        {items.map((item) => {
          const Icon = getIcon(item.type);
          const style = getItemStyle(item);

          return (
            <button
              key={item.id}
              onClick={() => item.path && navigate(item.path)}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border ${style.border} ${style.bg} hover:shadow-sm transition-all active:scale-[0.98]`}
            >
              <div className={`mt-0.5 shrink-0 ${style.iconColor}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                {item.sublabel && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.sublabel}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default NeedsAttentionPanel;
