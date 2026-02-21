import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "./useEffectiveUserId";
import { useOfflineQuery } from "./useOfflineQuery";

export interface ChecksComplianceStats {
  overdueCount: number;
  dueTodayCount: number;
  dueSoonCount: number;   // within 7 days
  completedLast7dCount: number;
}

export interface CheckRideStatus {
  rideId: string;
  rideName: string;
  categoryName: string;
  lastCheckDate: string | null;
  daysSinceLastCheck: number | null;
  status: 'overdue' | 'due_today' | 'due_soon' | 'ok';
  checksLast7d: number;
}

export interface ChecksComplianceData {
  stats: ChecksComplianceStats;
  rideStatuses: CheckRideStatus[];
  overdueRides: CheckRideStatus[];
  dueTodayRides: CheckRideStatus[];
  dueSoonRides: CheckRideStatus[];
}

async function fetchChecksCompliance(userId: string): Promise<ChecksComplianceData> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [ridesResult, recentChecksResult] = await Promise.all([
    supabase
      .from('rides')
      .select('id, ride_name, ride_categories(name)')
      .eq('user_id', userId)
      .order('ride_name'),
    supabase
      .from('checks')
      .select('ride_id, check_date, status')
      .eq('user_id', userId)
      .gte('check_date', sevenDaysAgo)
      .order('check_date', { ascending: false }),
  ]);

  const rides = (ridesResult.data || []) as Array<{
    id: string;
    ride_name: string;
    ride_categories: { name: string } | null;
  }>;

  const recentChecks = recentChecksResult.data || [];

  // Build per-ride check history map
  const checksByRide = new Map<string, { date: string; status: string }[]>();
  for (const check of recentChecks) {
    if (!checksByRide.has(check.ride_id)) checksByRide.set(check.ride_id, []);
    checksByRide.get(check.ride_id)!.push({ date: check.check_date, status: check.status });
  }

  const rideStatuses: CheckRideStatus[] = rides.map(ride => {
    const rideChecks = checksByRide.get(ride.id) || [];
    const last = rideChecks[0] || null;
    const lastCheckDate = last?.date || null;
    const daysSince = lastCheckDate
      ? Math.floor((today.getTime() - new Date(lastCheckDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let status: CheckRideStatus['status'] = 'ok';
    if (daysSince === null || daysSince > 7) {
      status = 'overdue';
    } else if (daysSince === 0) {
      status = 'ok'; // checked today
    } else if (daysSince >= 6) {
      status = 'due_today';
    } else if (daysSince >= 4) {
      status = 'due_soon';
    }

    return {
      rideId: ride.id,
      rideName: ride.ride_name,
      categoryName: ride.ride_categories?.name || 'Equipment',
      lastCheckDate,
      daysSinceLastCheck: daysSince,
      status,
      checksLast7d: rideChecks.length,
    };
  });

  const overdueRides = rideStatuses.filter(r => r.status === 'overdue');
  const dueTodayRides = rideStatuses.filter(r => r.status === 'due_today');
  const dueSoonRides = rideStatuses.filter(r => r.status === 'due_soon');

  // Count completed checks in last 7 days
  const completedLast7dCount = recentChecks.filter(c => c.status === 'completed').length;

  return {
    stats: {
      overdueCount: overdueRides.length,
      dueTodayCount: dueTodayRides.length,
      dueSoonCount: dueSoonRides.length,
      completedLast7dCount,
    },
    rideStatuses,
    overdueRides,
    dueTodayRides,
    dueSoonRides,
  };
}

export function useChecksCompliance() {
  const { effectiveUserId, loading: staffLoading } = useEffectiveUserId();

  return useOfflineQuery({
    queryKey: ['checks-compliance', effectiveUserId],
    queryFn: () => fetchChecksCompliance(effectiveUserId!),
    enabled: !!effectiveUserId && !staffLoading,
    staleTime: 1000 * 60 * 2,
    offlineCacheKey: `checks-compliance:${effectiveUserId}`,
  });
}
