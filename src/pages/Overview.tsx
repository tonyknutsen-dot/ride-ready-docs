import { useNavigate } from "react-router-dom";
import {
  FileText, ShieldCheck, Calendar, Wrench, Cog, CheckSquare,
  Settings, Bell, AlertTriangle, ChevronRight, Clock, ClipboardCheck, Zap
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import appLogo from "@/assets/app-logo.jpg";
import type { DueSoonItem } from "@/hooks/useOverviewData";

const getDueSoonColor = (daysUntil: number): string => {
  if (daysUntil < 0) return 'text-destructive';
  if (daysUntil <= 7) return 'text-destructive';
  if (daysUntil <= 14) return 'text-warning';
  return 'text-[#475569]';
};

const getDueSoonDot = (daysUntil: number): string => {
  if (daysUntil < 0) return 'bg-destructive';
  if (daysUntil <= 7) return 'bg-destructive';
  if (daysUntil <= 14) return 'bg-warning';
  return 'bg-[#3B82F6]';
};

const getDueSoonLabel = (daysUntil: number): string => {
  if (daysUntil < 0) return `${Math.abs(daysUntil)}d overdue`;
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `${daysUntil} days`;
};

const getTypeIcon = (type: DueSoonItem['type']) => {
  switch (type) {
    case 'inspection': return ClipboardCheck;
    case 'document': return FileText;
    case 'ndt': return Zap;
    case 'maintenance': return Wrench;
    default: return Calendar;
  }
};

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
  const complianceAlerts = data?.complianceAlerts ?? [];
  const dueSoonItems = data?.dueSoonItems ?? [];

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
    { icon: Cog,         label: "Equipment",     path: "/rides",            badge: 0 },
    { icon: CheckSquare, label: "Checks",         path: "/checks",           badge: 0 },
    { icon: FileText,    label: "Documents",      path: "/documents",        badge: 0 },
    { icon: Wrench,      label: "Maintenance",    path: "/maintenance",      badge: 0 },
    { icon: Calendar,    label: "Calendar",       path: "/calendar",         badge: 0 },
    { icon: ShieldCheck, label: "Assessments",    path: "/risk-assessments", badge: 0 },
    { icon: Bell,        label: "Notifications",  path: "/notifications",    badge: unreadCount },
    { icon: Settings,    label: "Settings",       path: "/settings",         badge: 0 },
  ];

  const hasAlerts = complianceAlerts.length > 0;

  return (
    <>
      <WelcomeModal />
      <StaffAccountBanner />
      <PullToRefresh onRefresh={handleRefresh} disabled={isLoading}>
        <div className="container mx-auto py-6 pb-24 md:pb-8 space-y-4">
          <DeviceHintBanner />

          {/* ── HEADER ─────────────────────────────── */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              <img
                src={appLogo}
                alt="Ride Ready Docs"
                className="h-11 w-11 rounded-2xl object-cover shadow-card shrink-0 border border-border/30"
              />
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">Dashboard</h1>
                <Badge
                  variant={userPlan === 'trial' ? 'secondary' : 'default'}
                  className={`text-[10px] mt-0.5 ${userPlan !== 'trial' ? 'bg-primary/10 text-primary border-primary/20' : ''}`}
                >
                  {formatPlanWithDescription(userPlan)}
                </Badge>
              </div>
            </div>

            {/* Bell with unread badge */}
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-2.5 rounded-xl border border-border bg-card hover:border-primary hover:bg-[#F1F5F9] transition-all"
            >
              <Bell className="h-5 w-5 text-[#475569]" strokeWidth={2} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          <ItemLimitWarning />

          {/* ── COMPLIANCE ALERT BANNER ────────────── */}
          {hasAlerts && (
            <button
              onClick={() => navigate('/notifications')}
              className="w-full text-left bg-[#FEF2F2] border border-[#FCA5A5] rounded-[14px] px-4 py-3.5 space-y-1.5 hover:border-[#F87171] transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#DC2626]" strokeWidth={2} />
                  <span className="text-sm font-semibold text-[#991B1B]">Compliance Alerts</span>
                </div>
                <ChevronRight className="h-4 w-4 text-[#DC2626]" />
              </div>
              <div className="space-y-0.5 pl-6">
                {complianceAlerts.map((alert, i) => (
                  <p key={i} className="text-xs text-[#B91C1C] font-medium">⚠ {alert.label}</p>
                ))}
              </div>
            </button>
          )}

          {/* ── KPI STRIP ──────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Equipment',
                value: stats.activeRides,
                icon: Cog,
                path: '/rides',
                dot: null,
              },
              {
                label: 'Documents',
                value: stats.totalDocuments,
                icon: FileText,
                path: '/documents',
                dot: (data?.expiredDocsCount ?? 0) > 0 ? 'red' : (data?.complianceAlerts?.some(a => a.type === 'due_soon') ? 'amber' : 'green'),
              },
              {
                label: 'Checks (7d)',
                value: stats.recentChecks,
                icon: CheckSquare,
                path: '/checks',
                dot: null,
              },
              {
                label: 'Maintenance',
                value: stats.maintenanceRecords,
                icon: Wrench,
                path: '/maintenance',
                dot: null,
              },
            ].map(({ label, value, icon: Icon, path, dot }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className="flex flex-col gap-2 p-4 rounded-2xl border border-[#E2E8F0] bg-white shadow-sm hover:border-[#1E3A5F] hover:bg-[#F1F5F9] active:scale-[0.97] transition-all text-left"
              >
                <div className="flex items-center justify-between w-full">
                  <Icon className="h-5 w-5 text-[#475569]" strokeWidth={2} />
                  {dot && (
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      dot === 'red' ? 'bg-destructive' : dot === 'amber' ? 'bg-warning' : 'bg-success'
                    }`} />
                  )}
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#0F172A] leading-none">{value}</div>
                  <div className="text-xs text-[#64748B] font-medium mt-0.5">{label}</div>
                </div>
              </button>
            ))}
          </div>

          {/* ── DUE SOON PANEL ─────────────────────── */}
          {dueSoonItems.length > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#475569]" strokeWidth={2} />
                  <span className="text-sm font-semibold text-[#0F172A]">Due Soon</span>
                </div>
                <button
                  onClick={() => navigate('/calendar')}
                  className="flex items-center gap-1 text-xs text-[#1E3A5F] font-semibold hover:underline"
                >
                  View calendar <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-2">
                {dueSoonItems.map((item, i) => {
                  const Icon = getTypeIcon(item.type);
                  return (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getDueSoonDot(item.daysUntil)}`} />
                      <Icon className="h-3.5 w-3.5 text-[#475569] flex-shrink-0" strokeWidth={2} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-[#0F172A] block truncate">{item.label}</span>
                        {item.rideName && (
                          <span className="text-[11px] text-[#64748B] truncate block">{item.rideName}</span>
                        )}
                      </div>
                      <span className={`text-xs font-semibold flex-shrink-0 ${getDueSoonColor(item.daysUntil)}`}>
                        {getDueSoonLabel(item.daysUntil)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── NAVIGATION GRID ────────────────────── */}
          <div className="grid grid-cols-4 gap-3">
            {quickNavItems.map(item => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-[#E2E8F0] bg-white active:scale-[0.96] transition-all hover:border-[#1E3A5F] hover:bg-[#F1F5F9] group relative"
              >
                <div className="relative">
                  <item.icon className="h-6 w-6 text-[#475569] group-hover:text-[#1E3A5F] transition-colors" strokeWidth={2} />
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-0.5">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-[#0F172A] text-center leading-tight">{item.label}</span>
              </button>
            ))}
          </div>

        </div>
      </PullToRefresh>
    </>
  );
};

export default Overview;
