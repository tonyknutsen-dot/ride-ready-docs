import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from './useEffectiveUserId';

/**
 * SINGLE SOURCE OF TRUTH for defect counts and summaries.
 *
 * Consumers:
 * - Overview page (open defect count)
 * - Ride detail (per-ride open count)
 * - Equipment selector (per-ride open defects)
 * - Needs-attention panel (stop-use defects)
 * - Notification centre (action-needed classification)
 * - Defect register (full list — uses its own query for full rows)
 *
 * This hook provides aggregate counts. Individual pages that need
 * full defect rows (DefectRegister, DefectsList) still query for
 * full rows but MUST use the same status/severity semantics.
 */

export interface DefectCounts {
  /** Total open (non-resolved) defects across all rides */
  totalOpen: number;
  /** Open stop_operation defects */
  criticalOpen: number;
  /** Open non-critical defects (urgent + non_urgent) */
  nonCriticalOpen: number;
  /** Map of ride_id → { critical, nonCritical } */
  byRide: Map<string, { critical: number; nonCritical: number }>;
}

/**
 * Returns aggregate defect counts. Shared across the app.
 * staleTime = 2 min to avoid over-fetching.
 */
export function useDefectSummary() {
  const { effectiveUserId } = useEffectiveUserId();

  return useQuery({
    queryKey: ['defect-summary', effectiveUserId],
    queryFn: async (): Promise<DefectCounts> => {
      if (!effectiveUserId) {
        return { totalOpen: 0, criticalOpen: 0, nonCriticalOpen: 0, byRide: new Map() };
      }

      const { data, error } = await supabase
        .from('defects')
        .select('ride_id, severity')
        .neq('status', 'resolved');

      if (error) {
        console.error('useDefectSummary error:', error);
        return { totalOpen: 0, criticalOpen: 0, nonCriticalOpen: 0, byRide: new Map() };
      }

      const rows = data || [];
      let criticalOpen = 0;
      let nonCriticalOpen = 0;
      const byRide = new Map<string, { critical: number; nonCritical: number }>();

      for (const d of rows) {
        const isCritical = d.severity === 'stop_operation';
        if (isCritical) criticalOpen++;
        else nonCriticalOpen++;

        const entry = byRide.get(d.ride_id) || { critical: 0, nonCritical: 0 };
        if (isCritical) entry.critical++;
        else entry.nonCritical++;
        byRide.set(d.ride_id, entry);
      }

      return {
        totalOpen: rows.length,
        criticalOpen,
        nonCriticalOpen,
        byRide,
      };
    },
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
  });
}

/* ─── Defect status helpers (shared semantics) ─── */

export const DEFECT_OPEN_STATUSES = ['open', 'acknowledged', 'in_progress'] as const;

export const isDefectOpen = (status: string): boolean =>
  status !== 'resolved';

export const isDefectCritical = (severity: string): boolean =>
  severity === 'stop_operation';

export const isDefectActionNeeded = (severity: string, status: string): boolean =>
  isDefectOpen(status) && isDefectCritical(severity);
