import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';

/**
 * SINGLE SOURCE OF TRUTH for maintenance counts and due/overdue logic.
 *
 * Consumers:
 * - Overview page (maintenance record count)
 * - Equipment selector (per-ride next-due)
 * - Notification centre (overdue/due-soon maintenance)
 * - Rides list (next maintenance due)
 *
 * Definitions:
 * - recent: maintenance_date within last 30 days
 * - due soon: next_maintenance_due within next 30 days
 * - overdue: next_maintenance_due before today
 * - notification-worthy: overdue OR due within 7 days
 */

export interface MaintenanceSummary {
  totalRecords: number;
  recentCount: number;
  dueSoonCount: number;
  overdueCount: number;
  /** Map of ride_id → { lastDate, nextDue, isOverdue } */
  byRide: Map<string, RideMaintenanceInfo>;
}

export interface RideMaintenanceInfo {
  lastDate: string | null;
  nextDue: string | null;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export function useMaintenanceSummary() {
  const { effectiveUserId } = useEffectiveUserId();

  return useQuery({
    queryKey: ['maintenance-summary', effectiveUserId],
    queryFn: async (): Promise<MaintenanceSummary> => {
      if (!effectiveUserId) {
        return { totalRecords: 0, recentCount: 0, dueSoonCount: 0, overdueCount: 0, byRide: new Map() };
      }

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      const thirtyDaysAhead = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      const [countResult, recordsResult] = await Promise.all([
        supabase
          .from('maintenance_records')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', effectiveUserId),
        supabase
          .from('maintenance_records')
          .select('ride_id, maintenance_date, next_maintenance_due')
          .eq('user_id', effectiveUserId)
          .order('maintenance_date', { ascending: false }),
      ]);

      const rows = recordsResult.data || [];
      const totalRecords = countResult.count || 0;

      // Build per-ride info
      const byRide = new Map<string, RideMaintenanceInfo>();
      let recentCount = 0;
      let dueSoonCount = 0;
      let overdueCount = 0;
      const seenRides = new Set<string>();

      for (const r of rows) {
        // Count recent
        if (r.maintenance_date >= thirtyDaysAgo) recentCount++;

        // Per-ride: take first (most recent) record per ride
        if (!seenRides.has(r.ride_id)) {
          seenRides.add(r.ride_id);

          // Find earliest next_maintenance_due for this ride from all its records
          const rideDueDates = rows
            .filter(x => x.ride_id === r.ride_id && x.next_maintenance_due)
            .map(x => x.next_maintenance_due!)
            .sort();
          const nextDue = rideDueDates[0] || null;
          const isOverdue = !!nextDue && nextDue < todayStr;
          const isDueSoon = !!nextDue && !isOverdue && nextDue <= thirtyDaysAhead;

          byRide.set(r.ride_id, {
            lastDate: r.maintenance_date,
            nextDue,
            isOverdue,
            isDueSoon,
          });

          if (isOverdue) overdueCount++;
          if (isDueSoon) dueSoonCount++;
        }
      }

      return { totalRecords, recentCount, dueSoonCount, overdueCount, byRide };
    },
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
  });
}

/* ─── Maintenance status helpers ─── */

export const MAINTENANCE_DUE_SOON_DAYS = 30;
export const MAINTENANCE_NOTIFICATION_DAYS = 7;

export const isMaintenanceOverdue = (nextDue: string | null): boolean => {
  if (!nextDue) return false;
  return nextDue < new Date().toISOString().split('T')[0];
};

export const isMaintenanceDueSoon = (nextDue: string | null): boolean => {
  if (!nextDue) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  const soonStr = new Date(Date.now() + MAINTENANCE_DUE_SOON_DAYS * 86400000).toISOString().split('T')[0];
  return nextDue >= todayStr && nextDue <= soonStr;
};

export const isMaintenanceNotificationWorthy = (nextDue: string | null): boolean => {
  if (!nextDue) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  if (nextDue < todayStr) return true; // overdue
  const soonStr = new Date(Date.now() + MAINTENANCE_NOTIFICATION_DAYS * 86400000).toISOString().split('T')[0];
  return nextDue <= soonStr; // due within 7 days
};
