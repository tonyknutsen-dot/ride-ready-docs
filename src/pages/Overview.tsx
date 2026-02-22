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
      <div className="container mx-auto py-8 pb-24 md:pb-8 space-y-6">
        <div className="mb-6 space-y-2">
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
        <div className="container mx-auto py-6 pb-24 md:pb-8 space-y-5" style={{ backgroundColor: 'hsl(210 40% 95%)' }}>
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
                <h1 className="text-xl font-bold tracking-tight text-foreground">Dashboard</h1>
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
              className="relative p-2.5 rounded-xl border border-border bg-card hover:border-primary hover:bg-secondary transition-all"
            >
              <Bell className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          <ItemLimitWarning />

          {/* ── OVERDUE COMPLIANCE BANNER (red) ────── */}
          {complianceAlerts.some(a => a.type === 'overdue' || a.type === 'expired') && (
            <button
              onClick={() => navigate('/compliance')}
              className="w-full text-left rounded-2xl px-4 py-3.5 space-y-1.5 transition-all shadow-sm"
              style={{
                backgroundColor: 'hsl(0 72% 96%)',
                border: '1px solid hsl(0 72% 80%)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" strokeWidth={2} />
                  <span className="text-sm font-bold text-destructive">Overdue Compliance Items</span>
                </div>
                <ChevronRight className="h-4 w-4 text-destructive/70" />
              </div>
              <div className="space-y-0.5 pl-6">
                {complianceAlerts.filter(a => a.type === 'overdue' || a.type === 'expired').map((alert, i) => (
                  <p key={i} className="text-xs font-medium" style={{ color: 'hsl(0 72% 40%)' }}>⚠ {alert.label}</p>
                ))}
              </div>
            </button>
          )}

          {/* ── DUE SOON BANNER (amber, no red items) ── */}
          {!complianceAlerts.some(a => a.type === 'overdue' || a.type === 'expired') && complianceAlerts.some(a => a.type === 'due_soon') && (
            <button
              onClick={() => navigate('/compliance')}
              className="w-full text-left rounded-2xl px-4 py-3.5 space-y-1.5 transition-all shadow-sm"
              style={{
                backgroundColor: 'hsl(38 92% 96%)',
                border: '1px solid hsl(38 92% 70%)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: 'hsl(38 80% 40%)' }} strokeWidth={2} />
                  <span className="text-sm font-bold" style={{ color: 'hsl(38 80% 30%)' }}>Due Soon</span>
                </div>
                <ChevronRight className="h-4 w-4" style={{ color: 'hsl(38 80% 50%)' }} />
              </div>
              <div className="space-y-0.5 pl-6">
                {complianceAlerts.filter(a => a.type === 'due_soon').map((alert, i) => (
                  <p key={i} className="text-xs font-medium" style={{ color: 'hsl(38 80% 35%)' }}>{alert.label}</p>
                ))}
              </div>
            </button>
          )}

          {/* ── COMPLIANCE OVERVIEW SECTION ────────── */}
          <div>
            <h2 className="text-[13px] font-bold text-foreground mb-2 tracking-[1px] uppercase">Compliance Overview</h2>
            <div className="h-px bg-border mb-4" />

            {/* KPI STRIP */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: 'Equipment',
                  value: stats.activeRides,
                  icon: Cog,
                  path: '/rides',
                  dot: null,
                  accentColor: 'hsl(213 52% 24%)',
                  iconBg: 'hsl(217 91% 97%)',
                },
                {
                  label: 'Documents',
                  value: stats.totalDocuments,
                  icon: FileText,
                  path: '/documents',
                  dot: (data?.expiredDocsCount ?? 0) > 0 ? 'red' : (data?.complianceAlerts?.some(a => a.type === 'due_soon') ? 'amber' : 'green'),
                  accentColor: (data?.expiredDocsCount ?? 0) > 0 ? 'hsl(0 72% 51%)' : (data?.complianceAlerts?.some(a => a.type === 'due_soon') ? 'hsl(38 92% 50%)' : 'hsl(142 76% 36%)'),
                  iconBg: (data?.expiredDocsCount ?? 0) > 0 ? 'hsl(0 72% 96%)' : (data?.complianceAlerts?.some(a => a.type === 'due_soon') ? 'hsl(38 92% 96%)' : 'hsl(142 76% 96%)'),
                },
                {
                  label: 'Checks (7d)',
                  value: stats.recentChecks,
                  icon: CheckSquare,
                  path: '/checks',
                  dot: null,
                  accentColor: 'hsl(213 52% 24%)',
                  iconBg: 'hsl(217 91% 97%)',
                },
                {
                  label: 'Maintenance',
                  value: stats.maintenanceRecords,
                  icon: Wrench,
                  path: '/maintenance',
                  dot: null,
                  accentColor: 'hsl(213 52% 24%)',
                  iconBg: 'hsl(217 91% 97%)',
                },
              ].map(({ label, value, icon: Icon, path, dot, accentColor, iconBg }) => (
                <button
                  key={label}
                  onClick={() => navigate(path)}
                  className="flex flex-col gap-3 p-4 rounded-2xl border border-border bg-white hover:border-primary active:scale-[0.97] transition-all text-left overflow-hidden relative"
                  style={{ boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}
                >
                  {/* Coloured top accent bar — 4px thick */}
                  <span className="absolute top-0 left-0 right-0 h-[4px] rounded-t-2xl" style={{ backgroundColor: accentColor }} />
                  <div className="flex items-center justify-between w-full mt-1">
                    {/* Icon chip */}
                    <span className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ backgroundColor: iconBg }}>
                      <Icon className="h-[22px] w-[22px]" strokeWidth={2} style={{ color: accentColor }} />
                    </span>
                    {dot && (
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        dot === 'red' ? 'bg-destructive' : dot === 'amber' ? 'bg-warning' : 'bg-success'
                      }`} />
                    )}
                  </div>
                  <div>
                    <div className="text-[34px] font-bold leading-none" style={{ color: 'hsl(222 84% 4%)' }}>{value}</div>
                    <div className="text-xs font-medium mt-1.5" style={{ color: 'hsl(215 19% 40%)' }}>{label}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── DUE SOON PANEL ─────────────────────── */}
          {dueSoonItems.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ backgroundColor: 'hsl(213 52% 24% / 0.1)' }}>
                    <Clock className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                  </span>
                  <span className="text-sm font-semibold text-foreground">Due Soon</span>
                </div>
                <button
                  onClick={() => navigate('/calendar')}
                  className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                >
                  View calendar <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-1">
                {dueSoonItems.map((item, i) => {
                  const Icon = getTypeIcon(item.type);
                  return (
                    <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getDueSoonDot(item.daysUntil)}`} />
                      <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" strokeWidth={2} />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-foreground block truncate">{item.label}</span>
                        {item.rideName && (
                          <span className="text-[11px] text-muted-foreground truncate block">{item.rideName}</span>
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

          {/* ── MANAGE MODULES SECTION ─────────────── */}
          <div>
            <h2 className="text-[13px] font-bold text-foreground mb-2 tracking-[1px] uppercase">Manage Modules</h2>
            <div className="h-px bg-border mb-4" />

            <div className="grid grid-cols-4 gap-3">
              {quickNavItems.map(item => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border border-border bg-white active:scale-[0.96] transition-all hover:border-primary/50 hover:bg-secondary group relative"
                  style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
                >
                  <div className="relative">
                    <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={2} />
                    {item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-0.5">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground text-center leading-tight transition-colors">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </PullToRefresh>
    </>
  );
};

export default Overview;
