import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RestrictedFeatureCard } from '@/components/RestrictedFeatureCard';
import { useSubscription } from '@/hooks/useSubscription';
import { 
  FileText, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Wrench,
  Shield,
  Plus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  totalRides: number;
  activeInspections: number;
  overdueInspections: number;
  upcomingInspections: number;
  maintenanceRecords: number;
  documentsExpiringSoon: number;
}

interface DashboardOverviewProps {
  onNavigate: (tab: string) => void;
}

const DashboardOverview = ({ onNavigate }: DashboardOverviewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { subscription } = useSubscription();
  const [stats, setStats] = useState<DashboardStats>({
    totalRides: 0,
    activeInspections: 0,
    overdueInspections: 0,
    upcomingInspections: 0,
    maintenanceRecords: 0,
    documentsExpiringSoon: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (user && subscription) {
      loadDashboardData();
    }
  }, [user, subscription?.subscriptionStatus]);

  const loadDashboardData = async () => {
    try {
      // Only load documents for trial/basic users
      const { data: documents, error: documentsError } = await supabase
        .from('documents')
        .select('id, expires_at')
        .eq('user_id', user?.id)
        .not('expires_at', 'is', null);

      if (documentsError) throw documentsError;

      // Only load advanced features data for advanced plan users
      let ridesData, inspectionsData, maintenanceData, activityData;
      
      if (subscription?.subscriptionStatus === 'advanced') {
        // Load rides count
        const { data: rides, error: ridesError } = await supabase
          .from('rides')
          .select('id')
          .eq('user_id', user?.id);

        if (ridesError) throw ridesError;
        ridesData = rides;

        // Load inspection checks
        const { data: inspections, error: inspectionsError } = await supabase
          .from('inspection_checks')
          .select('id, check_date, status')
          .eq('user_id', user?.id);

        if (inspectionsError) throw inspectionsError;
        inspectionsData = inspections;

        // Load maintenance records
        const { data: maintenance, error: maintenanceError } = await supabase
          .from('maintenance_records')
          .select('id, maintenance_date')
          .eq('user_id', user?.id);

        if (maintenanceError) throw maintenanceError;
        maintenanceData = maintenance;

        // Load recent activity (last 5 inspection checks)
        const { data: activity } = await supabase
          .from('inspection_checks')
          .select(`
            id,
            check_date,
            status,
            inspector_name,
            rides(ride_name)
          `)
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(5);

        activityData = activity;
      }

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      const documentsExpiringSoon = documents?.filter(doc => 
        doc.expires_at && doc.expires_at <= thirtyDaysFromNow.toISOString().split('T')[0]
      ).length || 0;

      setStats({
        totalRides: ridesData?.length || 0,
        activeInspections: inspectionsData?.filter(i => i.status === 'in_progress').length || 0,
        overdueInspections: inspectionsData?.filter(i => 
          i.status === 'pending' && i.check_date < today
        ).length || 0,
        upcomingInspections: inspectionsData?.filter(i => 
          i.status === 'pending' && i.check_date >= today
        ).length || 0,
        maintenanceRecords: maintenanceData?.length || 0,
        documentsExpiringSoon,
      });

      setRecentActivity(activityData || []);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error loading dashboard",
        description: "Failed to load dashboard statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const isAdvancedUser = subscription?.subscriptionStatus === 'advanced';
  const isBasicOrTrial = subscription?.subscriptionStatus === 'basic' || subscription?.subscriptionStatus === 'trial' || subscription?.isTrialActive;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isAdvancedUser ? (
          <Card className="hover:shadow-elegant transition-smooth cursor-pointer" onClick={() => onNavigate('rides')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Rides</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{stats.totalRides}</div>
              <p className="text-xs text-muted-foreground">
                Registered rides in system
              </p>
            </CardContent>
          </Card>
        ) : (
          <RestrictedFeatureCard
            title="Total Rides"
            description="Track all your registered rides"
            icon={<Wrench className="h-4 w-4" />}
            requiredPlan="advanced"
          />
        )}

        {isAdvancedUser ? (
          <Card className="hover:shadow-elegant transition-smooth cursor-pointer" onClick={() => onNavigate('inspections')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Inspections</CardTitle>
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-600">{stats.activeInspections}</div>
              <p className="text-xs text-muted-foreground">
                Currently in progress
              </p>
            </CardContent>
          </Card>
        ) : (
          <RestrictedFeatureCard
            title="Active Inspections"
            description="Monitor ongoing inspection checks"
            icon={<CheckCircle className="h-4 w-4" />}
            requiredPlan="advanced"
          />
        )}

        {isAdvancedUser ? (
          <Card className="hover:shadow-elegant transition-smooth cursor-pointer" onClick={() => onNavigate('calendar')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div className="text-2xl font-bold text-destructive">{stats.overdueInspections}</div>
              <p className="text-xs text-muted-foreground">
                Require immediate attention
              </p>
            </CardContent>
          </Card>
        ) : (
          <RestrictedFeatureCard
            title="Overdue Items"
            description="Track overdue inspections and maintenance"
            icon={<AlertTriangle className="h-4 w-4" />}
            requiredPlan="advanced"
          />
        )}

        <Card className="hover:shadow-elegant transition-smooth cursor-pointer" onClick={() => onNavigate('documents')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Documents Expiring</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-600">{stats.documentsExpiringSoon}</div>
            <p className="text-xs text-muted-foreground">
              Within 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Common tasks to keep your rides compliant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {isAdvancedUser && (
              <Button 
                variant="outline" 
                className="justify-start h-auto p-4"
                onClick={() => onNavigate('inspections')}
              >
                <div className="flex flex-col items-start space-y-1">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">New Inspection</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Perform daily checks</span>
                </div>
              </Button>
            )}
            
            <Button 
              variant="outline" 
              className="justify-start h-auto p-4"
              onClick={() => onNavigate('documents')}
            >
              <div className="flex flex-col items-start space-y-1">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">Upload Document</span>
                </div>
                <span className="text-xs text-muted-foreground">Add certificates</span>
              </div>
            </Button>

            {isAdvancedUser && (
              <Button 
                variant="outline" 
                className="justify-start h-auto p-4"
                onClick={() => onNavigate('maintenance')}
              >
                <div className="flex flex-col items-start space-y-1">
                  <div className="flex items-center space-x-2">
                    <Wrench className="h-4 w-4" />
                    <span className="font-medium">Log Maintenance</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Record repairs</span>
                </div>
              </Button>
            )}

            {isAdvancedUser && (
              <Button 
                variant="outline" 
                className="justify-start h-auto p-4"
                onClick={() => onNavigate('calendar')}
              >
                <div className="flex flex-col items-start space-y-1">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium">View Calendar</span>
                  </div>
                  <span className="text-xs text-muted-foreground">See schedule</span>
                </div>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Recent Activity
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadDashboardData}
              disabled={loading}
              className="h-8 px-2"
            >
              <TrendingUp className="h-4 w-4" />
            </Button>
          </CardTitle>
          <CardDescription>
            {isAdvancedUser ? 'Latest inspection checks and updates' : 'Document uploads and updates'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isAdvancedUser ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Advanced activity tracking</p>
              <p className="text-sm">Upgrade to Advanced plan to see inspection activity</p>
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No recent activity</p>
              <p className="text-sm">Complete your first inspection to see activity here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg border bg-card-hover hover:bg-accent/50 transition-smooth">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">
                        {(activity.rides as any)?.ride_name || 'Unknown Ride'} Inspection
                      </p>
                      <p className="text-xs text-muted-foreground">
                        By {activity.inspector_name} on {activity.check_date}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={getStatusColor(activity.status)}>
                    {activity.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardOverview;