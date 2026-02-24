import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';
import { format } from 'date-fns';

export interface OperationsOverviewData {
  operatingCount: number;
  notOperatingCount: number;
  operatingWithChecksOutstanding: number;
  openCriticalDefects: { id: string; description: string; ride_name: string; reported_at: string; status: string; ride_id: string; is_operating: boolean }[];
  openHighDefects: number;
  preOpeningCompletedToday: number;
  preOpeningDueToday: number;
  notOperatingRides: { ride_id: string; ride_name: string; reason: string | null }[];
  checksOutstandingRides: { ride_id: string; ride_name: string }[];
}

export function useOperationsOverview() {
  const { effectiveUserId } = useEffectiveUserId();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['operations-overview', effectiveUserId, todayStr],
    queryFn: async (): Promise<OperationsOverviewData> => {
      if (!effectiveUserId) throw new Error('No user');

      // Fetch rides
      const { data: rides } = await supabase
        .from('rides')
        .select('id, ride_name, requires_operational_checks')
        .eq('user_id', effectiveUserId);

      const allRides = rides || [];
      const rideMap = new Map(allRides.map(r => [r.id, r.ride_name]));

      // Fetch daily statuses
      const { data: statuses } = await (supabase
        .from('ride_daily_status' as any)
        .select('ride_id, is_operating')
        .eq('status_date', todayStr) as any);

      const operatingSet = new Set<string>();
      (statuses || []).forEach((s: any) => {
        if (s.is_operating) operatingSet.add(s.ride_id);
      });

      // Fetch today's status logs for reasons (latest per ride)
      const { data: statusLogs } = await (supabase
        .from('ride_daily_status_log' as any)
        .select('ride_id, reason, new_is_operating, changed_at')
        .eq('status_date', todayStr)
        .eq('new_is_operating', false)
        .order('changed_at', { ascending: false }) as any);

      const reasonMap = new Map<string, string>();
      (statusLogs || []).forEach((log: any) => {
        if (!reasonMap.has(log.ride_id)) {
          reasonMap.set(log.ride_id, log.reason || '');
        }
      });

      // Fetch today's completed checks
      const { data: todayChecks } = await supabase
        .from('checks')
        .select('ride_id, check_frequency')
        .eq('user_id', effectiveUserId)
        .eq('check_date', todayStr)
        .in('status', ['completed', 'passed', 'failed', 'partial']);

      const ridesWithChecksToday = new Set((todayChecks || []).map(c => c.ride_id));
      const preOpeningCompleted = (todayChecks || []).filter(c => c.check_frequency === 'preopening').length;

      // Fetch open critical defects
      const { data: criticalDefects } = await supabase
        .from('defects')
        .select('id, description, ride_id, reported_at, status')
        .eq('severity', 'stop_operation')
        .neq('status', 'resolved');

      // Fetch open high defects
      const { data: highDefects } = await supabase
        .from('defects')
        .select('id')
        .eq('severity', 'urgent')
        .neq('status', 'resolved');

      // Compute counts
      const operatingRides = allRides.filter(r => operatingSet.has(r.id));
      const notOperatingRides = allRides.filter(r => !operatingSet.has(r.id));

      const operatingWithChecksOutstanding = operatingRides.filter(
        r => r.requires_operational_checks && !ridesWithChecksToday.has(r.id)
      );

      // Pre-opening due = rides operating with requires_operational_checks
      const preOpeningDue = operatingRides.filter(r => r.requires_operational_checks).length;

      const criticalDefectsList = (criticalDefects || [])
        .filter(d => rideMap.has(d.ride_id))
        .map(d => ({
          ...d,
          ride_name: rideMap.get(d.ride_id) || 'Unknown',
          is_operating: operatingSet.has(d.ride_id),
        }));

      return {
        operatingCount: operatingRides.length,
        notOperatingCount: notOperatingRides.length,
        operatingWithChecksOutstanding: operatingWithChecksOutstanding.length,
        openCriticalDefects: criticalDefectsList,
        openHighDefects: (highDefects || []).length,
        preOpeningCompletedToday: preOpeningCompleted,
        preOpeningDueToday: preOpeningDue,
        notOperatingRides: notOperatingRides.map(r => ({
          ride_id: r.id,
          ride_name: r.ride_name,
          reason: reasonMap.get(r.id) || null,
        })),
        checksOutstandingRides: operatingWithChecksOutstanding.map(r => ({
          ride_id: r.id,
          ride_name: r.ride_name,
        })),
      };
    },
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
  });
}
