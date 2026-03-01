import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';
import { useAppRole } from './useAppRole';
import { useOnlineStatus } from './useOnlineStatus';
import { useToast } from './use-toast';
import { format } from 'date-fns';

export interface StatusLogEntry {
  id: string;
  changed_at: string;
  changed_by_name: string | null;
  new_is_operating: boolean;
  reason: string | null;
}

/**
 * Manages the "operating today" daily status for a single ride.
 * Uses ride_daily_status + ride_daily_status_log tables.
 */
export function useDailyStatus(rideId: string) {
  const { effectiveUserId } = useEffectiveUserId();
  const role = useAppRole();
  const { isOnline } = useOnlineStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const canToggle = role === 'controller';

  // Fetch today's status
  const { data: statusData, isLoading } = useQuery({
    queryKey: ['ride-daily-status', rideId, todayStr],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('ride_daily_status' as any)
        .select('is_operating')
        .eq('ride_id', rideId)
        .eq('status_date', todayStr)
        .maybeSingle() as any);

      if (error) {
        console.error('Failed to fetch daily status:', error);
        return false;
      }
      return data?.is_operating ?? false;
    },
    enabled: !!rideId && !!effectiveUserId,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch today's log entries (last 3)
  const { data: logEntries } = useQuery({
    queryKey: ['ride-daily-status-log', rideId, todayStr],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('ride_daily_status_log' as any)
        .select('id, changed_at, changed_by_name, new_is_operating, reason')
        .eq('ride_id', rideId)
        .eq('status_date', todayStr)
        .order('changed_at', { ascending: false })
        .limit(3) as any);

      if (error) {
        console.error('Failed to fetch status log:', error);
        return [] as StatusLogEntry[];
      }
      return (data || []) as StatusLogEntry[];
    },
    enabled: !!rideId && !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
  });

  const isOperating = statusData ?? false;
  const [toggling, setToggling] = useState(false);

  /**
   * Internal helper to set operating status to a specific value.
   * Used by both toggleOperating and autoSetOperating.
   */
  const setOperatingValue = useCallback(async (newValue: boolean, reason?: string, autoReason?: string) => {
    if (!effectiveUserId) return;
    setToggling(true);

    // Optimistic update
    queryClient.setQueryData(['ride-daily-status', rideId, todayStr], newValue);

    try {
      // Get the user's display name for the log
      const { data: profile } = await supabase
        .from('profiles')
        .select('controller_name')
        .eq('user_id', effectiveUserId)
        .single();

      const displayName = (profile as any)?.controller_name || 'Unknown';

      // Upsert ride_daily_status
      const { error: upsertError } = await (supabase
        .from('ride_daily_status' as any)
        .upsert({
          ride_id: rideId,
          status_date: todayStr,
          is_operating: newValue,
          updated_by: effectiveUserId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'ride_id,status_date' }) as any);

      if (upsertError) {
        queryClient.setQueryData(['ride-daily-status', rideId, todayStr], !newValue);
        toast({ title: 'Failed to update status', description: upsertError.message, variant: 'destructive' });
        return;
      }

      // Insert log entry
      await (supabase
        .from('ride_daily_status_log' as any)
        .insert({
          ride_id: rideId,
          status_date: todayStr,
          changed_by: effectiveUserId,
          changed_by_name: displayName,
          new_is_operating: newValue,
          reason: autoReason || reason || null,
        }) as any);

      // If toggling OFF, clean up uncompleted operational compliance_events for today
      if (!newValue) {
        await supabase
          .from('compliance_events')
          .delete()
          .eq('ride_id', rideId)
          .eq('due_date', todayStr)
          .eq('event_category', 'operational')
          .in('status', ['scheduled', 'open']);
      }

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['ride-daily-status-log', rideId, todayStr] });
      queryClient.invalidateQueries({ queryKey: ['recent-checks-summary'] });
      queryClient.invalidateQueries({ queryKey: ['all-rides-daily-status'] });

      toast({
        title: newValue ? 'Marked in use today' : 'Marked as not in use today',
        description: newValue ? 'Daily and pre-opening checks are now due.' : 'Due check reminders cleared for today.',
      });
    } catch (err) {
      queryClient.setQueryData(['ride-daily-status', rideId, todayStr], !newValue);
    } finally {
      setToggling(false);
    }
  }, [effectiveUserId, rideId, todayStr, queryClient, toast]);

  const toggleOperating = useCallback(async (reason?: string) => {
    if (!canToggle) return;
    await setOperatingValue(!isOperating, reason);
  }, [canToggle, isOperating, setOperatingValue]);

  /**
   * Auto-set operating to ON when a user starts a Daily/Pre-Opening check.
   * Does nothing if already operating. No role restriction — any user starting a check triggers this.
   */
  const autoSetOperating = useCallback(async (checkType?: string) => {
    if (isOperating) return; // already on
    const label = checkType === 'preopening' ? 'Pre-Opening' : checkType === 'daily' ? 'Daily' : 'check';
    await setOperatingValue(true, undefined, `Started ${label} check`);
  }, [isOperating, setOperatingValue]);

  return {
    isOperating,
    isLoading,
    canToggle,
    toggling,
    toggleOperating,
    autoSetOperating,
    logEntries: logEntries || [],
  };
}

/**
 * Fetches operating status for ALL rides today.
 * Used by compliance/checks hooks to filter due/overdue.
 */
export function useAllRidesDailyStatus() {
  const { effectiveUserId } = useEffectiveUserId();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['all-rides-daily-status', effectiveUserId, todayStr],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('ride_daily_status' as any)
        .select('ride_id, is_operating')
        .eq('status_date', todayStr)
        .eq('is_operating', true) as any);

      if (error) {
        console.error('Failed to fetch all daily statuses:', error);
        return new Set<string>();
      }
      return new Set<string>((data || []).map((r: any) => r.ride_id));
    },
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 5,
  });
}
