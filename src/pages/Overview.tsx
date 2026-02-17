import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { FileText, Shield, Calendar, Wrench, ArrowRight, FerrisWheel, ClipboardCheck, Settings, Bell } from "lucide-react";
import { formatPlanWithDescription } from "@/utils/planFormatter";
import { ItemLimitWarning } from "@/components/ItemLimitWarning";
import DeviceHintBanner from "@/components/DeviceHintBanner";
import { StatSkeleton, GridSkeleton } from "@/components/Skeletons";
import { useOverviewData } from "@/hooks/useOverviewData";
import { useCallback } from "react";
import { PullToRefresh } from "@/components/PullToRefresh";
import { WelcomeModal } from "@/components/WelcomeModal";
import StaffAccountBanner from "@/components/StaffAccountBanner";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import appLogo from "@/assets/app-logo.jpg";

const Overview = () => {
  const navigate = useNavigate();

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
    { icon: FerrisWheel, label: "Equipment", path: "/rides" },
    { icon: ClipboardCheck, label: "Checks", path: "/checks" },
    { icon: FileText, label: "Documents", path: "/documents" },
    { icon: Wrench, label: "Maintenance", path: "/maintenance" },
    { icon: Calendar, label: "Calendar", path: "/calendar" },
    { icon: Shield, label: "Assessments", path: "/risk-assessments" },
    { icon: Bell, label: "Notifications", path: "/notifications", badge: unreadCount },
    { icon: Settings, label: "Settings", path: "/settings" },
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


      {/* Quick Navigation Grid */}
      <div className="grid grid-cols-4 gap-3">
        {quickNavItems.map(item => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-primary bg-card active:scale-[0.96] transition-all group relative shadow-card hover:shadow-card-hover hover:-translate-y-0.5"
          >
            <div className="p-2 rounded-xl border border-primary bg-[#F1F5F9] group-hover:scale-105 transition-transform relative">
              <item.icon className="h-6 w-6 text-primary" />
              {'badge' in item && item.badge && item.badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-foreground text-center leading-tight">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Stats Grid — 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Equipment', value: stats.activeRides, icon: FerrisWheel, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', path: '/rides' },
          { label: 'Documents', value: stats.totalDocuments, icon: FileText, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', path: '/documents' },
          { label: 'Maintenance', value: stats.maintenanceRecords, icon: Wrench, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20', path: '/maintenance' },
          { label: 'Due Soon', value: stats.upcomingInspections, icon: Calendar, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20', path: '/calendar' },
        ].map(({ label, value, icon: Icon, color, bg, border, path }) => (
          <Card
            key={label}
            className={`group cursor-pointer transition-all rounded-2xl border ${border} bg-card shadow-sm hover:shadow-md overflow-hidden`}
            onClick={() => navigate(path)}
          >
            <CardContent className="p-4 relative">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 ${bg} rounded-xl`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
              </div>
              <div className={`text-3xl font-bold ${color} leading-none mb-1`}>{value}</div>
              <div className="text-xs text-muted-foreground font-medium">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
    </PullToRefresh>
    </>
  );
};

export default Overview;

