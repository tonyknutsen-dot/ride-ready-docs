import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';

export interface OpenCriticalDefect {
  id: string;
  description: string;
  severity: string;
  status: string;
  reported_at: string;
  ride_id: string;
  check_id: string | null;
  location_on_ride: string | null;
}

/**
 * Returns open (non-resolved) stop_operation defects for a given ride.
 */
export function useOpenCriticalDefects(rideId: string) {
  const { effectiveUserId } = useEffectiveUserId();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['open-critical-defects', rideId, effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];

      const { data, error } = await supabase
        .from('defects')
        .select('id, description, severity, status, reported_at, ride_id, check_id, location_on_ride')
        .eq('ride_id', rideId)
        .eq('severity', 'stop_operation')
        .neq('status', 'resolved')
        .order('reported_at', { ascending: false });

      if (error) {
        console.error('Error fetching critical defects:', error);
        return [];
      }
      return (data || []) as OpenCriticalDefect[];
    },
    enabled: !!rideId && !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
  });

  return {
    criticalDefects: data || [],
    hasCriticalDefects: (data || []).length > 0,
    criticalCount: (data || []).length,
    isLoading,
    refetch,
  };
}

/**
 * Returns a map of ride IDs → count of open critical (stop_operation) defects.
 * Used for the ride list view indicators.
 */
export function useAllRidesCriticalDefects() {
  const { effectiveUserId } = useEffectiveUserId();

  return useQuery({
    queryKey: ['all-rides-critical-defects', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return new Map<string, number>();

      const { data, error } = await supabase
        .from('defects')
        .select('ride_id')
        .eq('severity', 'stop_operation')
        .neq('status', 'resolved');

      if (error) {
        console.error('Error fetching all critical defects:', error);
        return new Map<string, number>();
      }

      const map = new Map<string, number>();
      for (const d of data || []) {
        map.set(d.ride_id, (map.get(d.ride_id) || 0) + 1);
      }
      return map;
    },
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Returns a map of ride IDs → { critical: number, nonCritical: number }
 * for ALL open (non-resolved) defects, partitioned by severity.
 */
export function useAllRidesOpenDefects() {
  const { effectiveUserId } = useEffectiveUserId();

  return useQuery({
    queryKey: ['all-rides-open-defects', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return new Map<string, { critical: number; nonCritical: number }>();

      const { data, error } = await supabase
        .from('defects')
        .select('ride_id, severity')
        .neq('status', 'resolved');

      if (error) {
        console.error('Error fetching all open defects:', error);
        return new Map<string, { critical: number; nonCritical: number }>();
      }

      const map = new Map<string, { critical: number; nonCritical: number }>();
      for (const d of data || []) {
        const current = map.get(d.ride_id) || { critical: 0, nonCritical: 0 };
        if (d.severity === 'stop_operation') {
          current.critical += 1;
        } else {
          current.nonCritical += 1;
        }
        map.set(d.ride_id, current);
      }
      return map;
    },
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
  });
}
