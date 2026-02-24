import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';
import { format } from 'date-fns';

export interface CriticalDefectRow {
  id: string;
  description: string;
  ride_name: string;
  reported_at: string;
  status: string;
  ride_id: string;
  is_operating: boolean;
  check_id: string | null;
  not_operating_reason: string | null;
}

export interface ChecksOutstandingRow {
  ride_id: string;
  ride_name: string;
  last_check_time: string | null;
  check_label: string;
}

export interface NotOperatingRow {
  ride_id: string;
  ride_name: string;
  reason: string | null;
  changed_at: string | null;
  changed_by_name: string | null;
}

export interface AllRideRow {
  ride_id: string;
  ride_name: string;
  is_operating: boolean;
  checks_done_today: boolean;
  requires_checks: boolean;
  open_critical: number;
  open_high: number;
  not_operating_reason: string | null;
  last_activity: string | null;
}

export interface OperationsOverviewData {
  operatingCount: number;
  notOperatingCount: number;
  operatingWithChecksOutstanding: number;
  openCriticalDefects: CriticalDefectRow[];
  openHighDefects: number;
  preOpeningCompletedToday: number;
  preOpeningDueToday: number;
  notOperatingRides: NotOperatingRow[];
  checksOutstandingRides: ChecksOutstandingRow[];
  allRides: AllRideRow[];
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
      const rideMap = new Map(allRides.map(r => [r.id, r]));

      // Fetch daily statuses
      const { data: statuses } = await (supabase
        .from('ride_daily_status' as any)
        .select('ride_id, is_operating')
        .eq('status_date', todayStr) as any);

      const operatingSet = new Set<string>();
      (statuses || []).forEach((s: any) => {
        if (s.is_operating) operatingSet.add(s.ride_id);
      });

      // Fetch today's status logs for reasons + metadata
      const { data: statusLogs } = await (supabase
        .from('ride_daily_status_log' as any)
        .select('ride_id, reason, new_is_operating, changed_at, changed_by_name')
        .eq('status_date', todayStr)
        .order('changed_at', { ascending: false }) as any);

      // Maps for not-operating reason and latest change info
      const reasonMap = new Map<string, { reason: string | null; changed_at: string | null; changed_by_name: string | null }>();
      (statusLogs || []).forEach((log: any) => {
        if (!reasonMap.has(log.ride_id) && !log.new_is_operating) {
          reasonMap.set(log.ride_id, {
            reason: log.reason || null,
            changed_at: log.changed_at || null,
            changed_by_name: log.changed_by_name || null,
          });
        }
      });

      // Fetch today's completed checks
      const { data: todayChecks } = await supabase
        .from('checks')
        .select('ride_id, check_frequency, created_at')
        .eq('user_id', effectiveUserId)
        .eq('check_date', todayStr)
        .in('status', ['completed', 'passed', 'failed', 'partial']);

      const ridesWithChecksToday = new Set((todayChecks || []).map(c => c.ride_id));
      const preOpeningCompleted = (todayChecks || []).filter(c => c.check_frequency === 'preopening').length;

      // Last check time per ride (today)
      const lastCheckTimeMap = new Map<string, string>();
      (todayChecks || []).forEach(c => {
        const existing = lastCheckTimeMap.get(c.ride_id);
        if (!existing || c.created_at > existing) {
          lastCheckTimeMap.set(c.ride_id, c.created_at);
        }
      });

      // Fetch open critical defects
      const { data: criticalDefects } = await supabase
        .from('defects')
        .select('id, description, ride_id, reported_at, status, check_id')
        .eq('severity', 'stop_operation')
        .neq('status', 'resolved');

      // Fetch open high defects
      const { data: highDefects } = await supabase
        .from('defects')
        .select('id, ride_id')
        .eq('severity', 'urgent')
        .neq('status', 'resolved');

      // Count critical/high per ride
      const criticalPerRide = new Map<string, number>();
      (criticalDefects || []).forEach(d => {
        if (rideMap.has(d.ride_id)) {
          criticalPerRide.set(d.ride_id, (criticalPerRide.get(d.ride_id) || 0) + 1);
        }
      });
      const highPerRide = new Map<string, number>();
      (highDefects || []).forEach(d => {
        if (rideMap.has(d.ride_id)) {
          highPerRide.set(d.ride_id, (highPerRide.get(d.ride_id) || 0) + 1);
        }
      });

      // Compute
      const operatingRides = allRides.filter(r => operatingSet.has(r.id));
      const notOperatingRides = allRides.filter(r => !operatingSet.has(r.id));

      const operatingWithChecksOutstanding = operatingRides.filter(
        r => r.requires_operational_checks && !ridesWithChecksToday.has(r.id)
      );

      const preOpeningDue = operatingRides.filter(r => r.requires_operational_checks).length;

      const criticalDefectsList: CriticalDefectRow[] = (criticalDefects || [])
        .filter(d => rideMap.has(d.ride_id))
        .map(d => {
          const isOp = operatingSet.has(d.ride_id);
          const rInfo = reasonMap.get(d.ride_id);
          return {
            ...d,
            ride_name: rideMap.get(d.ride_id)?.ride_name || 'Unknown',
            is_operating: isOp,
            not_operating_reason: !isOp ? (rInfo?.reason || null) : null,
          };
        });

      // Last activity per ride (from status logs)
      const lastActivityMap = new Map<string, string>();
      (statusLogs || []).forEach((log: any) => {
        if (!lastActivityMap.has(log.ride_id)) {
          lastActivityMap.set(log.ride_id, log.changed_at);
        }
      });

      const allRideRows: AllRideRow[] = allRides.map(r => {
        const isOp = operatingSet.has(r.id);
        const rInfo = reasonMap.get(r.id);
        return {
          ride_id: r.id,
          ride_name: r.ride_name,
          is_operating: isOp,
          checks_done_today: ridesWithChecksToday.has(r.id),
          requires_checks: !!r.requires_operational_checks,
          open_critical: criticalPerRide.get(r.id) || 0,
          open_high: highPerRide.get(r.id) || 0,
          not_operating_reason: !isOp ? (rInfo?.reason || null) : null,
          last_activity: lastActivityMap.get(r.id) || lastCheckTimeMap.get(r.id) || null,
        };
      });

      return {
        operatingCount: operatingRides.length,
        notOperatingCount: notOperatingRides.length,
        operatingWithChecksOutstanding: operatingWithChecksOutstanding.length,
        openCriticalDefects: criticalDefectsList,
        openHighDefects: (highDefects || []).filter(d => rideMap.has(d.ride_id)).length,
        preOpeningCompletedToday: preOpeningCompleted,
        preOpeningDueToday: preOpeningDue,
        notOperatingRides: notOperatingRides.map(r => {
          const rInfo = reasonMap.get(r.id);
          return {
            ride_id: r.id,
            ride_name: r.ride_name,
            reason: rInfo?.reason || null,
            changed_at: rInfo?.changed_at || null,
            changed_by_name: rInfo?.changed_by_name || null,
          };
        }),
        checksOutstandingRides: operatingWithChecksOutstanding.map(r => ({
          ride_id: r.id,
          ride_name: r.ride_name,
          last_check_time: lastCheckTimeMap.get(r.id) || null,
          check_label: 'Pre-opening / Daily outstanding',
        })),
        allRides: allRideRows,
      };
    },
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
  });
}
