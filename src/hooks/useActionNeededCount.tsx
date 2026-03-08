import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from './useEffectiveUserId';

/**
 * Returns the count of unread, action-needed notifications.
 * Action-needed = defects, failed checks, overdue/expired/expiring items, warnings, errors.
 * Excludes: maintenance logged, documents sent, success type.
 */
export function useActionNeededCount() {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchCount = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, type, related_table')
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) return;

      const actionCount = (data || []).filter(n => {
        const title = (n.title || '').toLowerCase();
        const t = (n.type || '').toLowerCase();

        // Passive — not action needed
        if (title.includes('maintenance logged') || title.includes('documents sent') || title.includes('check completed')) return false;
        if (t === 'success') return false;

        // Defects
        if (n.related_table === 'defects') return true;
        if (title.includes('defect') || title.includes('stop use')) return true;

        // Failed checks
        if (title.includes('failed check') || title.includes('check failure')) return true;

        // Overdue / expired / expiring / due
        if (title.includes('overdue') || title.includes('expired') || title.includes('expiring')) return true;
        if (title.includes('due soon') || title.includes('due in')) return true;
        if (title.includes('missing') || title.includes('missed')) return true;

        // Safety
        if (title.includes('unresolved') || title.includes('high priority') || title.includes('critical')) return true;

        // Wind warnings
        if (title.includes('wind') && (title.includes('warning') || title.includes('threshold'))) return true;

        // Billing
        if (title.includes('billing') || title.includes('plan') || title.includes('limit')) return true;

        // Type fallback
        if (t === 'warning' || t === 'error') return true;

        return false;
      }).length;

      setCount(actionCount);
    };

    fetchCount();

    const channel = supabase
      .channel('action-needed-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchCount()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, effectiveUserId]);

  return count;
}
