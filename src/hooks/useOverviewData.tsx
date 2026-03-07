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

export interface RecentDocument {
  name: string;
  date: string;
  type: string;
}

export interface RecentActivity {
  type: string;
  title: string;
  time: string;
}

export interface DueSoonItem {
  label: string;
  rideName: string;
  daysUntil: number;
  type: 'inspection' | 'document' | 'ndt' | 'maintenance';
}

export interface ComplianceAlert {
  label: string;
  type: 'overdue' | 'expired' | 'due_soon';
  count: number;
}

export interface OverviewData {
  stats: OverviewStats;
  recentDocs: RecentDocument[];
  recentActivity: RecentActivity[];
  userPlan: string;
  dueSoonItems: DueSoonItem[];
  complianceAlerts: ComplianceAlert[];
  overdueCount: number;
  expiredDocsCount: number;
  openDefectsCount: number;
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
    recentDocsResult,
    recentChecksResult,
    recentMaintenanceResult,
    ridesResult,
    allDocsWithExpiry,
    // Compliance events: overdue
    overdueEventsResult,
    // Compliance events: due soon (within 30 days)
    dueSoonEventsResult,
    // Open defects count
    openDefectsResult,
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
    supabase
      .from('documents')
      .select('document_name, uploaded_at, document_type')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false })
      .limit(4),
    supabase
      .from('checks')
      .select('check_date, ride_id, rides(ride_name)')
      .eq('user_id', userId)
      .order('check_date', { ascending: false })
      .limit(2),
    supabase
      .from('maintenance_records')
      .select('maintenance_date, maintenance_type, ride_id')
      .eq('user_id', userId)
      .order('maintenance_date', { ascending: false })
      .limit(2),
    supabase
      .from('rides')
      .select('id, ride_name'),
    // Documents with expiry for compliance alerts (ride + global)
    supabase
      .from('documents')
      .select('document_name, expires_at, ride_id, is_global')
      .eq('user_id', userId)
      .not('expires_at', 'is', null)
      .eq('is_latest_version', true)
      .lte('expires_at', thirtyDaysStr)
      .order('expires_at', { ascending: true })
      .limit(20),
    // Overdue compliance events (regulatory only – operational never escalate)
    supabase
      .from('compliance_events')
      .select('id, event_name, due_date, ride_id, category')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .eq('event_category', 'regulatory')
      .lt('due_date', todayStr)
      .order('due_date', { ascending: true })
      .limit(20),
    // Due soon compliance events (regulatory only)
    supabase
      .from('compliance_events')
      .select('id, event_name, due_date, ride_id, category')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .eq('event_category', 'regulatory')
      .gte('due_date', todayStr)
      .lte('due_date', thirtyDaysStr)
      .order('due_date', { ascending: true })
      .limit(20),
    // Open defects (non-resolved)
    supabase
      .from('defects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('status', 'resolved'),
  ]);

  // Process stats
  const stats: OverviewStats = {
    totalDocuments: docsCountResult.count || 0,
    activeRides: ridesCountResult.count || 0,
    upcomingInspections: inspectionsCountResult.count || 0,
    recentChecks: checksCountResult.count || 0,
    maintenanceRecords: maintenanceCountResult.count || 0
  };

  // Build ride name lookup
  const rideMap = new Map<string, string>();
  ridesResult.data?.forEach(ride => rideMap.set(ride.id, ride.ride_name));

  // --- Compliance Alerts ---
  const expiredDocs = allDocsWithExpiry.data?.filter(d => d.expires_at && d.expires_at < todayStr) || [];
  const dueSoonDocs = allDocsWithExpiry.data?.filter(d => d.expires_at && d.expires_at >= todayStr) || [];
  const overdueEvents = overdueEventsResult.data || [];
  const dueSoonEvents = dueSoonEventsResult.data || [];

  const complianceAlerts: ComplianceAlert[] = [];

  // Overdue compliance events
  if (overdueEvents.length > 0) {
    complianceAlerts.push({ label: `${overdueEvents.length} compliance event${overdueEvents.length > 1 ? 's' : ''} overdue`, type: 'overdue', count: overdueEvents.length });
  }
  if (expiredDocs.length > 0) {
    complianceAlerts.push({ label: `${expiredDocs.length} document${expiredDocs.length > 1 ? 's' : ''} expired`, type: 'expired', count: expiredDocs.length });
  }
  // Due soon items (amber, not in banner — just for KPI)
  const totalDueSoon = dueSoonDocs.length + dueSoonEvents.length;
  if (totalDueSoon > 0) {
    complianceAlerts.push({ label: `${totalDueSoon} item${totalDueSoon > 1 ? 's' : ''} due within 30 days`, type: 'due_soon', count: totalDueSoon });
  }

  // --- Due Soon Items (next items across all types, sorted by urgency) ---
  const dueSoonItems: DueSoonItem[] = [];

  // Document expiries (ride-specific + global)
  dueSoonDocs.slice(0, 5).forEach(doc => {
    const daysUntil = Math.ceil((new Date(doc.expires_at!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isGlobal = (doc as any).is_global === true;
    const rideName = isGlobal ? 'All rides (Global)' : (doc.ride_id ? rideMap.get(doc.ride_id) || '' : '');
    dueSoonItems.push({ label: doc.document_name, rideName, daysUntil, type: 'document' });
  });

  // Expired docs (show as negative days)
  expiredDocs.slice(0, 5).forEach(doc => {
    const daysUntil = Math.ceil((new Date(doc.expires_at!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isGlobal = (doc as any).is_global === true;
    const rideName = isGlobal ? 'All rides (Global)' : (doc.ride_id ? rideMap.get(doc.ride_id) || '' : '');
    dueSoonItems.push({ label: doc.document_name, rideName, daysUntil, type: 'document' });
  });

  // Overdue compliance events (negative days)
  overdueEvents.forEach(evt => {
    const daysUntil = Math.ceil((new Date(evt.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const rideName = evt.ride_id ? rideMap.get(evt.ride_id) || '' : 'All rides (Global)';
    dueSoonItems.push({ label: evt.event_name, rideName, daysUntil, type: 'inspection' });
  });

  // Due soon compliance events
  dueSoonEvents.forEach(evt => {
    const daysUntil = Math.ceil((new Date(evt.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const rideName = evt.ride_id ? rideMap.get(evt.ride_id) || '' : 'All rides (Global)';
    dueSoonItems.push({ label: evt.event_name, rideName, daysUntil, type: 'inspection' });
  });

  // Sort by urgency (overdue first, then soonest)
  dueSoonItems.sort((a, b) => a.daysUntil - b.daysUntil);

  // Process recent docs
  const recentDocs: RecentDocument[] = recentDocsResult.data?.map(doc => ({
    name: doc.document_name,
    date: new Date(doc.uploaded_at).toLocaleDateString('en-GB'),
    type: doc.document_type
  })) || [];

  // Build activity list
  const activity: RecentActivity[] = [];
  if (recentChecksResult.data) {
    recentChecksResult.data.forEach(check => {
      activity.push({
        type: 'check',
        title: `Safety check completed - ${(check as any).rides?.ride_name}`,
        time: new Date(check.check_date).toLocaleDateString('en-GB')
      });
    });
  }
  if (recentMaintenanceResult.data) {
    recentMaintenanceResult.data.forEach(record => {
      const rideName = rideMap.get(record.ride_id) || 'Unknown';
      activity.push({
        type: 'maintenance',
        title: `${record.maintenance_type} - ${rideName}`,
        time: new Date(record.maintenance_date).toLocaleDateString('en-GB')
      });
    });
  }

  const totalOverdue = overdueEvents.length + expiredDocs.length;

  return {
    stats,
    recentDocs,
    recentActivity: activity.slice(0, 4),
    userPlan: profileResult.data?.subscription_status || 'trial',
    dueSoonItems: dueSoonItems.slice(0, 8),
    complianceAlerts,
    overdueCount: totalOverdue,
    expiredDocsCount: expiredDocs.length,
    openDefectsCount: openDefectsResult.count || 0,
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
