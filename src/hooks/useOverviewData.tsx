import { useOfflineQuery } from './useOfflineQuery';
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "./useEffectiveUserId";

export interface OverviewStats {
  totalDocuments: number;
  activeRides: number;
  upcomingInspections: number;
  recentChecks: number;
  maintenanceRecords: number;
}

export interface ComplianceAlert {
  label: string;
  type: 'overdue' | 'expired' | 'due_soon';
  count: number;
}

export interface OverviewData {
  stats: OverviewStats;
  userPlan: string;
  complianceAlerts: ComplianceAlert[];
  overdueCount: number;
  expiredDocsCount: number;
  openDefectsCount: number;
  hasInflatables: boolean;
  hasPressureTracked: boolean;
}

async function fetchOverviewData(userId: string): Promise<OverviewData> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [
    profileResult,
    docsCountResult,
    ridesCountResult,
    inspectionsCountResult,
    checksCountResult,
    maintenanceCountResult,
    allDocsWithExpiry,
    overdueEventsResult,
    dueSoonEventsResult,
    openDefectsResult,
    inflatableCheckResult,
    pressureCheckResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('subscription_plan, subscription_status')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('document_type', 'maintenance')
      .neq('document_type', 'photo'),
    supabase
      .from('rides')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('inspection_schedules')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('due_date', todayStr)
      .lte('due_date', thirtyDaysStr),
    supabase
      .from('checks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('check_date', sevenDaysAgo),
    supabase
      .from('maintenance_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    // Documents with expiry for compliance alerts
    supabase
      .from('documents')
      .select('document_name, expires_at, ride_id, is_global')
      .eq('user_id', userId)
      .not('expires_at', 'is', null)
      .eq('is_latest_version', true)
      .lte('expires_at', thirtyDaysStr)
      .order('expires_at', { ascending: true })
      .limit(20),
    // Overdue compliance events (regulatory only)
    supabase
      .from('compliance_events')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .eq('event_category', 'regulatory')
      .lt('due_date', todayStr)
      .limit(20),
    // Due soon compliance events (regulatory only)
    supabase
      .from('compliance_events')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .eq('event_category', 'regulatory')
      .gte('due_date', todayStr)
      .lte('due_date', thirtyDaysStr)
      .limit(20),
    // Open defects (non-resolved)
    supabase
      .from('defects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('status', 'resolved'),
    // Has any inflatable equipment?
    supabase
      .from('rides')
      .select('id, ride_categories!inner(category_group)')
      .eq('user_id', userId)
      .eq('ride_categories.category_group', 'Inflatables')
      .limit(1),
    // Has any pressure-tracked equipment?
    supabase
      .from('rides')
      .select('id')
      .eq('user_id', userId)
      .eq('pressure_monitoring_enabled', true)
      .limit(1),
  ]);

  const stats: OverviewStats = {
    totalDocuments: docsCountResult.count || 0,
    activeRides: ridesCountResult.count || 0,
    upcomingInspections: inspectionsCountResult.count || 0,
    recentChecks: checksCountResult.count || 0,
    maintenanceRecords: maintenanceCountResult.count || 0
  };

  // --- Compliance Alerts ---
  const expiredDocs = allDocsWithExpiry.data?.filter(d => d.expires_at && d.expires_at < todayStr) || [];
  const dueSoonDocs = allDocsWithExpiry.data?.filter(d => d.expires_at && d.expires_at >= todayStr) || [];
  const overdueEvents = overdueEventsResult.data || [];
  const dueSoonEvents = dueSoonEventsResult.data || [];

  const complianceAlerts: ComplianceAlert[] = [];

  if (overdueEvents.length > 0) {
    complianceAlerts.push({ label: `${overdueEvents.length} compliance event${overdueEvents.length > 1 ? 's' : ''} overdue`, type: 'overdue', count: overdueEvents.length });
  }
  if (expiredDocs.length > 0) {
    complianceAlerts.push({ label: `${expiredDocs.length} document${expiredDocs.length > 1 ? 's' : ''} expired`, type: 'expired', count: expiredDocs.length });
  }
  const totalDueSoon = dueSoonDocs.length + dueSoonEvents.length;
  if (totalDueSoon > 0) {
    complianceAlerts.push({ label: `${totalDueSoon} item${totalDueSoon > 1 ? 's' : ''} due within 30 days`, type: 'due_soon', count: totalDueSoon });
  }

  const totalOverdue = overdueEvents.length + expiredDocs.length;

  return {
    stats,
    userPlan: profileResult.data?.subscription_status || 'trial',
    complianceAlerts,
    overdueCount: totalOverdue,
    expiredDocsCount: expiredDocs.length,
    openDefectsCount: openDefectsResult.count || 0,
    hasInflatables: (inflatableCheckResult.data?.length ?? 0) > 0,
    hasPressureTracked: (pressureCheckResult.data?.length ?? 0) > 0,
  };
}

export function useOverviewData() {
  const { effectiveUserId, loading: staffLoading } = useEffectiveUserId();

  return useOfflineQuery({
    queryKey: ['overview', effectiveUserId],
    queryFn: () => fetchOverviewData(effectiveUserId!),
    enabled: !!effectiveUserId && !staffLoading,
    staleTime: 1000 * 30,
    refetchOnMount: 'always',
    offlineCacheKey: `overview:${effectiveUserId}`,
  });
}
