import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';
import { format } from 'date-fns';

export interface OperatingRide {
  id: string;
  ride_name: string;
  categoryName: string;
}

/**
 * Checks whether the user has already confirmed operating rides today.
 * Fetches all rides + checks for existing operational events today.
 */
export function useOperatingToday() {
  const { effectiveUserId } = useEffectiveUserId();
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [dismissed, setDismissed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['operating-today', effectiveUserId, todayStr],
    queryFn: async () => {
      if (!effectiveUserId) return { operationalCount: 0, rides: [] as OperatingRide[] };

      const [eventsResult, ridesResult] = await Promise.all([
        supabase
          .from('compliance_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', effectiveUserId)
          .eq('event_category', 'operational')
          .eq('due_date', todayStr),
        supabase
          .from('rides')
          .select('id, ride_name, ride_categories(name)')
          .eq('user_id', effectiveUserId)
          .order('ride_name'),
      ]);

      const rides: OperatingRide[] = (ridesResult.data || []).map((r: any) => ({
        id: r.id,
        ride_name: r.ride_name,
        categoryName: r.ride_categories?.name || 'Equipment',
      }));

      return { operationalCount: eventsResult.count || 0, rides };
    },
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 5,
  });

  const hasOperationalEvents = (data?.operationalCount ?? 0) > 0;
  const hasAnswered = hasOperationalEvents || dismissed;
  const rides = data?.rides || [];

  const confirmOperating = async (selectedRideIds: string[]) => {
    if (!effectiveUserId || selectedRideIds.length === 0) return;
    setSubmitting(true);

    try {
      const events = selectedRideIds.flatMap(rideId => [
        {
          user_id: effectiveUserId,
          event_name: 'Daily Safety Check',
          event_type: 'daily_check',
          category: 'operational',
          event_category: 'operational',
          due_date: todayStr,
          ride_id: rideId,
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
          ride_id: rideId,
          status: 'scheduled',
          is_recurring: false,
          advance_notice_days: 0,
          reminder_enabled: false,
        },
      ]);

      await supabase.from('compliance_events').insert(events);
      queryClient.invalidateQueries({ queryKey: ['operating-today'] });
      queryClient.invalidateQueries({ queryKey: ['checks-compliance'] });
    } finally {
      setSubmitting(false);
    }
  };

  const dismissOperating = () => {
    setDismissed(true);
  };

  return {
    isLoading,
    hasAnswered,
    isOperating: hasOperationalEvents,
    rides,
    submitting,
    confirmOperating,
    dismissOperating,
  };
}
