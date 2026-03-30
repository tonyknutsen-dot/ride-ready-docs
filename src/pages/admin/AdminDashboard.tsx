import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import {
  Layers, FileText, Users, FlaskConical, BarChart3, CheckCircle, FolderOpen,
  Loader2, MessageCircle, Bug, CreditCard, ArrowRight, AlertTriangle,
  ChevronDown, ChevronUp, Shield, Info, Lightbulb, Library, Activity,
  History, Mail, Wrench,
} from 'lucide-react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

interface DashboardStats {
  unansweredSupport: number;
  bugReportsNeedingTriage: number;
  featureRequestsPending: number;
  pendingRideRequests: number;
  pendingDocRequests: number;
  pendingCheckIntake: number;
  pendingRiskIntake: number;
  totalUsers: number;
  totalTesters: number;
  totalStaff: number;
  totalRides: number;
  totalDocuments: number;
  totalChecks: number;
  totalMaintenanceRecords: number;
  testRides: number;
  testDocuments: number;
  testChecks: number;
  testMaintenanceRecords: number;
}

interface PaymentSummary {
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  failedPaymentsCount: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    unansweredSupport: 0, bugReportsNeedingTriage: 0, featureRequestsPending: 0,
    pendingRideRequests: 0, pendingDocRequests: 0,
    pendingCheckIntake: 0, pendingRiskIntake: 0,
    totalUsers: 0, totalTesters: 0, totalStaff: 0,
    totalRides: 0, totalDocuments: 0, totalChecks: 0, totalMaintenanceRecords: 0,
    testRides: 0, testDocuments: 0, testChecks: 0, testMaintenanceRecords: 0,
  });
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [excludeTestData, setExcludeTestData] = useState(true);
  const { isOn: isPlatformOn } = usePlatformSettings();
  const [showTestData, setShowTestData] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [
          supportRes, bugRes, featureRes, rideRequests, docRequests,
          checkIntake, riskIntake,
          users, testers, staffMembers,
          allRides, testRides, allDocuments, testDocuments,
          allChecks, testChecks, allMaintenance, testMaintenance,
        ] = await Promise.all([
          supabase.from('support_messages').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          (supabase as any).from('bug_reports').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_progress']),
          (supabase as any).from('feature_requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_review']),
          supabase.from('ride_type_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('document_type_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          (supabase as any).from('user_submitted_check_items').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          (supabase as any).from('user_submitted_risk_items').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'tester'),
          supabase.from('organisation_members').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('rides').select('id', { count: 'exact', head: true }),
          supabase.from('rides').select('id', { count: 'exact', head: true }).eq('is_test_data', true),
          supabase.from('documents').select('id', { count: 'exact', head: true }),
          supabase.from('documents').select('id', { count: 'exact', head: true }).eq('is_test_data', true),
          supabase.from('checks').select('id', { count: 'exact', head: true }),
          supabase.from('checks').select('id', { count: 'exact', head: true }).eq('is_test_data', true),
          supabase.from('maintenance_records').select('id', { count: 'exact', head: true }),
          supabase.from('maintenance_records').select('id', { count: 'exact', head: true }).eq('is_test_data', true),
        ]);
        setStats({
          unansweredSupport: supportRes.count || 0,
          bugReportsNeedingTriage: bugRes.count || 0,
          featureRequestsPending: featureRes.count || 0,
          pendingRideRequests: rideRequests.count || 0,
          pendingDocRequests: docRequests.count || 0,
          pendingCheckIntake: checkIntake.count || 0,
          pendingRiskIntake: riskIntake.count || 0,
          totalUsers: users.count || 0,
          totalTesters: testers.count || 0,
          totalStaff: staffMembers.count || 0,
          totalRides: allRides.count || 0,
          totalDocuments: allDocuments.count || 0,
          totalChecks: allChecks.count || 0,
          totalMaintenanceRecords: allMaintenance.count || 0,
          testRides: testRides.count || 0,
          testDocuments: testDocuments.count || 0,
          testChecks: testChecks.count || 0,
          testMaintenanceRecords: testMaintenance.count || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchPayments = async () => {
      setPaymentLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('admin-stripe-data');
        if (!error && data?.summary) {
          setPaymentSummary({
            activeSubscriptions: data.summary.activeSubscriptions || 0,
            trialingSubscriptions: data.summary.trialingSubscriptions || 0,
            pastDueSubscriptions: data.summary.pastDueSubscriptions || 0,
            failedPaymentsCount: data.summary.failedPaymentsCount || 0,
          });
        }
      } catch {
        // Payment data is optional
      } finally {
        setPaymentLoading(false);
      }
    };

    fetchStats();
    fetchPayments();
  }, []);

  const hasTestData = stats.testRides > 0 || stats.testDocuments > 0 || stats.testChecks > 0 || stats.testMaintenanceRecords > 0;

  const displayedRides = excludeTestData ? stats.totalRides - stats.testRides : stats.totalRides;
  const displayedDocuments = excludeTestData ? stats.totalDocuments - stats.testDocuments : stats.totalDocuments;
  const displayedChecks = excludeTestData ? stats.totalChecks - stats.testChecks : stats.totalChecks;
  const displayedMaintenance = excludeTestData ? stats.totalMaintenanceRecords - stats.testMaintenanceRecords : stats.totalMaintenanceRecords;

  const paymentValue = (val: number | undefined) => {
    if (paymentLoading) return '…';
    if (paymentSummary === null) return '—';
    return val ?? 0;
  };

  // ─── TRIAGE ITEMS ───
  const triageItems = [
    { label: 'Unanswered Support Messages', count: stats.unansweredSupport, href: '/admin/support?status=pending', icon: MessageCircle, accent: 'destructive' as const, cta: 'Review & Respond' },
    { label: 'Bug Reports Needing Triage', count: stats.bugReportsNeedingTriage, href: '/admin/bug-reports?status=new,in_progress', icon: Bug, accent: 'warning' as const, cta: 'Triage Bugs' },
    { label: 'Feature Requests Pending', count: stats.featureRequestsPending, href: '/admin/feature-requests?status=pending,in_review', icon: Lightbulb, accent: 'primary' as const, cta: 'Review Requests' },
  ];

  // ─── LIBRARY APPROVAL ITEMS ───
  const libraryItems = [
    { label: 'Check Intake Queue', count: stats.pendingCheckIntake, href: '/admin/check-items?status=pending', icon: FileText, cta: 'Review' },
    { label: 'Risk Intake Queue', count: stats.pendingRiskIntake, href: '/admin/risk-items?status=pending', icon: AlertTriangle, cta: 'Review' },
    { label: 'Equipment Type Requests', count: stats.pendingRideRequests, href: '/admin/ride-requests?status=pending', icon: Layers, cta: 'Review' },
    { label: 'Document Type Requests', count: stats.pendingDocRequests, href: '/admin/document-requests?status=pending', icon: FileText, cta: 'Review' },
  ];

  const needsAttentionTotal = triageItems.reduce((s, i) => s + i.count, 0);
  const libraryTotal = libraryItems.reduce((s, i) => s + i.count, 0);

  const activeTriageItems = triageItems.filter(i => i.count > 0);
  const inactiveTriageItems = triageItems.filter(i => i.count === 0);
  const activeLibraryItems = libraryItems.filter(i => i.count > 0);
  const inactiveLibraryItems = libraryItems.filter(i => i.count === 0);

  const accentBorder = (accent: string) => {
    switch (accent) {
      case 'destructive': return 'border-l-destructive';
      case 'warning': return 'border-l-warning';
      default: return 'border-l-primary';
    }
  };
  const accentBg = (accent: string) => {
    switch (accent) {
      case 'destructive': return 'bg-destructive/10';
      case 'warning': return 'bg-warning/10';
      default: return 'bg-primary/10';
    }
  };
  const accentText = (accent: string) => {
    switch (accent) {
      case 'destructive': return 'text-destructive';
      case 'warning': return 'text-warning-foreground';
      default: return 'text-primary';
    }
  };

  const TriageRow = ({ item }: { item: typeof triageItems[0] }) => (
    <Link key={item.href} to={item.href} className="group block">
      <div className={`flex items-center justify-between gap-4 p-4 rounded-lg border border-l-4 ${accentBorder(item.accent)} bg-card hover:bg-accent/5 transition-colors`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg ${accentBg(item.accent)} shrink-0`}>
            <item.icon className={`h-4 w-4 ${accentText(item.accent)}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold leading-none">{item.count}</span>
              <span className="text-sm font-medium text-foreground truncate">{item.label}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors shrink-0">
          <span className="hidden sm:inline">{item.cta}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );

  const QueueRow = ({ item }: { item: typeof libraryItems[0] }) => (
    <Link to={item.href} className="group block">
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-l-4 border-l-primary/40 bg-card hover:bg-accent/5 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <item.icon className="h-4 w-4 text-primary/60 shrink-0" />
          <span className="text-sm font-medium truncate">{item.label}</span>
          <Badge variant="secondary" className="text-xs shrink-0">{item.count}</Badge>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </div>
    </Link>
  );

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-bold leading-tight">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Operational control panel — triage first, then review health and approvals.
            </p>
          </div>
          {hasTestData && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border/60 bg-muted/20 text-xs shrink-0">
              <FlaskConical className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
              <Label htmlFor="exclude-test-data" className="text-xs cursor-pointer whitespace-nowrap text-muted-foreground">Production only</Label>
              <Tooltip>
                <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help shrink-0" /></TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px] text-xs">Excludes test rides, documents, checks, and maintenance from platform totals.</TooltipContent>
              </Tooltip>
              <Switch id="exclude-test-data" checked={excludeTestData} onCheckedChange={setExcludeTestData} className="scale-90" />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ─── 1. TRIAGE QUEUE ─── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Triage</h2>
                {needsAttentionTotal > 0 && (
                  <Badge variant="destructive" className="text-xs">{needsAttentionTotal} open</Badge>
                )}
              </div>
              {needsAttentionTotal === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-border/40 bg-muted/10">
                  <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                  <p className="text-sm text-muted-foreground">All clear — no items need attention right now.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeTriageItems.map(item => <TriageRow key={item.href} item={item} />)}
                  {inactiveTriageItems.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1">
                      {inactiveTriageItems.map(item => (
                        <Link key={item.href} to={item.href} className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1">
                          <item.icon className="h-3 w-3" /><span>{item.label}</span><span className="text-muted-foreground/40">· 0</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ─── 2. USERS & BILLING HEALTH ─── */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Users & Billing</h2>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Link to="/admin/users" className="group">
                  <Card className="h-full hover:border-primary/40 transition-colors">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Accounts</p>
                        <Users className="h-4 w-4 text-muted-foreground/60" />
                      </div>
                      <p className="text-2xl font-bold">{stats.totalUsers}</p>
                      <div className="text-xs text-muted-foreground mt-1.5 space-y-0.5">
                        {(() => {
                          const customerAccounts = stats.totalUsers - stats.totalStaff;
                          return (
                            <>
                              <p>{customerAccounts} customer{customerAccounts !== 1 ? 's' : ''}</p>
                              {stats.totalStaff > 0 && <p>{stats.totalStaff} staff</p>}
                              {stats.totalTesters > 0 && <p className="text-muted-foreground/60">{stats.totalTesters} tester{stats.totalTesters !== 1 ? 's' : ''}</p>}
                            </>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                        <span>Manage Users</span><ArrowRight className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <Link to="/admin/payments" className="group">
                  <Card className={`h-full hover:border-primary/40 transition-colors ${paymentSummary && paymentSummary.activeSubscriptions > 0 ? 'border-green-500/20' : ''}`}>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Subscriptions</p>
                        <CreditCard className="h-4 w-4 text-muted-foreground/60" />
                      </div>
                      <p className="text-2xl font-bold">{paymentValue(paymentSummary?.activeSubscriptions)}</p>
                      {paymentSummary && paymentSummary.trialingSubscriptions > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">+ {paymentSummary.trialingSubscriptions} trialing</p>
                      )}
                      {paymentSummary === null && !paymentLoading && (
                        <p className="text-xs text-muted-foreground mt-1">Stripe unavailable</p>
                      )}
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                        <span>View Payments</span><ArrowRight className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <Link to="/admin/payments?filter=past_due" className="group">
                  <Card className={`h-full hover:border-primary/40 transition-colors ${paymentSummary && paymentSummary.pastDueSubscriptions > 0 ? 'border-l-4 border-l-warning bg-warning/5' : ''}`}>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Past Due</p>
                        <AlertTriangle className={`h-4 w-4 ${paymentSummary && paymentSummary.pastDueSubscriptions > 0 ? 'text-warning-foreground' : 'text-muted-foreground/60'}`} />
                      </div>
                      <p className="text-2xl font-bold">{paymentValue(paymentSummary?.pastDueSubscriptions)}</p>
                      <p className="text-xs text-muted-foreground mt-1">need follow-up</p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                        <span>View Details</span><ArrowRight className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <Link to="/admin/payments?filter=failed" className="group">
                  <Card className={`h-full hover:border-primary/40 transition-colors ${paymentSummary && paymentSummary.failedPaymentsCount > 0 ? 'border-l-4 border-l-destructive bg-destructive/5' : ''}`}>
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Failed Payments</p>
                        <AlertTriangle className={`h-4 w-4 ${paymentSummary && paymentSummary.failedPaymentsCount > 0 ? 'text-destructive' : 'text-muted-foreground/60'}`} />
                      </div>
                      <p className="text-2xl font-bold">{paymentValue(paymentSummary?.failedPaymentsCount)}</p>
                      <p className="text-xs text-muted-foreground mt-1">in last 60 days</p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                        <span>Investigate</span><ArrowRight className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </section>

            {/* ─── 3. LIBRARY APPROVALS ─── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Library className="h-4 w-4 text-primary/60" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Library Approvals</h2>
                {libraryTotal > 0 && (
                  <Badge variant="secondary" className="text-xs">{libraryTotal} pending</Badge>
                )}
              </div>
              {libraryTotal === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-lg border border-border/40 bg-muted/10">
                  <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                  <p className="text-sm text-muted-foreground">No pending submissions or requests.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeLibraryItems.map(item => <QueueRow key={item.href} item={item} />)}
                  {inactiveLibraryItems.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1">
                      {inactiveLibraryItems.map(item => (
                        <Link key={item.href} to={item.href} className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1">
                          <item.icon className="h-3 w-3" /><span>{item.label}</span><span className="text-muted-foreground/40">· 0</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ─── 4. SECURITY ─── */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Security</h2>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                <Link to="/admin/security" className="group">
                  <div className="flex items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4 text-primary/60" />
                      <span className="text-sm font-medium">Security Dashboard</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
                <Link to="/admin/audit-logs" className="group">
                  <div className="flex items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <History className="h-4 w-4 text-primary/60" />
                      <span className="text-sm font-medium">Audit Logs</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              </div>
            </section>

            {/* ─── 5. SYSTEM HEALTH ─── */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">System Health</h2>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                <Link to="/admin/jobs-queues" className="group">
                  <div className="flex items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <Activity className="h-4 w-4 text-primary/60" />
                      <div>
                        <span className="text-sm font-medium">Jobs & Queues</span>
                        <p className="text-xs text-muted-foreground">Webhooks, PDFs, uploads, edge functions</p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
                <Link to="/admin/email-log" className="group">
                  <div className="flex items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-primary/60" />
                      <div>
                        <span className="text-sm font-medium">Email Log</span>
                        <p className="text-xs text-muted-foreground">Sent, failed, queued communications</p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              </div>
            </section>

            {/* ─── 6. PLATFORM TOTALS ─── */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground/50" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Platform Totals</h2>
                {excludeTestData && hasTestData && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    Excluding {stats.testRides + stats.testDocuments + stats.testChecks + stats.testMaintenanceRecords} test records
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground/50 mb-2">Read-only summary — these counts are not linked to filtered views.</p>
              <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Equipment', value: displayedRides, testCount: stats.testRides, icon: FolderOpen },
                  { label: 'Documents', value: displayedDocuments, testCount: stats.testDocuments, icon: FileText },
                  { label: 'Checks', value: displayedChecks, testCount: stats.testChecks, icon: CheckCircle },
                  { label: 'Maintenance', value: displayedMaintenance, testCount: stats.testMaintenanceRecords, icon: Wrench },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-muted/5">
                    <item.icon className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-muted-foreground/70 leading-none">{item.value}</p>
                      <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                        {item.label}
                        {excludeTestData && item.testCount > 0 && ` · ${item.testCount} test excl.`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ─── TEST DATA (collapsible) ─── */}
            {hasTestData && (
              <section>
                <button
                  onClick={() => setShowTestData(!showTestData)}
                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors mb-2"
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  Test Data Summary
                  {showTestData ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {showTestData && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {[
                      { label: 'Test Equipment', value: stats.testRides },
                      { label: 'Test Documents', value: stats.testDocuments },
                      { label: 'Test Checks', value: stats.testChecks },
                      { label: 'Test Maintenance', value: stats.testMaintenanceRecords },
                    ].map(item => (
                      <div key={item.label} className="text-center p-3 rounded-lg border border-border/30 bg-muted/10">
                        <div className="text-xl font-bold text-muted-foreground">{item.value}</div>
                        <div className="text-[10px] text-muted-foreground/50">{item.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
