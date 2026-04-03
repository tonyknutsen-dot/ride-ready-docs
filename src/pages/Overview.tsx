import { useNavigate } from "react-router-dom";
import { TrialStatus } from "@/components/TrialStatus";
import { useSubscription } from "@/hooks/useSubscription";
import {
  FileText, Cog, Calendar, Wrench, CheckSquare,
  Settings, Bell, AlertTriangle, ChevronRight, ShieldCheck,
  Wind, Gauge,
} from "lucide-react";
import { formatPlanWithDescription } from "@/utils/planFormatter";
import { ItemLimitWarning } from "@/components/ItemLimitWarning";

import { StatSkeleton, GridSkeleton } from "@/components/Skeletons";
import { useOverviewData } from "@/hooks/useOverviewData";
import { useCallback } from "react";
import { PullToRefresh } from "@/components/PullToRefresh";
import { WelcomeModal } from "@/components/WelcomeModal";
import StaffAccountBanner from "@/components/StaffAccountBanner";
import NeedsAttentionPanel from "@/components/NeedsAttentionPanel";
import DefectReportDialog from "@/components/DefectReportDialog";
import { Badge } from "@/components/ui/badge";
import appLogo from "@/assets/app-logo.jpg";
import { useActionNeededCount } from "@/hooks/useActionNeededCount";
import { useStaff } from "@/contexts/StaffContext";

const Overview = () => {
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useOverviewData();
  const actionNeededCount = useActionNeededCount();
  const { subscription } = useSubscription();
  const {
    isStaff,
    isOwner,
    staffMembership,
    canAccessDocuments,
    canAccessMaintenance,
    canAccessChecks,
    canAccessRiskAssessments,
    canAccessCalendar,
    canAccessSettings,
  } = useStaff();

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
      <div className="container mx-auto py-8 pb-24 md:pb-8 space-y-6">
        <div className="mb-6 space-y-2">
          <div className="h-7 w-48 bg-muted rounded animate-pulse" />
          <div className="h-5 w-64 bg-muted rounded animate-pulse" />
        </div>
        <StatSkeleton count={3} />
        <GridSkeleton count={4} columns={4} />
      </div>
    );
  }

  const hasActionNeeded = actionNeededCount > 0;

  // ── Build permission-filtered quick actions ──
  const quickActions = [
    canAccessChecks && {
      key: 'checks',
      icon: CheckSquare,
      label: 'Start Check',
      sublabel: 'Daily / pre-use check',
      onClick: () => navigate('/checks'),
    },
    {
      key: 'defect',
      icon: AlertTriangle,
      label: 'Report Defect',
      sublabel: 'Log an issue',
      isDefectDialog: true,
    },
    canAccessDocuments && {
      key: 'documents',
      icon: FileText,
      label: 'Upload Document',
      sublabel: 'Add a certificate',
      onClick: () => navigate('/documents'),
    },
    canAccessMaintenance && {
      key: 'maintenance',
      icon: Wrench,
      label: 'Log Maintenance',
      sublabel: 'Record a repair',
      onClick: () => navigate('/maintenance'),
    },
  ].filter(Boolean) as Array<{
    key: string;
    icon: typeof CheckSquare;
    label: string;
    sublabel: string;
    onClick?: () => void;
    isDefectDialog?: boolean;
  }>;

  // ── Build permission-filtered modules ──
  const modules = [
    { icon: Cog, label: "Equipment", path: "/rides", visible: true },
    { icon: CheckSquare, label: "Checks", path: "/checks", visible: canAccessChecks },
    { icon: FileText, label: "Documents", path: "/documents", visible: canAccessDocuments },
    { icon: Wrench, label: "Maintenance", path: "/maintenance", visible: canAccessMaintenance },
    { icon: ShieldCheck, label: "Assessments", path: "/risk-assessments", visible: canAccessRiskAssessments },
    { icon: Calendar, label: "Calendar", path: "/calendar", visible: canAccessCalendar },
    { icon: Bell, label: "Notifications", path: "/notifications", visible: !isStaff },
    { icon: Settings, label: "Settings", path: "/settings", visible: canAccessSettings },
  ].filter(m => m.visible);

  // ── Build permission-filtered stat cards ──
  const statCards = [
    {
      label: 'Equipment',
      value: stats.activeRides,
      icon: Cog,
      path: '/rides',
      visible: true,
    },
    {
      label: 'Open Defects',
      value: data?.openDefectsCount ?? 0,
      icon: AlertTriangle,
      path: '/defects',
      search: '?status=open',
      accent: (data?.openDefectsCount ?? 0) > 0,
      visible: true,
    },
    {
      label: 'Docs Expiring',
      value: (data?.expiredDocsCount ?? 0) + ((data?.complianceAlerts ?? []).find(a => a.type === 'due_soon')?.count ?? 0),
      icon: FileText,
      path: '/documents',
      accent: (data?.expiredDocsCount ?? 0) > 0,
      visible: canAccessDocuments,
    },
  ].filter(s => s.visible);

  return (
    <>
      <WelcomeModal />
      <StaffAccountBanner />
      <PullToRefresh onRefresh={handleRefresh} disabled={isLoading}>
        <div className="container mx-auto py-6 pb-24 md:pb-8 space-y-5" style={{ backgroundColor: 'hsl(210 40% 95%)' }}>
          {/* ── HEADER ─────────────────────────────── */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              <img
                src={appLogo}
                alt="Ride Ready Docs"
                className="h-11 w-11 rounded-2xl object-cover shadow-card shrink-0 border border-border/30"
              />
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  {isStaff ? 'My Shift' : 'Dashboard'}
                </h1>
                {/* Staff: show org name. Owner: show plan badge */}
                {isStaff ? (
                  <span className="text-xs text-muted-foreground">
                    {staffMembership?.organisationName}
                  </span>
                ) : (
                  <Badge
                    variant={userPlan === 'trial' ? 'secondary' : 'default'}
                    className={`text-[10px] mt-0.5 ${
                      subscription?.subscriptionStatus === 'past_due'
                        ? 'bg-destructive/10 text-destructive border-destructive/30'
                        : subscription?.cancelAtPeriodEnd
                        ? 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]'
                        : userPlan !== 'trial' ? 'bg-primary/10 text-primary border-primary/20' : ''
                    }`}
                  >
                    {subscription?.subscriptionStatus === 'past_due'
                      ? 'Payment Failed'
                      : subscription?.cancelAtPeriodEnd
                      ? 'Cancelling'
                      : formatPlanWithDescription(userPlan)}
                  </Badge>
                )}
              </div>
            </div>

            <button
              onClick={() => navigate('/notifications')}
              className={`relative p-2.5 rounded-xl border bg-card hover:bg-secondary transition-all ${
                hasActionNeeded ? 'border-destructive/40 hover:border-destructive' : 'border-border hover:border-primary'
              }`}
            >
              <Bell className={`h-5 w-5 ${hasActionNeeded ? 'text-destructive' : 'text-muted-foreground'}`} strokeWidth={2} />
              {hasActionNeeded && (
                <span className={`absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 ${
                  hasActionNeeded
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-primary text-primary-foreground'
                }`}>
                  {actionNeededCount > 99 ? '99+' : actionNeededCount}
                </span>
              )}
            </button>
          </div>

          {/* ── Subtle action-needed hint ──────────── */}
          {hasActionNeeded && (
            <button
              onClick={() => navigate('/notifications?tab=action')}
              className="w-full flex items-center gap-2 px-1 py-0.5 text-left"
            >
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{actionNeededCount}</span> {actionNeededCount === 1 ? 'item needs' : 'items need'} attention
              </span>
              <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
            </button>
          )}

          {/* Owner-only: trial/billing warnings */}
          {!isStaff && <TrialStatus onUpgrade={() => navigate('/billing')} />}
          {!isStaff && <ItemLimitWarning />}

          {/* ── STATS — permission-filtered ─────────── */}
          <div className={`grid gap-3 ${statCards.length >= 3 ? 'grid-cols-3' : statCards.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {statCards.map(({ label, value, icon: Icon, path, accent, search: searchStr }) => (
              <button
                key={label}
                onClick={() => navigate({ pathname: path, search: searchStr })}
                className="flex flex-col items-center gap-1.5 p-4 rounded-2xl border border-border bg-card hover:border-primary active:scale-[0.97] transition-all"
                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
              >
                <Icon className={`h-5 w-5 ${accent ? 'text-destructive' : 'text-muted-foreground'}`} strokeWidth={2} />
                <span className={`text-2xl font-bold leading-none ${accent ? 'text-destructive' : 'text-foreground'}`}>{value}</span>
                <span className="text-[10px] font-medium text-muted-foreground text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>

          {/* ── NEEDS ATTENTION ─────────────────────── */}
          <NeedsAttentionPanel />

          {/* ── QUICK ACTIONS ──────────────────────── */}
          {quickActions.length > 0 && (
            <div>
              <h2 className="text-[13px] font-bold text-foreground mb-2 tracking-[1px] uppercase">Quick Actions</h2>
              <div className="h-px bg-border mb-4" />

              <div className={`grid gap-3 ${quickActions.length >= 4 ? 'grid-cols-2' : quickActions.length === 3 ? 'grid-cols-2' : quickActions.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {quickActions.map((action) => {
                  const ActionIcon = action.icon;

                  if (action.isDefectDialog) {
                    return (
                      <DefectReportDialog
                        key={action.key}
                        trigger={
                          <button
                            className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary active:scale-[0.97] transition-all text-left"
                            style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
                          >
                            <ActionIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={2} />
                            <div>
                              <span className="text-sm font-medium text-foreground">{action.label}</span>
                              <span className="text-[11px] text-muted-foreground block mt-0.5">{action.sublabel}</span>
                            </div>
                          </button>
                        }
                      />
                    );
                  }

                  return (
                    <button
                      key={action.key}
                      onClick={action.onClick}
                      className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary active:scale-[0.97] transition-all text-left"
                      style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
                    >
                      <ActionIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={2} />
                      <div>
                        <span className="text-sm font-medium text-foreground">{action.label}</span>
                        <span className="text-[11px] text-muted-foreground block mt-0.5">{action.sublabel}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── NAVIGATE MODULES — permission-filtered ── */}
          {modules.length > 0 && (
            <div>
              <h2 className="text-[13px] font-bold text-foreground mb-2 tracking-[1px] uppercase">Modules</h2>
              <div className="h-px bg-border mb-4" />

              <div className="grid grid-cols-4 gap-3">
                {modules.map(item => (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.path)}
                    className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border border-border bg-card active:scale-[0.96] transition-all hover:border-primary/50 hover:bg-secondary group"
                    style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
                  >
                    <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={2} />
                    <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground text-center leading-tight transition-colors">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </PullToRefresh>
    </>
  );
};

export default Overview;
