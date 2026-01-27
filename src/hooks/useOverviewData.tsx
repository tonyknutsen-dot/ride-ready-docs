import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

export interface OverviewData {
  stats: OverviewStats;
  recentDocs: RecentDocument[];
  recentActivity: RecentActivity[];
  userPlan: string;
}

async function fetchOverviewData(userId: string): Promise<OverviewData> {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Parallel fetch all data for better performance
  const [
    profileResult,
    docsCountResult,
    ridesCountResult,
    inspectionsCountResult,
    checksCountResult,
    maintenanceCountResult,
    recentDocsResult,
    recentChecksResult,
    recentMaintenanceResult
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('subscription_plan, subscription_status')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('rides')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('inspection_schedules')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('due_date', today)
      .lte('due_date', thirtyDaysFromNow),
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
      .select('maintenance_date, maintenance_type, ride_id, rides(ride_name)')
      .eq('user_id', userId)
      .order('maintenance_date', { ascending: false })
      .limit(2)
  ]);

  // Process stats
  const stats: OverviewStats = {
    totalDocuments: docsCountResult.count || 0,
    activeRides: ridesCountResult.count || 0,
    upcomingInspections: inspectionsCountResult.count || 0,
    recentChecks: checksCountResult.count || 0,
    maintenanceRecords: maintenanceCountResult.count || 0
  };

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
      activity.push({
        type: 'maintenance',
        title: `${record.maintenance_type} - ${(record as any).rides?.ride_name}`,
        time: new Date(record.maintenance_date).toLocaleDateString('en-GB')
      });
    });
  }

  return {
    stats,
    recentDocs,
    recentActivity: activity.slice(0, 4),
    userPlan: profileResult.data?.subscription_status || 'trial'
  };
}

export function useOverviewData() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['overview', user?.id],
    queryFn: () => fetchOverviewData(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // Fresh for 2 minutes (override default for frequently changing data)
  });
}
