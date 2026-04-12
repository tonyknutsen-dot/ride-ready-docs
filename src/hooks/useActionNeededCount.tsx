import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from './useEffectiveUserId';
import { isNotificationActionable } from '@/utils/notificationClassification';

let instanceCounter = 0;

/**
 * Returns the count of unread, action-needed notifications.
 * Uses shared classification logic from notificationClassification.ts.
 * Each hook instance gets a unique realtime channel to avoid conflicts.
 */
export function useActionNeededCount() {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const [count, setCount] = useState(0);
  const channelRef = useRef(`action-needed-count-${++instanceCounter}`);

  const fetchCount = useCallback(async () => {
    if (!user) return;
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
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchCount();

    const channel = supabase
      .channel(channelRef.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchCount()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, effectiveUserId, fetchCount]);

  return count;
}
