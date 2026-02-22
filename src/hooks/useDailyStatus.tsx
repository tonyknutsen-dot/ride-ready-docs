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

  const canToggle = role === 'controller' || role === 'manager';

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

  const toggleOperating = useCallback(async (reason?: string) => {
    if (!effectiveUserId || !canToggle) return;

    const newValue = !isOperating;
    setToggling(true);

    // Optimistic update
    queryClient.setQueryData(['ride-daily-status', rideId, todayStr], newValue);

    try {
      // Get the user's display name for the log
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', effectiveUserId)
        .single();

      const displayName = (profile as any)?.full_name || 'Unknown';

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
          reason: reason || null,
        }) as any);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['ride-daily-status-log', rideId, todayStr] });
      queryClient.invalidateQueries({ queryKey: ['checks-compliance'] });
      queryClient.invalidateQueries({ queryKey: ['all-rides-daily-status'] });

      toast({
        title: newValue ? 'Ride marked as operating today' : 'Ride marked as not operating today',
      });
    } catch (err) {
      queryClient.setQueryData(['ride-daily-status', rideId, todayStr], !newValue);
    } finally {
      setToggling(false);
    }
  }, [effectiveUserId, canToggle, isOperating, rideId, todayStr, queryClient, toast]);

  return {
    isOperating,
    isLoading,
    canToggle,
    toggling,
    toggleOperating,
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
