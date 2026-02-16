import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { FileText, Shield, Calendar, Upload, BarChart3, CheckCircle, AlertCircle, Clock, Wrench, ArrowRight, TrendingUp } from "lucide-react";
import { QuickDocumentUpload } from "@/components/QuickDocumentUpload";
import { formatPlanWithDescription } from "@/utils/planFormatter";
import { ItemLimitWarning } from "@/components/ItemLimitWarning";
import DeviceHintBanner from "@/components/DeviceHintBanner";
import { StatSkeleton, GridSkeleton } from "@/components/Skeletons";
import { useOverviewData } from "@/hooks/useOverviewData";
import { useState, useCallback } from "react";
import { PullToRefresh } from "@/components/PullToRefresh";
import { WelcomeModal } from "@/components/WelcomeModal";
import StaffAccountBanner from "@/components/StaffAccountBanner";

const Overview = () => {
  const navigate = useNavigate();
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  
  const { data, isLoading, error, refetch } = useOverviewData();
  
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);
  
  const stats = data?.stats ?? {
    totalDocuments: 0,
    activeRides: 0,
    upcomingInspections: 0,
    recentChecks: 0,
    maintenanceRecords: 0
  };
  const recentDocs = data?.recentDocs ?? [];
  const recentActivity = data?.recentActivity ?? [];
  const userPlan = data?.userPlan ?? 'trial';

  const allFeatures = [
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
    },
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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 pb-24 md:pb-8 space-y-8">
        <div className="mb-8 space-y-2">
          <div className="h-7 w-48 bg-muted rounded animate-pulse" />
          <div className="h-5 w-64 bg-muted rounded animate-pulse" />
        </div>
        <StatSkeleton count={4} />
        <GridSkeleton count={3} columns={3} />
      </div>
    );
  }

  return (
    <>
    <WelcomeModal />
    <StaffAccountBanner />
    <PullToRefresh onRefresh={handleRefresh} disabled={isLoading}>
    <div className="container mx-auto py-8 pb-24 md:pb-8 space-y-8">
      <DeviceHintBanner />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">Overview</h1>
            <Badge 
              variant={userPlan === 'trial' ? 'secondary' : 'default'}
              className={userPlan !== 'trial' ? 'bg-primary/10 text-primary border-primary/20' : ''}
            >
              {formatPlanWithDescription(userPlan)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Your complete operations dashboard at a glance
          </p>
        </div>
      </div>

      <ItemLimitWarning />

      {/* PRIMARY ACTION - Start a Check */}
      <Card 
        className="group cursor-pointer border-2 border-success/50 bg-gradient-to-r from-success/10 via-success/15 to-success/20 hover:shadow-elegant transition-all active:scale-[0.98]"
        onClick={() => navigate('/checks')}
      >
        <CardContent className="p-6 flex items-center gap-5">
          <div className="p-4 bg-success/25 rounded-2xl group-hover:bg-success/35 transition-colors shadow-sm">
            <CheckCircle className="h-10 w-10 text-success" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-success mb-1">Start Safety Check</h2>
            <p className="text-sm text-muted-foreground">Perform pre-opening, daily, monthly or yearly checks on your equipment</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-success">{stats.recentChecks}</p>
            <p className="text-xs text-muted-foreground font-semibold">This week</p>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="group hover:shadow-elegant transition-all duration-300 cursor-pointer border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10" onClick={() => navigate('/rides')}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-primary/20 rounded-xl group-hover:bg-primary/30 transition-colors shadow-sm">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <ArrowRight className="h-4 w-4 text-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-primary mb-1">{stats.totalDocuments}</div>
            <div className="text-xs text-muted-foreground font-medium">Total Documents</div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-elegant transition-all duration-300 cursor-pointer border-accent/20 bg-gradient-to-br from-accent/5 to-accent/10" onClick={() => navigate('/rides')}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-accent/20 rounded-xl group-hover:bg-accent/30 transition-colors shadow-sm">
                <Wrench className="h-5 w-5 text-accent" />
              </div>
              <ArrowRight className="h-4 w-4 text-accent/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-accent mb-1">{stats.activeRides}</div>
            <div className="text-xs text-muted-foreground font-medium">Active Equipment</div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-elegant transition-all duration-300 cursor-pointer border-warning/20 bg-gradient-to-br from-warning/5 to-warning/10" onClick={() => navigate('/maintenance')}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-warning/20 rounded-xl group-hover:bg-warning/30 transition-colors shadow-sm">
                <Wrench className="h-5 w-5 text-warning" />
              </div>
              <ArrowRight className="h-4 w-4 text-warning/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-warning mb-1">{stats.maintenanceRecords}</div>
            <div className="text-xs text-muted-foreground font-medium">Maintenance</div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-elegant transition-all duration-300 cursor-pointer border-info/20 bg-gradient-to-br from-info/5 to-info/10" onClick={() => navigate('/calendar')}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-info/20 rounded-xl group-hover:bg-info/30 transition-colors shadow-sm">
                <Calendar className="h-5 w-5 text-info" />
              </div>
              <ArrowRight className="h-4 w-4 text-info/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-info mb-1">{stats.upcomingInspections}</div>
            <div className="text-xs text-muted-foreground font-medium">Due Soon</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/15 rounded-xl">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold">System Status</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {allFeatures.map((feature, index) => (
                <div key={index} className="flex items-start gap-4 p-4 border border-border rounded-xl bg-card hover:shadow-sm transition-all group">
                  <div className="text-primary mt-0.5 p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary/15 transition-colors">
                    {feature.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{feature.title}</h3>
                      <Badge variant="secondary" className="shrink-0 text-xs font-semibold bg-primary/10 text-primary border-0">
                        {feature.count}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                  <div className="mt-1 shrink-0">
                    {feature.status === "pending" ? (
                      <Clock className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-success" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

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
                    View all <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentDocs.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-1.5 bg-muted rounded-md">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{doc.name}</div>
                          <div className="text-xs text-muted-foreground">{doc.date}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs font-normal">{doc.type}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
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
              <Button className="w-full justify-start gap-3 h-11" variant="outline" onClick={() => setShowDocumentUpload(true)}>
                <Upload className="w-4 h-4 shrink-0" />
                <span className="truncate text-left">Upload Document</span>
              </Button>
              <Button className="w-full justify-start gap-3 h-11" variant="outline" onClick={() => navigate('/maintenance')}>
                <Wrench className="w-4 h-4 shrink-0" />
                <span className="truncate text-left">Maintenance</span>
              </Button>
              <Button className="w-full justify-start gap-3 h-11" variant="outline" onClick={() => navigate('/calendar')}>
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="truncate text-left">View Calendar</span>
              </Button>
            </CardContent>
          </Card>

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
        </div>
      </div>

      <QuickDocumentUpload open={showDocumentUpload} onOpenChange={setShowDocumentUpload} />
    </div>
    </PullToRefresh>
    </>
  );
};

export default Overview;
