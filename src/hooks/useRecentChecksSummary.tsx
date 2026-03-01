import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "./useEffectiveUserId";
import { useOfflineQuery } from "./useOfflineQuery";

export interface RideCheckSummary {
  rideId: string;
  rideName: string;
  categoryName: string;
  lastCheckDate: string | null;
  lastCheckLabel: string;
  checksLast7d: number;
}

export interface RecentChecksSummaryData {
  checksToday: number;
  checksLast7d: number;
  rides: RideCheckSummary[];
}

function formatLastCheckLabel(lastCheckDate: string | null): string {
  if (!lastCheckDate) return 'No checks recorded';
  const today = new Date();
  const last = new Date(lastCheckDate);
  const diffMs = today.getTime() - last.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Last checked today';
  if (diffDays === 1) return 'Last checked yesterday';
  return `Last checked ${diffDays} days ago`;
}

async function fetchRecentChecksSummary(userId: string): Promise<RecentChecksSummaryData> {
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
      .eq('status', 'completed')
      .order('check_date', { ascending: false }),
  ]);

  const rides = (ridesResult.data || []) as Array<{
    id: string;
    ride_name: string;
    ride_categories: { name: string } | null;
  }>;

  const recentChecks = recentChecksResult.data || [];

  // Build per-ride check history
  const checksByRide = new Map<string, string[]>();
  for (const check of recentChecks) {
    if (!checksByRide.has(check.ride_id)) checksByRide.set(check.ride_id, []);
    checksByRide.get(check.ride_id)!.push(check.check_date);
  }

  const checksToday = recentChecks.filter(c => c.check_date === todayStr).length;

  // Build ride summaries, sorted: most recently checked first, then unchecked
  const rideSummaries: RideCheckSummary[] = rides.map(ride => {
    const dates = checksByRide.get(ride.id) || [];
    const lastCheckDate = dates[0] || null;
    return {
      rideId: ride.id,
      rideName: ride.ride_name,
      categoryName: ride.ride_categories?.name || 'Equipment',
      lastCheckDate,
      lastCheckLabel: formatLastCheckLabel(lastCheckDate),
      checksLast7d: dates.length,
    };
  });

  // Sort: recently checked rides first
  rideSummaries.sort((a, b) => {
    if (a.lastCheckDate && !b.lastCheckDate) return -1;
    if (!a.lastCheckDate && b.lastCheckDate) return 1;
    if (a.lastCheckDate && b.lastCheckDate) return b.lastCheckDate.localeCompare(a.lastCheckDate);
    return a.rideName.localeCompare(b.rideName);
  });

  return {
    checksToday,
    checksLast7d: recentChecks.length,
    rides: rideSummaries,
  };
}

export function useRecentChecksSummary() {
  const { effectiveUserId, loading: staffLoading } = useEffectiveUserId();

  return useOfflineQuery({
    queryKey: ['recent-checks-summary', effectiveUserId],
    queryFn: () => fetchRecentChecksSummary(effectiveUserId!),
    enabled: !!effectiveUserId && !staffLoading,
    staleTime: 1000 * 60 * 2,
    offlineCacheKey: `recent-checks-summary:${effectiveUserId}`,
  });
}
