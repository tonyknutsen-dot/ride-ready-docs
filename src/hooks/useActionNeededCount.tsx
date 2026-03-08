import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from './useEffectiveUserId';
import { isNotificationActionable } from '@/utils/notificationClassification';

/**
 * Returns the count of unread, action-needed notifications.
 * Uses shared classification logic from notificationClassification.ts
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

      const actionCount = (data || []).filter(n =>
        isNotificationActionable(n as any)
      ).length;

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
