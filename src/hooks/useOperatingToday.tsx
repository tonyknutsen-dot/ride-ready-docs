import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';
import { format } from 'date-fns';

/**
 * Checks whether the user has already answered "Are you operating today?"
 * by looking for any operational compliance_events with today's date.
 *
 * Returns:
 *  - hasAnswered: true if operational events exist for today OR user dismissed
 *  - isOperating: true if operational events were created for today
 *  - confirmOperating: fn to create operational events
 *  - dismissOperating: fn to dismiss without creating events
 */
export function useOperatingToday() {
  const { effectiveUserId } = useEffectiveUserId();
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [dismissed, setDismissed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['operating-today', effectiveUserId, todayStr],
    queryFn: async () => {
      if (!effectiveUserId) return { count: 0 };
      const { count } = await supabase
        .from('compliance_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', effectiveUserId)
        .eq('event_category', 'operational')
        .eq('due_date', todayStr);
      return { count: count || 0 };
    },
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 5,
  });

  const hasOperationalEvents = (data?.count ?? 0) > 0;
  const hasAnswered = hasOperationalEvents || dismissed;

  const confirmOperating = async () => {
    if (!effectiveUserId) return;

    // Create daily + pre-opening operational events for today
    const events = [
      {
        user_id: effectiveUserId,
        event_name: 'Daily Safety Check',
        event_type: 'daily_check',
        category: 'operational',
        event_category: 'operational',
        due_date: todayStr,
        status: 'scheduled',
        is_recurring: false,
        advance_notice_days: 0,
        reminder_enabled: false,
      },
      {
        user_id: effectiveUserId,
        event_name: 'Pre-Opening Check',
        event_type: 'pre_opening_check',
        category: 'operational',
        event_category: 'operational',
        due_date: todayStr,
        status: 'scheduled',
        is_recurring: false,
        advance_notice_days: 0,
        reminder_enabled: false,
      },
    ];

    await supabase.from('compliance_events').insert(events);
    queryClient.invalidateQueries({ queryKey: ['operating-today'] });
    queryClient.invalidateQueries({ queryKey: ['checks-compliance'] });
  };

  const dismissOperating = () => {
    setDismissed(true);
  };

  return {
    isLoading,
    hasAnswered,
    isOperating: hasOperationalEvents,
    confirmOperating,
    dismissOperating,
  };
}
