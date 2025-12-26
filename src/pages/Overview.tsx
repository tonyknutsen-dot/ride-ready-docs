import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { FileText, Shield, Calendar, Upload, BarChart3, CheckCircle, AlertCircle, Clock, Wrench, ArrowRight, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickDocumentUpload } from "@/components/QuickDocumentUpload";
import { FeatureGate } from "@/components/FeatureGate";
import { Lock } from "lucide-react";
import { formatPlanWithDescription } from "@/utils/planFormatter";

interface OverviewStats {
  totalDocuments: number;
  activeRides: number;
  upcomingInspections: number;
  recentChecks: number;
  maintenanceRecords: number;
}

interface RecentDocument {
  name: string;
  date: string;
  type: string;
}

interface RecentActivity {
  type: string;
  title: string;
  time: string;
}

const Overview = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OverviewStats>({
    totalDocuments: 0,
    activeRides: 0,
    upcomingInspections: 0,
    recentChecks: 0,
    maintenanceRecords: 0
  });
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [userPlan, setUserPlan] = useState<string>('trial');
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);

  useEffect(() => {
    if (user) {
      fetchOverviewData();
    }
  }, [user]);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_plan, subscription_status')
        .eq('user_id', user?.id)
        .single();
      
      if (profile) {
        setUserPlan(profile.subscription_status || 'trial');
      }

      const { count: docsCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      const { count: ridesCount } = await supabase
        .from('rides')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      const { count: inspectionsCount } = await supabase
        .from('inspection_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .gte('due_date', new Date().toISOString().split('T')[0])
        .lte('due_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      const { count: checksCount } = await supabase
        .from('checks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .gte('check_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      const { count: maintenanceCount } = await supabase
        .from('maintenance_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      setStats({
        totalDocuments: docsCount || 0,
        activeRides: ridesCount || 0,
        upcomingInspections: inspectionsCount || 0,
        recentChecks: checksCount || 0,
        maintenanceRecords: maintenanceCount || 0
      });

      const { data: docs } = await supabase
        .from('documents')
        .select('document_name, uploaded_at, document_type')
        .eq('user_id', user?.id)
        .order('uploaded_at', { ascending: false })
        .limit(4);
      
      if (docs) {
        setRecentDocs(docs.map(doc => ({
          name: doc.document_name,
          date: new Date(doc.uploaded_at).toLocaleDateString(),
          type: doc.document_type
        })));
      }

      const activity: RecentActivity[] = [];

      const { data: recentChecks } = await supabase
        .from('checks')
        .select('check_date, ride_id, rides(ride_name)')
        .eq('user_id', user?.id)
        .order('check_date', { ascending: false })
        .limit(2);
      
      if (recentChecks) {
        recentChecks.forEach(check => {
          activity.push({
            type: 'check',
            title: `Safety check completed - ${(check as any).rides?.ride_name}`,
            time: new Date(check.check_date).toLocaleDateString()
          });
        });
      }

      const { data: recentMaintenance } = await supabase
        .from('maintenance_records')
        .select('maintenance_date, maintenance_type, ride_id, rides(ride_name)')
        .eq('user_id', user?.id)
        .order('maintenance_date', { ascending: false })
        .limit(2);
      
      if (recentMaintenance) {
        recentMaintenance.forEach(record => {
          activity.push({
            type: 'maintenance',
            title: `${record.maintenance_type} - ${(record as any).rides?.ride_name}`,
            time: new Date(record.maintenance_date).toLocaleDateString()
          });
        });
      }

      setRecentActivity(activity.slice(0, 4));
    } catch (error: any) {
      toast({
        title: "Error loading overview",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const basicFeatures = [
    {
      icon: <FileText className="w-5 h-5" />,
      title: "Document Management",
      description: "Store and organize all your ride documents and certificates",
      status: stats.totalDocuments > 0 ? "active" : "pending",
      count: `${stats.totalDocuments} documents`
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Safety Compliance",
      description: "Track safety inspections and regulatory requirements",
      status: "active",
      count: "Active"
    }
  ];

  const advancedFeatures = [
    {
      icon: <Calendar className="w-5 h-5" />,
      title: "Inspection Schedule",
      description: "Automated reminders and scheduling",
      status: "active",
      count: `${stats.recentChecks} this week`
    },
    {
      icon: <Wrench className="w-5 h-5" />,
      title: "Maintenance Tracking",
      description: "Detailed records of all maintenance activities",
      status: "active",
      count: `${stats.maintenanceRecords} records`
    }
  ];

  const demoFeatures = userPlan === 'advanced' ? [...basicFeatures, ...advancedFeatures] : basicFeatures;

  if (loading) {
    return (
      <div className="container mx-auto py-8 pb-24 md:pb-8 animate-pulse">
        <div className="mb-8">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 pb-24 md:pb-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Overview
            </h1>
            <Badge 
              variant={userPlan === 'trial' ? 'secondary' : 'default'}
              className={userPlan === 'advanced' ? 'bg-primary/10 text-primary border-primary/20' : ''}
            >
              {formatPlanWithDescription(userPlan)}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Your complete operations dashboard at a glance
          </p>
        </div>
      </div>

      {/* PRIMARY ACTION - Start a Check */}
      <FeatureGate 
        requiredPlan="advanced" 
        feature="Daily Checks" 
        fallback={
          <Card className="border-dashed border-2 border-border/50 bg-muted/20">
            <CardContent className="p-6 text-center">
              <div className="p-3 bg-muted rounded-full w-fit mx-auto mb-3">
                <CheckCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Safety Checks</h3>
              <p className="text-sm text-muted-foreground mb-4">Perform daily, monthly & yearly safety checks</p>
              <Button onClick={() => navigate('/billing')}>
                Upgrade to unlock
              </Button>
            </CardContent>
          </Card>
        }
      >
        <Card 
          className="group cursor-pointer border-2 border-success/30 bg-gradient-to-r from-success/5 to-success/10 hover:shadow-lg transition-all active:scale-[0.98]"
          onClick={() => navigate('/checks')}
        >
          <CardContent className="p-6 flex items-center gap-5">
            <div className="p-4 bg-success/20 rounded-2xl group-hover:bg-success/30 transition-colors">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-success mb-1">Start Safety Check</h2>
              <p className="text-sm text-muted-foreground">Perform daily, monthly or yearly inspections on your equipment</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-success">{stats.recentChecks}</p>
              <p className="text-xs text-muted-foreground">This week</p>
            </div>
          </CardContent>
        </Card>
      </FeatureGate>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="group hover:shadow-elegant transition-all duration-300 cursor-pointer border-border/50" onClick={() => navigate('/rides')}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/15 transition-colors">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">
              {stats.totalDocuments}
            </div>
            <div className="text-xs text-muted-foreground">Total Documents</div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-elegant transition-all duration-300 cursor-pointer border-border/50" onClick={() => navigate('/rides')}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-accent/10 rounded-lg group-hover:bg-accent/15 transition-colors">
                <Wrench className="h-4 w-4 text-accent" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">
              {stats.activeRides}
            </div>
            <div className="text-xs text-muted-foreground">Active Rides</div>
          </CardContent>
        </Card>

        <FeatureGate 
          requiredPlan="advanced" 
          feature="Maintenance" 
          fallback={
            <Card className="border-dashed border-border/50 bg-muted/30">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="text-lg font-semibold text-muted-foreground mb-1">Maintenance</div>
                <div className="text-xs text-muted-foreground mb-3">Track repairs</div>
                <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => navigate('/billing')}>
                  Upgrade
                </Button>
              </CardContent>
            </Card>
          }
        >
          <Card className="group hover:shadow-elegant transition-all duration-300 cursor-pointer border-border/50" onClick={() => navigate('/rides')}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/15 transition-colors">
                  <Wrench className="h-4 w-4 text-amber-500" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                {stats.maintenanceRecords}
              </div>
              <div className="text-xs text-muted-foreground">Maintenance</div>
            </CardContent>
          </Card>
        </FeatureGate>

        <FeatureGate 
          requiredPlan="advanced" 
          feature="Inspections" 
          fallback={
            <Card className="border-dashed border-border/50 bg-muted/30">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="text-lg font-semibold text-muted-foreground mb-1">Schedule</div>
                <div className="text-xs text-muted-foreground mb-3">Plan inspections</div>
                <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => navigate('/billing')}>
                  Upgrade
                </Button>
              </CardContent>
            </Card>
          }
        >
          <Card className="group hover:shadow-elegant transition-all duration-300 cursor-pointer border-border/50" onClick={() => navigate('/calendar')}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-warning/10 rounded-lg group-hover:bg-warning/15 transition-colors">
                  <Calendar className="h-4 w-4 text-warning" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                {stats.upcomingInspections}
              </div>
              <div className="text-xs text-muted-foreground">Due Soon</div>
            </CardContent>
          </Card>
        </FeatureGate>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* System Status */}
          <Card className="border-border/50 shadow-card">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <BarChart3 className="w-4 h-4 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">System Status</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {demoFeatures.map((feature, index) => (
                <div 
                  key={index} 
                  className="flex items-start gap-4 p-4 border border-border/50 rounded-xl hover:bg-muted/30 transition-colors group"
                >
                  <div className="text-primary mt-0.5 p-2 bg-primary/5 rounded-lg group-hover:bg-primary/10 transition-colors">
                    {feature.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-medium text-sm">{feature.title}</h3>
                      <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                        {feature.count}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                  <div className="mt-1 shrink-0">
                    {feature.status === "warning" ? (
                      <AlertCircle className="w-4 h-4 text-warning" />
                    ) : feature.status === "pending" ? (
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-success" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Documents */}
          {recentDocs.length > 0 && (
            <Card className="border-border/50 shadow-card">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-accent/10 rounded-lg">
                      <FileText className="w-4 h-4 text-accent" />
                    </div>
                    <h2 className="text-lg font-semibold">Recent Documents</h2>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => navigate('/rides')}>
                    View all
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentDocs.map((doc, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 bg-muted rounded-md">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{doc.name}</div>
                          <div className="text-xs text-muted-foreground">{doc.date}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs font-normal">
                        {doc.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="border-border/50 shadow-card">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-success/10 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-success" />
                </div>
                <h2 className="text-lg font-semibold">Quick Actions</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                className="w-full justify-start gap-3 h-11" 
                onClick={() => setShowDocumentUpload(true)}
              >
                <Upload className="w-4 h-4" />
                Upload Document
              </Button>
              <Button 
                className="w-full justify-start gap-3 h-11" 
                variant="outline"
                onClick={() => {
                  if (userPlan === 'advanced') {
                    navigate('/checks');
                  } else {
                    navigate('/billing');
                  }
                }}
              >
                <Wrench className="w-4 h-4" />
                {userPlan === 'advanced' ? 'Operations & Maintenance' : 'Upgrade for Advanced'}
              </Button>
              {userPlan === 'advanced' && (
                <Button 
                  className="w-full justify-start gap-3 h-11" 
                  variant="outline"
                  onClick={() => navigate('/calendar')}
                >
                  <Calendar className="w-4 h-4" />
                  View Calendar
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <FeatureGate 
            requiredPlan="advanced" 
            feature="Activity" 
            fallback={
              <Card className="border-dashed border-border/50 bg-muted/30">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-lg font-semibold text-muted-foreground">Recent Activity</h2>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Track all maintenance, checks, and inspections in a live feed.
                  </p>
                  <Button size="sm" className="w-full" onClick={() => navigate('/billing')}>
                    Upgrade Plan
                  </Button>
                </CardContent>
              </Card>
            }
          >
            {recentActivity.length > 0 && (
              <Card className="border-border/50 shadow-card">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-info/10 rounded-lg">
                      <Clock className="w-4 h-4 text-info" />
                    </div>
                    <h2 className="text-lg font-semibold">Recent Activity</h2>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{activity.title}</div>
                        <div className="text-xs text-muted-foreground">{activity.time}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </FeatureGate>
        </div>
      </div>

      <QuickDocumentUpload open={showDocumentUpload} onOpenChange={setShowDocumentUpload} />
    </div>
  );
};

export default Overview;