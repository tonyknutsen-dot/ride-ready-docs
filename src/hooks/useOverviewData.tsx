import { useQuery } from "@tanstack/react-query";
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
    // New: compliance data
    allDocsWithExpiry,
    upcomingInspectionsResult,
    overdueInspectionsResult,
    ndtSchedulesResult,
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
    // Documents with expiry for compliance alerts
    supabase
      .from('documents')
      .select('document_name, expires_at, ride_id')
      .eq('user_id', userId)
      .not('expires_at', 'is', null)
      .eq('is_latest_version', true)
      .lte('expires_at', thirtyDaysStr)
      .order('expires_at', { ascending: true })
      .limit(10),
    // Upcoming inspections
    supabase
      .from('inspection_schedules')
      .select('inspection_name, due_date, ride_id, rides(ride_name)')
      .eq('user_id', userId)
      .gte('due_date', todayStr)
      .lte('due_date', thirtyDaysStr)
      .order('due_date', { ascending: true })
      .limit(5),
    // Overdue inspections
    supabase
      .from('inspection_schedules')
      .select('inspection_name, due_date, ride_id')
      .eq('user_id', userId)
      .lt('due_date', todayStr)
      .eq('is_active', true)
      .limit(10),
    // NDT schedules due soon
    supabase
      .from('ndt_schedules')
      .select('schedule_name, next_inspection_due, ride_id, rides(ride_name)')
      .eq('user_id', userId)
      .not('next_inspection_due', 'is', null)
      .lte('next_inspection_due', thirtyDaysStr)
      .order('next_inspection_due', { ascending: true })
      .limit(5),
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
  const overdueInspCount = overdueInspectionsResult.data?.length || 0;

  const complianceAlerts: ComplianceAlert[] = [];
  if (overdueInspCount > 0) {
    complianceAlerts.push({ label: `${overdueInspCount} inspection${overdueInspCount > 1 ? 's' : ''} overdue`, type: 'overdue', count: overdueInspCount });
  }
  if (expiredDocs.length > 0) {
    complianceAlerts.push({ label: `${expiredDocs.length} document${expiredDocs.length > 1 ? 's' : ''} expired`, type: 'expired', count: expiredDocs.length });
  }
  if (dueSoonDocs.length > 0) {
    complianceAlerts.push({ label: `${dueSoonDocs.length} document${dueSoonDocs.length > 1 ? 's' : ''} expiring soon`, type: 'due_soon', count: dueSoonDocs.length });
  }

  // --- Due Soon Items (next 5 across all types, sorted by urgency) ---
  const dueSoonItems: DueSoonItem[] = [];

  // Upcoming inspections
  upcomingInspectionsResult.data?.forEach(insp => {
    const daysUntil = Math.ceil((new Date(insp.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const rideName = (insp as any).rides?.ride_name || rideMap.get(insp.ride_id) || '';
    dueSoonItems.push({ label: insp.inspection_name, rideName, daysUntil, type: 'inspection' });
  });

  // Document expiries
  dueSoonDocs.slice(0, 3).forEach(doc => {
    const daysUntil = Math.ceil((new Date(doc.expires_at!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const rideName = doc.ride_id ? rideMap.get(doc.ride_id) || '' : '';
    dueSoonItems.push({ label: doc.document_name, rideName, daysUntil, type: 'document' });
  });

  // NDT schedules
  ndtSchedulesResult.data?.forEach(ndt => {
    const daysUntil = Math.ceil((new Date(ndt.next_inspection_due!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const rideName = (ndt as any).rides?.ride_name || rideMap.get(ndt.ride_id) || '';
    dueSoonItems.push({ label: ndt.schedule_name, rideName, daysUntil, type: 'ndt' });
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

  return {
    stats,
    recentDocs,
    recentActivity: activity.slice(0, 4),
    userPlan: profileResult.data?.subscription_status || 'trial',
    dueSoonItems: dueSoonItems.slice(0, 5),
    complianceAlerts,
    overdueCount: overdueInspCount,
    expiredDocsCount: expiredDocs.length,
  };
}

export function useOverviewData() {
  const { effectiveUserId, loading: staffLoading } = useEffectiveUserId();

  return useQuery({
    queryKey: ['overview', effectiveUserId],
    queryFn: () => fetchOverviewData(effectiveUserId!),
    enabled: !!effectiveUserId && !staffLoading,
    staleTime: 1000 * 60 * 2,
  });
}
