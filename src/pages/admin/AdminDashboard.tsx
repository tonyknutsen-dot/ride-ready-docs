import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  FolderOpen, FileText, Users, FlaskConical, BarChart3, CheckCircle,
  Loader2, MessageCircle, Bug, CreditCard, ArrowRight, AlertTriangle,
  ChevronDown, ChevronUp, Clock, Shield,
} from 'lucide-react';

interface DashboardStats {
  // Needs Attention
  unansweredSupport: number;
  bugReportsNeedingTriage: number;
  pendingRideRequests: number;
  pendingDocRequests: number;
  // Users
  totalUsers: number;
  totalTesters: number;
  // Platform Data
  totalRides: number;
  totalDocuments: number;
  totalChecks: number;
  totalMaintenanceRecords: number;
  // Test data
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
    unansweredSupport: 0,
    bugReportsNeedingTriage: 0,
    pendingRideRequests: 0,
    pendingDocRequests: 0,
    totalUsers: 0,
    totalTesters: 0,
    totalRides: 0,
    totalDocuments: 0,
    totalChecks: 0,
    totalMaintenanceRecords: 0,
    testRides: 0,
    testDocuments: 0,
    testChecks: 0,
    testMaintenanceRecords: 0,
  });
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [excludeTestData, setExcludeTestData] = useState(true);
  const [showTestData, setShowTestData] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [
          supportRes,
          bugRes,
          rideRequests,
          docRequests,
          users,
          testers,
          allRides, testRides,
          allDocuments, testDocuments,
          allChecks, testChecks,
          allMaintenance, testMaintenance,
        ] = await Promise.all([
          supabase.from('support_messages').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          (supabase as any).from('bug_reports').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_progress']),
          supabase.from('ride_type_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('document_type_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'tester'),
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
          pendingRideRequests: rideRequests.count || 0,
          pendingDocRequests: docRequests.count || 0,
          totalUsers: users.count || 0,
          totalTesters: testers.count || 0,
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
        // Payment data is optional — don't block dashboard
      } finally {
        setPaymentLoading(false);
      }
    };

    fetchStats();
    fetchPayments();
  }, []);

  const totalPendingApprovals = stats.pendingRideRequests + stats.pendingDocRequests;
  const hasTestData = stats.testRides > 0 || stats.testDocuments > 0 || stats.testChecks > 0 || stats.testMaintenanceRecords > 0;

  const displayedRides = excludeTestData ? stats.totalRides - stats.testRides : stats.totalRides;
  const displayedDocuments = excludeTestData ? stats.totalDocuments - stats.testDocuments : stats.totalDocuments;
  const displayedChecks = excludeTestData ? stats.totalChecks - stats.testChecks : stats.totalChecks;
  const displayedMaintenance = excludeTestData ? stats.totalMaintenanceRecords - stats.testMaintenanceRecords : stats.totalMaintenanceRecords;

  const needsAttentionTotal = stats.unansweredSupport + stats.bugReportsNeedingTriage + totalPendingApprovals;

  // Payment card state helper
  const paymentValue = (val: number | undefined) => {
    if (paymentLoading) return '…';
    if (paymentSummary === null) return '—';
    return val ?? 0;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header — compact */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold leading-tight">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Platform overview and triage</p>
          </div>

          {hasTestData && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border/60 bg-muted/20 text-xs shrink-0">
              <FlaskConical className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
              <Label htmlFor="exclude-test-data" className="text-xs cursor-pointer whitespace-nowrap text-muted-foreground">
                Exclude test data
              </Label>
              <Switch
                id="exclude-test-data"
                checked={excludeTestData}
                onCheckedChange={setExcludeTestData}
                className="scale-90"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ─── 1. NEEDS ATTENTION ─── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Needs Attention
                </h2>
                {needsAttentionTotal > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {needsAttentionTotal}
                  </Badge>
                )}
              </div>

              {needsAttentionTotal === 0 ? (
                <Card className="border-success/30 bg-success/5">
                  <CardContent className="py-6 flex items-center gap-3 justify-center">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <p className="text-sm font-medium text-success">All clear — nothing needs attention right now</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                  <Link to="/admin/support" className="group">
                    <Card className={`h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer ${stats.unansweredSupport > 0 ? 'border-destructive/40 bg-destructive/5' : ''}`}>
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Support</p>
                            <p className="text-3xl font-bold mt-1">{stats.unansweredSupport}</p>
                            <p className="text-xs text-muted-foreground mt-1">unanswered messages</p>
                          </div>
                          <div className="p-2 rounded-lg bg-destructive/10">
                            <MessageCircle className="h-5 w-5 text-destructive" />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                          <span>Review</span>
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link to="/admin/bug-reports" className="group">
                    <Card className={`h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer ${stats.bugReportsNeedingTriage > 0 ? 'border-warning/40 bg-warning/5' : ''}`}>
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bugs</p>
                            <p className="text-3xl font-bold mt-1">{stats.bugReportsNeedingTriage}</p>
                            <p className="text-xs text-muted-foreground mt-1">needing triage</p>
                          </div>
                          <div className="p-2 rounded-lg bg-warning/10">
                            <Bug className="h-5 w-5 text-warning-foreground" />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                          <span>Triage</span>
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  <Link to="/admin/ride-requests" className="group">
                    <Card className={`h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer ${totalPendingApprovals > 0 ? 'border-primary/40 bg-primary/5' : ''}`}>
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending Requests</p>
                            <p className="text-3xl font-bold mt-1">{totalPendingApprovals}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {stats.pendingRideRequests > 0 && `${stats.pendingRideRequests} ride`}
                              {stats.pendingRideRequests > 0 && stats.pendingDocRequests > 0 && ' · '}
                              {stats.pendingDocRequests > 0 && `${stats.pendingDocRequests} doc`}
                              {totalPendingApprovals === 0 && 'pending requests'}
                            </p>
                          </div>
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Clock className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                          <span>Review</span>
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              )}
            </section>

            {/* ─── 2. USERS & PAYMENTS ─── */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Users & Payments
              </h2>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <Link to="/admin/users">
                  <Card className="h-full transition-colors hover:border-primary/40 cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs sm:text-sm font-medium">Total Users</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalUsers}</div>
                      {stats.totalTesters > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {stats.totalTesters} tester{stats.totalTesters !== 1 ? 's' : ''}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>

                <Link to="/admin/payments">
                  <Card className={`h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer ${paymentSummary && paymentSummary.activeSubscriptions > 0 ? 'border-success/30' : ''}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs sm:text-sm font-medium">Active Subs</CardTitle>
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{paymentValue(paymentSummary?.activeSubscriptions)}</div>
                      {paymentSummary && paymentSummary.trialingSubscriptions > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {paymentSummary.trialingSubscriptions} trialing
                        </p>
                      )}
                      {paymentSummary === null && !paymentLoading && (
                        <p className="text-xs text-muted-foreground mt-1">Unavailable</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>

                <Link to="/admin/payments">
                  <Card className={`h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer ${paymentSummary && paymentSummary.pastDueSubscriptions > 0 ? 'border-warning/40 bg-warning/5' : ''}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs sm:text-sm font-medium">Past Due</CardTitle>
                      <AlertTriangle className={`h-4 w-4 ${paymentSummary && paymentSummary.pastDueSubscriptions > 0 ? 'text-warning-foreground' : 'text-muted-foreground'}`} />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{paymentValue(paymentSummary?.pastDueSubscriptions)}</div>
                      <p className="text-xs text-muted-foreground mt-1">subscriptions</p>
                    </CardContent>
                  </Card>
                </Link>

                <Link to="/admin/payments">
                  <Card className={`h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer ${paymentSummary && paymentSummary.failedPaymentsCount > 0 ? 'border-destructive/40 bg-destructive/5' : ''}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs sm:text-sm font-medium">Failed</CardTitle>
                      <AlertTriangle className={`h-4 w-4 ${paymentSummary && paymentSummary.failedPaymentsCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{paymentValue(paymentSummary?.failedPaymentsCount)}</div>
                      <p className="text-xs text-muted-foreground mt-1">payments</p>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </section>

            {/* ─── 3. QUICK ACTIONS ─── */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Quick Actions
              </h2>
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: 'Review Support Messages', href: '/admin/support', icon: MessageCircle, count: stats.unansweredSupport },
                  { label: 'Triage Bug Reports', href: '/admin/bug-reports', icon: Bug, count: stats.bugReportsNeedingTriage },
                  { label: 'Review Pending Requests', href: '/admin/ride-requests', icon: Clock, count: totalPendingApprovals },
                  { label: 'Manage Users', href: '/admin/users', icon: Users, count: null },
                  { label: 'Open Payments', href: '/admin/payments', icon: CreditCard, count: null },
                ].map((action) => (
                  <Link key={action.href} to={action.href}>
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <action.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-sm font-medium">{action.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {action.count !== null && action.count > 0 && (
                          <Badge variant="destructive" className="text-xs h-5 min-w-[20px] flex items-center justify-center">
                            {action.count}
                          </Badge>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* ─── 4. PLATFORM DATA ─── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Platform Data
                </h2>
                {excludeTestData && hasTestData && (
                  <Badge variant="secondary" className="text-xs">
                    Excluding {stats.testRides + stats.testDocuments + stats.testChecks + stats.testMaintenanceRecords} test records
                  </Badge>
                )}
              </div>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <Card className="border-border/60">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Rides</CardTitle>
                    <FolderOpen className="h-4 w-4 text-muted-foreground/60" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-semibold">{displayedRides}</div>
                    {excludeTestData && stats.testRides > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{stats.testRides} test excluded</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Documents</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground/60" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-semibold">{displayedDocuments}</div>
                    {excludeTestData && stats.testDocuments > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{stats.testDocuments} test excluded</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Checks</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground/60" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-semibold">{displayedChecks}</div>
                    {excludeTestData && stats.testChecks > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{stats.testChecks} test excluded</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Maintenance</CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground/60" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-semibold">{displayedMaintenance}</div>
                    {excludeTestData && stats.testMaintenanceRecords > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{stats.testMaintenanceRecords} test excluded</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ─── 5. TEST DATA (collapsible) ─── */}
            {hasTestData && (
              <section>
                <button
                  onClick={() => setShowTestData(!showTestData)}
                  className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors mb-3"
                >
                  <FlaskConical className="h-4 w-4" />
                  Test Data Summary
                  {showTestData ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showTestData && (
                  <Card className="border-border/40 bg-muted/20">
                    <CardContent className="pt-5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 rounded-lg bg-background border">
                          <div className="text-2xl font-bold text-muted-foreground">{stats.testRides}</div>
                          <div className="text-xs text-muted-foreground">Test Rides</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-background border">
                          <div className="text-2xl font-bold text-muted-foreground">{stats.testDocuments}</div>
                          <div className="text-xs text-muted-foreground">Test Documents</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-background border">
                          <div className="text-2xl font-bold text-muted-foreground">{stats.testChecks}</div>
                          <div className="text-xs text-muted-foreground">Test Checks</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-background border">
                          <div className="text-2xl font-bold text-muted-foreground">{stats.testMaintenanceRecords}</div>
                          <div className="text-xs text-muted-foreground">Test Maintenance</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
