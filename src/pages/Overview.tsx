import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { 
  FileText, 
  Shield, 
  Calendar, 
  Upload, 
  BarChart3, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Wrench
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

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

  useEffect(() => {
    if (user) {
      fetchOverviewData();
    }
  }, [user]);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);

      // Fetch user profile to get subscription plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_plan, subscription_status')
        .eq('user_id', user?.id)
        .single();

      if (profile) {
        setUserPlan(profile.subscription_status || 'trial');
      }

      // Fetch documents count
      const { count: docsCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      // Fetch rides count
      const { count: ridesCount } = await supabase
        .from('rides')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      // Fetch upcoming inspections
      const { count: inspectionsCount } = await supabase
        .from('inspection_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .gte('due_date', new Date().toISOString().split('T')[0])
        .lte('due_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      // Fetch recent checks (last 7 days)
      const { count: checksCount } = await supabase
        .from('inspection_checks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .gte('check_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      // Fetch maintenance records count
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

      // Fetch recent documents
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

      // Build recent activity from various sources
      const activity: RecentActivity[] = [];

      // Add recent check activity
      const { data: recentChecks } = await supabase
        .from('inspection_checks')
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

      // Add recent maintenance activity
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
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const demoFeatures = [
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Document Management",
      description: "Store and organize all your ride documents, certificates, and technical bulletins",
      status: stats.totalDocuments > 0 ? "active" : "pending",
      count: `${stats.totalDocuments} documents`
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Safety Compliance",
      description: "Track safety inspections and ensure all rides meet regulatory requirements",
      status: stats.upcomingInspections > 0 ? "warning" : "active",
      count: stats.upcomingInspections > 0 ? `${stats.upcomingInspections} due soon` : "All current"
    },
    {
      icon: <Calendar className="w-6 h-6" />,
      title: "Inspection Schedule",
      description: "Never miss an inspection with automated reminders and scheduling",
      status: "active",
      count: `${stats.recentChecks} this week`
    },
    {
      icon: <Wrench className="w-6 h-6" />,
      title: "Maintenance Tracking",
      description: "Keep detailed records of all maintenance activities and costs",
      status: "active",
      count: `${stats.maintenanceRecords} records`
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-12">
          <div className="text-center mb-12">
            <Skeleton className="h-12 w-64 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-12">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <h1 className="text-4xl md:text-5xl font-bold">
              Operations Overview
            </h1>
            <Badge variant={userPlan === 'trial' ? 'secondary' : 'default'}>
              {userPlan}
            </Badge>
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Your complete operations dashboard at a glance
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-primary mb-2">{stats.totalDocuments}</div>
              <div className="text-sm text-muted-foreground">Total Documents</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-primary mb-2">{stats.activeRides}</div>
              <div className="text-sm text-muted-foreground">Active Rides</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-primary mb-2">{stats.recentChecks}</div>
              <div className="text-sm text-muted-foreground">Checks This Week</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-primary mb-2">{stats.upcomingInspections}</div>
              <div className="text-sm text-muted-foreground">Due Soon</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Features */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-2xl font-semibold flex items-center">
                  <BarChart3 className="w-6 h-6 mr-2 text-primary" />
                  System Status
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                {demoFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="text-primary mt-1">{feature.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{feature.title}</h3>
                        <Badge variant={feature.status === "warning" ? "destructive" : "secondary"}>
                          {feature.count}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                    <div className="mt-1">
                      {feature.status === "warning" ? (
                        <AlertCircle className="w-5 h-5 text-orange-500" />
                      ) : feature.status === "pending" ? (
                        <Clock className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Documents */}
            {recentDocs.length > 0 && (
              <Card>
                <CardHeader>
                  <h2 className="text-2xl font-semibold flex items-center">
                    <FileText className="w-6 h-6 mr-2 text-primary" />
                    Recent Documents
                  </h2>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentDocs.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{doc.name}</div>
                            <div className="text-sm text-muted-foreground">{doc.date}</div>
                          </div>
                        </div>
                        <Badge variant="secondary">
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
            {recentActivity.length > 0 && (
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-primary" />
                    Recent Activity
                  </h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-sm">{activity.title}</div>
                        <div className="text-xs text-muted-foreground">{activity.time}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold">Quick Actions</h2>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" onClick={() => navigate('/dashboard?tab=workspace')}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
                {userPlan !== 'basic' && (
                  <Button className="w-full" variant="outline" onClick={() => navigate('/checks')}>
                    <Calendar className="w-4 h-4 mr-2" />
                    Start Daily Check
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Overview;