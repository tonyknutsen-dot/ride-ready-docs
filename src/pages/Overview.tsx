import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { FileText, Shield, Calendar, Upload, CheckCircle, Wrench, ArrowRight, FerrisWheel, ClipboardCheck, Settings, Bell } from "lucide-react";
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
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import appLogo from "@/assets/app-logo.jpg";

const Overview = () => {
  const navigate = useNavigate();
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);

  const { data, isLoading, refetch } = useOverviewData();
  const unreadCount = useUnreadNotifications();

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
  const userPlan = data?.userPlan ?? 'trial';

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

  const quickNavItems = [
    { icon: FerrisWheel, label: "Equipment", path: "/rides", color: "text-primary", bg: "bg-primary/10 border-primary/20" },
    { icon: ClipboardCheck, label: "Checks", path: "/checks", color: "text-success", bg: "bg-success/10 border-success/20" },
    { icon: FileText, label: "Documents", path: "/documents", color: "text-info", bg: "bg-info/10 border-info/20" },
    { icon: Wrench, label: "Maintenance", path: "/maintenance", color: "text-accent", bg: "bg-accent/10 border-accent/20" },
    { icon: Calendar, label: "Calendar", path: "/calendar", color: "text-primary", bg: "bg-primary/10 border-primary/20" },
    { icon: Shield, label: "Assessments", path: "/risk-assessments", color: "text-destructive", bg: "bg-destructive/10 border-destructive/20" },
    { icon: Bell, label: "Notifications", path: "/notifications", color: "text-warning", bg: "bg-warning/10 border-warning/20", badge: unreadCount },
    { icon: Settings, label: "Settings", path: "/settings", color: "text-muted-foreground", bg: "bg-muted border-border" },
  ];

  return (
    <>
    <WelcomeModal />
    <StaffAccountBanner />
    <PullToRefresh onRefresh={handleRefresh} disabled={isLoading}>
    <div className="container mx-auto py-6 pb-24 md:pb-8 space-y-6">
      <DeviceHintBanner />

      {/* Header — App logo + title + plan badge */}
      <div className="flex items-center gap-4 py-2">
        <img
          src={appLogo}
          alt="Ride Ready Docs"
          className="h-12 w-12 rounded-2xl object-cover shadow-card shrink-0 border border-border/30"
        />
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <Badge
            variant={userPlan === 'trial' ? 'secondary' : 'default'}
            className={`text-[11px] mt-0.5 ${userPlan !== 'trial' ? 'bg-primary/10 text-primary border-primary/20' : ''}`}
          >
            {formatPlanWithDescription(userPlan)}
          </Badge>
        </div>
      </div>

      <ItemLimitWarning />

      {/* PRIMARY ACTION — Start a Check */}
      <Card
        className="group cursor-pointer border-2 border-success/40 bg-gradient-to-r from-success/5 to-success/15 hover:shadow-elegant transition-all active:scale-[0.98] rounded-2xl"
        onClick={() => navigate('/checks')}
      >
        <CardContent className="p-5 flex items-center gap-4">
          <div className="p-3.5 bg-success/20 rounded-2xl group-hover:bg-success/30 transition-colors">
            <CheckCircle className="h-8 w-8 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-success">Start Safety Check</h2>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">Pre-opening, daily, monthly or yearly checks</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-success">{stats.recentChecks}</p>
            <p className="text-[10px] text-muted-foreground font-semibold">This week</p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Navigation Grid */}
      <div className="grid grid-cols-4 gap-3">
        {quickNavItems.map(item => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-2xl border bg-card hover:shadow-card-hover active:scale-[0.96] transition-all group relative"
          >
            <div className={`p-2.5 sm:p-3 rounded-xl border ${item.bg} group-hover:scale-110 transition-transform relative`}>
              <item.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${item.color}`} />
              {'badge' in item && item.badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </div>
            <span className="text-[11px] sm:text-xs font-semibold text-foreground/80 text-center leading-tight">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Stats Grid — 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="group hover:shadow-card-hover transition-all cursor-pointer rounded-2xl border-primary/15" onClick={() => navigate('/rides')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-primary/10 rounded-xl">
                <FerrisWheel className="h-4 w-4 text-primary" />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-primary/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl font-bold text-primary">{stats.activeRides}</div>
            <div className="text-[11px] text-muted-foreground font-medium">Equipment</div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-card-hover transition-all cursor-pointer rounded-2xl border-info/15" onClick={() => navigate('/documents')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-info/10 rounded-xl">
                <FileText className="h-4 w-4 text-info" />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-info/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl font-bold text-info">{stats.totalDocuments}</div>
            <div className="text-[11px] text-muted-foreground font-medium">Documents</div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-card-hover transition-all cursor-pointer rounded-2xl border-warning/15" onClick={() => navigate('/maintenance')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-warning/10 rounded-xl">
                <Wrench className="h-4 w-4 text-warning" />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-warning/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl font-bold text-warning">{stats.maintenanceRecords}</div>
            <div className="text-[11px] text-muted-foreground font-medium">Maintenance</div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-card-hover transition-all cursor-pointer rounded-2xl border-destructive/15" onClick={() => navigate('/calendar')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-destructive/10 rounded-xl">
                <Calendar className="h-4 w-4 text-destructive" />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-destructive/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl font-bold text-destructive">{stats.upcomingInspections}</div>
            <div className="text-[11px] text-muted-foreground font-medium">Due Soon</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Upload */}
      <Button
        variant="outline"
        className="w-full h-12 rounded-2xl border-dashed border-2 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
        onClick={() => setShowDocumentUpload(true)}
      >
        <Upload className="h-4 w-4 mr-2" />
        Upload Document
      </Button>

      <QuickDocumentUpload open={showDocumentUpload} onOpenChange={setShowDocumentUpload} />
    </div>
    </PullToRefresh>
    </>
  );
};

export default Overview;
