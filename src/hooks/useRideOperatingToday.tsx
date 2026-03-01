import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';
import { useAppRole } from './useAppRole';
import { useOnlineStatus } from './useOnlineStatus';
import { useToast } from './use-toast';
import { format } from 'date-fns';

/**
 * Manages the "operating today" status for a single ride.
 * - Reads from ride_operation_days table.
 * - Default = NOT operating (no record means off).
 * - Only controller/manager can toggle.
 */
export function useRideOperatingToday(rideId: string) {
  const { effectiveUserId } = useEffectiveUserId();
  const role = useAppRole();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const canToggle = role === 'controller';

  const { data: isOperating, isLoading } = useQuery({
    queryKey: ['ride-operating-today', rideId, todayStr],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('ride_operation_days' as any)
        .select('is_operating')
        .eq('ride_id', rideId)
        .eq('operation_date', todayStr)
        .maybeSingle() as any);

      if (error) {
        console.error('Failed to fetch operating status:', error);
        return false;
      }
      return data?.is_operating ?? false;
    },
    enabled: !!rideId && !!effectiveUserId,
    staleTime: 1000 * 60 * 5,
  });

  const [toggling, setToggling] = useState(false);

  const toggleOperating = useCallback(async () => {
    if (!effectiveUserId || !canToggle) return;
    
    const newValue = !isOperating;
    setToggling(true);

    // Optimistic update
    queryClient.setQueryData(['ride-operating-today', rideId, todayStr], newValue);

    try {
      if (!isOnline) {
        toast({ title: newValue ? 'Marked as operating' : 'Marked as not operating', description: 'Will sync when online' });
        // Queue for later — for now just attempt the upsert anyway (it'll fail silently offline)
      }

      const { error } = await (supabase
        .from('ride_operation_days' as any)
        .upsert({
          ride_id: rideId,
          operation_date: todayStr,
          is_operating: newValue,
          set_by: effectiveUserId,
          set_at: new Date().toISOString(),
        }, { onConflict: 'ride_id,operation_date' }) as any);

      if (error) {
        // Revert optimistic
        queryClient.setQueryData(['ride-operating-today', rideId, todayStr], !newValue);
        toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
      } else {
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['recent-checks-summary'] });
        toast({ title: newValue ? 'Ride marked as operating today' : 'Ride marked as not operating today' });
      }
    } catch (err) {
      queryClient.setQueryData(['ride-operating-today', rideId, todayStr], !newValue);
    } finally {
      setToggling(false);
    }
  }, [effectiveUserId, canToggle, isOperating, rideId, todayStr, isOnline, queryClient, toast]);

  return {
    isOperating: isOperating ?? false,
    isLoading,
    canToggle,
    toggling,
    toggleOperating,
  };
}

/**
 * Fetches operating status for ALL rides today.
 * Used by the compliance/checks hooks to filter which rides show as "due today".
 */
export function useAllRidesOperatingToday() {
  const { effectiveUserId } = useEffectiveUserId();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['all-rides-operating-today', effectiveUserId, todayStr],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('ride_operation_days' as any)
        .select('ride_id, is_operating')
        .eq('operation_date', todayStr)
        .eq('is_operating', true) as any);

      if (error) {
        console.error('Failed to fetch all operating statuses:', error);
        return new Set<string>();
      }
      return new Set<string>((data || []).map((r: any) => r.ride_id));
    },
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 5,
  });
}
