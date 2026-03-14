import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { TrialStatus } from "@/components/TrialStatus";
import {
  FileText, Cog, Calendar, Wrench, CheckSquare,
  Settings, Bell, AlertTriangle, ChevronRight, Clock, ShieldCheck
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
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { useActionNeededCount } from "@/hooks/useActionNeededCount";

const Overview = () => {
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useOverviewData();
  const unreadCount = useUnreadNotifications();
  const actionNeededCount = useActionNeededCount();

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
  const hasBadge = unreadCount > 0;

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
                <h1 className="text-xl font-bold tracking-tight text-foreground">Dashboard</h1>
                <Badge
                  variant={userPlan === 'trial' ? 'secondary' : 'default'}
                  className={`text-[10px] mt-0.5 ${userPlan !== 'trial' ? 'bg-primary/10 text-primary border-primary/20' : ''}`}
                >
                  {formatPlanWithDescription(userPlan)}
                </Badge>
              </div>
            </div>

            <button
              onClick={() => navigate('/notifications')}
              className={`relative p-2.5 rounded-xl border bg-card hover:bg-secondary transition-all ${
                hasActionNeeded ? 'border-destructive/40 hover:border-destructive' : 'border-border hover:border-primary'
              }`}
            >
              <Bell className={`h-5 w-5 ${hasActionNeeded ? 'text-destructive' : 'text-muted-foreground'}`} strokeWidth={2} />
              {hasBadge && (
                <span className={`absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 ${
                  hasActionNeeded
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-primary text-primary-foreground'
                }`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
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

          <ItemLimitWarning />

          {/* ── STATS — 3 simple cards ──────────────── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Equipment',
                value: stats.activeRides,
                icon: Cog,
                path: '/rides',
              },
              {
                label: 'Open Defects',
                value: data?.openDefectsCount ?? 0,
                icon: AlertTriangle,
                path: '/defects',
                search: '?status=open',
                accent: (data?.openDefectsCount ?? 0) > 0,
              },
              {
                label: 'Docs Expiring',
                value: (data?.expiredDocsCount ?? 0) + ((data?.complianceAlerts ?? []).find(a => a.type === 'due_soon')?.count ?? 0),
                icon: FileText,
                path: '/documents',
                accent: (data?.expiredDocsCount ?? 0) > 0,
              },
            ].map(({ label, value, icon: Icon, path, accent, search: searchStr }) => (
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
          <div>
            <h2 className="text-[13px] font-bold text-foreground mb-2 tracking-[1px] uppercase">Quick Actions</h2>
            <div className="h-px bg-border mb-4" />

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/checks')}
                className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary active:scale-[0.97] transition-all text-left"
                style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
              >
                <CheckSquare className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={2} />
                <div>
                  <span className="text-sm font-medium text-foreground">Start Check</span>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">Daily / pre-use check</span>
                </div>
              </button>

              <DefectReportDialog
                trigger={
                  <button
                    className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary active:scale-[0.97] transition-all text-left"
                    style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
                  >
                    <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={2} />
                    <div>
                      <span className="text-sm font-medium text-foreground">Report Defect</span>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">Log an issue</span>
                    </div>
                  </button>
                }
              />

              <button
                onClick={() => navigate('/documents')}
                className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary active:scale-[0.97] transition-all text-left"
                style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
              >
                <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={2} />
                <div>
                  <span className="text-sm font-medium text-foreground">Upload Document</span>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">Add a certificate</span>
                </div>
              </button>

              <button
                onClick={() => navigate('/maintenance')}
                className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary active:scale-[0.97] transition-all text-left"
                style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
              >
                <Wrench className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={2} />
                <div>
                  <span className="text-sm font-medium text-foreground">Log Maintenance</span>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">Record a repair</span>
                </div>
              </button>
            </div>
          </div>

          {/* ── NAVIGATE MODULES ───────────────────── */}
          <div>
            <h2 className="text-[13px] font-bold text-foreground mb-2 tracking-[1px] uppercase">Modules</h2>
            <div className="h-px bg-border mb-4" />

            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: Cog,         label: "Equipment",     path: "/rides" },
                { icon: CheckSquare, label: "Checks",        path: "/checks" },
                { icon: FileText,    label: "Documents",     path: "/documents" },
                { icon: Wrench,      label: "Maintenance",   path: "/maintenance" },
                { icon: ShieldCheck, label: "Assessments",   path: "/risk-assessments" },
                { icon: Calendar,    label: "Calendar",      path: "/calendar" },
                { icon: Bell,        label: "Notifications", path: "/notifications" },
                { icon: Settings,    label: "Settings",      path: "/settings" },
              ].map(item => (
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

        </div>
      </PullToRefresh>
    </>
  );
};

export default Overview;
