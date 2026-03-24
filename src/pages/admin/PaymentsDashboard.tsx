import { useState, useEffect, useRef } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Users,
  RefreshCw,
  CreditCard,
  Calendar,
  XCircle,
  CheckCircle,
  Clock,
  Activity,
  ShieldAlert,
  History,
  RotateCw,
  Info,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, formatDistanceToNow } from 'date-fns';

// ── Types ──

interface UserHealthRow {
  user_id: string;
  controller_name: string | null;
  company_name: string | null;
  app_status: string | null;
  app_plan: string | null;
  stripe_status: string | null;
  stripe_plan: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  stripe_current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_cancel_at_period_end: boolean | null;
  cancel_at: string | null;
  last_billing_sync_at: string | null;
  pending_subscription_plan: string | null;
  pending_change_effective_date: string | null;
  status_mismatch: boolean;
  plan_mismatch: boolean;
  period_end_mismatch: boolean;
  has_mismatch: boolean;
  problem_type: string | null;
  sync_stale: boolean;
}

interface BillingEvent {
  id: string;
  user_id: string | null;
  event_type: string;
  stripe_event_id: string | null;
  previous_status: string | null;
  new_status: string | null;
  previous_plan: string | null;
  new_plan: string | null;
  stripe_status: string | null;
  stripe_plan: string | null;
  mismatch_detected: boolean;
  details: Record<string, unknown>;
  created_at: string;
}

interface PaymentData {
  summary: {
    totalRevenue30Days: number;
    mrr: number;
    upcomingRevenue30Days: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    pastDueSubscriptions: number;
    recentCancellations: number;
    failedPaymentsCount: number;
    balance: { available: number; pending: number; currency: string };
  };
  failedPayments: Array<{
    id: string; amount: number; currency: string; status: string;
    error: string; created: number; email?: string;
  }>;
  recentPayments: Array<{
    id: string; amount: number; currency: string; status: string;
    created: number; email?: string;
  }>;
  subscriptionBreakdown: { active: number; trialing: number; pastDue: number; canceled: number };
  userHealth: UserHealthRow[];
  billingEventLog: BillingEvent[];
  problemUserCount: number;
}

const formatCurrency = (amount: number, currency = 'gbp') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);

// ── Problem badge ──

const ProblemBadge = ({ type }: { type: string | null }) => {
  if (!type) return <Badge variant="outline" className="text-xs">Healthy</Badge>;
  const config: Record<string, { label: string; description: string; variant: 'destructive' | 'secondary' | 'outline' }> = {
    mismatch: { label: 'Mismatch', description: 'App and Stripe data disagree', variant: 'destructive' },
    past_due: { label: 'Past Due', description: 'Payment overdue', variant: 'destructive' },
    stale_sync: { label: 'Stale Sync', description: 'Not synced recently', variant: 'secondary' },
    cancelling: { label: 'Cancelling', description: 'Cancellation scheduled', variant: 'secondary' },
    no_stripe: { label: 'No Stripe Link', description: 'No Stripe subscription found', variant: 'secondary' },
  };
  const c = config[type] || { label: type, description: '', variant: 'secondary' as const };
  return <Badge variant={c.variant} className="text-xs" title={c.description}>{c.label}</Badge>;
};

// ── Status badge ──

const StatusBadge = ({ status, isStripe }: { status: string | null; isStripe?: boolean }) => {
  if (!status) return <span className="text-xs text-muted-foreground italic">{isStripe ? 'Not linked' : 'Unknown'}</span>;
  const color =
    status === 'active' ? 'bg-green-500/15 text-green-700 dark:text-green-400' :
    status === 'past_due' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' :
    status === 'canceled' || status === 'expired' ? 'bg-red-500/15 text-red-700 dark:text-red-400' :
    status === 'trialing' || status === 'trial' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400' :
    'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${color}`}>
      {isStripe && <span className="mr-1 opacity-60">S:</span>}
      {status}
    </span>
  );
};

// ── Plan label ──

const PlanLabel = ({ plan, mismatch, isStripe }: { plan: string | null; mismatch?: boolean; isStripe?: boolean }) => {
  if (!plan) return <span className="text-xs text-muted-foreground italic">{isStripe ? 'No Stripe plan' : 'Not set'}</span>;
  return (
    <span className={`text-xs font-medium capitalize ${mismatch ? 'text-destructive font-bold' : ''}`}>
      {plan}
    </span>
  );
};

// ── Event type label ──

const eventTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    'checkout.session.completed': 'Checkout',
    'customer.subscription.updated': 'Sub Updated',
    'customer.subscription.deleted': 'Sub Deleted',
    'invoice.paid': 'Invoice Paid',
    'invoice.payment_failed': 'Payment Failed',
    'polling_sync': 'Polling Sync',
    'manual_resync': 'Manual Re-sync',
  };
  return map[type] || type;
};

const changeTypeLabel = (details: Record<string, unknown>) => {
  const ct = details?.change_type as string;
  if (!ct) return null;
  const map: Record<string, { label: string; color: string }> = {
    upgrade: { label: '↑ Upgrade', color: 'text-green-600' },
    downgrade: { label: '↓ Downgrade', color: 'text-amber-600' },
    cancellation_scheduled: { label: '⏳ Cancel Scheduled', color: 'text-amber-600' },
    cancellation_completed: { label: '✕ Cancelled', color: 'text-red-600' },
    reactivation: { label: '↻ Reactivated', color: 'text-green-600' },
    payment_failed: { label: '✕ Payment Failed', color: 'text-red-600' },
    renewal: { label: '✓ Renewal', color: 'text-green-600' },
    renewal_after_failure: { label: '✓ Recovered', color: 'text-green-600' },
  };
  const c = map[ct] || { label: ct, color: '' };
  return <span className={`text-xs font-medium ${c.color}`}>{c.label}</span>;
};

// ════════════════════════════════════════
// Main component
// ════════════════════════════════════════

export default function PaymentsDashboard() {
  const [data, setData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [resyncingUser, setResyncingUser] = useState<string | null>(null);
  const [eventDrawerOpen, setEventDrawerOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('failed');
  const tabsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: response, error: fnError } = await supabase.functions.invoke('admin-stripe-data');
      if (fnError) throw fnError;
      if (response.error) throw new Error(response.error);
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payment data');
      toast({ title: 'Error', description: err.message || 'Failed to fetch payment data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleResync = async (userId: string) => {
    setResyncingUser(userId);
    try {
      const { data: response, error: fnError } = await supabase.functions.invoke('admin-stripe-data', {
        body: { action: 'manual_resync', user_id: userId },
      });
      if (fnError) throw fnError;
      if (response.error) throw new Error(response.error);
      toast({
        title: response.mismatch ? 'Re-sync corrected a mismatch' : 'Re-sync complete',
        description: response.mismatch
          ? `Status updated to ${response.newStatus}, plan: ${response.newPlan || '—'}`
          : 'Profile is in sync with Stripe.',
      });
      await fetchData();
    } catch (err: any) {
      toast({ title: 'Re-sync failed', description: err.message, variant: 'destructive' });
    } finally {
      setResyncingUser(null);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6 max-w-6xl">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-32" /></CardContent></Card>)}
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !data) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Failed to load payment data</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" />Retry</Button>
        </div>
      </AdminLayout>
    );
  }

  const { summary, failedPayments, recentPayments, subscriptionBreakdown, userHealth, billingEventLog, problemUserCount } = data;

  const displayedUsers = showAllUsers
    ? userHealth
    : userHealth.filter(u => u.problem_type !== null);

  // Filter events for selected user
  const selectedUserEvents = selectedUserId
    ? billingEventLog.filter(e => e.user_id === selectedUserId)
    : billingEventLog;

  const selectedUserName = selectedUserId
    ? userHealth.find(u => u.user_id === selectedUserId)?.controller_name || userHealth.find(u => u.user_id === selectedUserId)?.company_name || 'User'
    : null;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Payments & Billing</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Subscription health, sync status, and payment monitoring
            </p>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />Refresh
          </Button>
        </div>

        {/* ═══ SECTION 1: Platform Summary ═══ */}
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/70">Platform Summary</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Live subscription totals and payment signals across all customer accounts</p>
          </div>
        <TooltipProvider delayDuration={300}>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">

            <Card
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => { setActiveTab('overview'); tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-xs font-medium">MRR</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[200px] text-xs">Monthly Recurring Revenue from all active Stripe subscriptions</TooltipContent>
                  </Tooltip>
                </div>
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-lg font-bold">{formatCurrency(summary.mrr, summary.balance.currency)}</div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => { setShowAllUsers(true); }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                <CardTitle className="text-xs font-medium">Active Subscriptions</CardTitle>
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-lg font-bold">{summary.activeSubscriptions}</div>
                <p className="text-xs text-muted-foreground">+{summary.trialingSubscriptions} trialing</p>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer ${summary.pastDueSubscriptions > 0 ? 'border-amber-500' : ''}`}
              onClick={() => { setShowAllUsers(false); }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-xs font-medium">Past Due</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px] text-xs">Users with overdue payments. Write access continues until their current billing period ends.</TooltipContent>
                  </Tooltip>
                </div>
                <AlertTriangle className={`h-3.5 w-3.5 ${summary.pastDueSubscriptions > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent className="pt-0">
                <div className={`text-lg font-bold ${summary.pastDueSubscriptions > 0 ? 'text-amber-600' : ''}`}>
                  {summary.pastDueSubscriptions}
                </div>
              </CardContent>
            </Card>

            <Card
              className={`cursor-pointer ${summary.failedPaymentsCount > 0 ? 'border-destructive' : ''}`}
              onClick={() => { setActiveTab('failed'); tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-xs font-medium">Failed Payments</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground/50 cursor-help" /></TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[200px] text-xs">Stripe payment intents that failed in the last 60 days</TooltipContent>
                  </Tooltip>
                </div>
                <XCircle className={`h-3.5 w-3.5 ${summary.failedPaymentsCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent className="pt-0">
                <div className={`text-lg font-bold ${summary.failedPaymentsCount > 0 ? 'text-destructive' : ''}`}>
                  {summary.failedPaymentsCount}
                </div>
                <p className="text-xs text-muted-foreground">Last 60 days</p>
              </CardContent>
            </Card>
          </div>
        </TooltipProvider>
        </div>

        {/* ═══ SECTION 2: Accounts Needing Review ═══ */}
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/70">Accounts Needing Review</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Customer accounts with billing, sync, or Stripe-link issues</p>
          </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {problemUserCount > 0 ? (
                <Badge variant="destructive" className="text-xs px-2.5 py-1 font-semibold">
                  <ShieldAlert className="h-3 w-3 mr-1.5" />
                  {problemUserCount} account{problemUserCount !== 1 ? 's' : ''} flagged
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs px-2.5 py-1 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                  <CheckCircle className="h-3 w-3 mr-1.5" />
                  All accounts healthy
                </Badge>
              )}
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-all"
                    checked={showAllUsers}
                    onCheckedChange={setShowAllUsers}
                  />
                  <Label htmlFor="show-all" className="text-xs cursor-pointer whitespace-nowrap">
                    All users ({userHealth.length})
                  </Label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSelectedUserId(null); setEventDrawerOpen(true); }}
                  className="text-xs h-8"
                >
                  <History className="h-3.5 w-3.5 mr-1.5" />
                  <span className="hidden sm:inline">Event Log</span>
                  <span className="sm:hidden">Log</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {displayedUsers.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
                <p className="font-medium">No problem users detected</p>
                <p className="text-xs mt-1">Toggle "Show all users" to view everyone</p>
              </div>
            ) : (
              <>
                {/* ── Mobile: stacked cards ── */}
                <div className="md:hidden divide-y">
                  {displayedUsers.map(user => (
                    <div
                      key={user.user_id}
                      className={`p-4 space-y-3 ${user.has_mismatch ? 'bg-destructive/5' : user.problem_type ? 'bg-amber-500/5' : ''}`}
                    >
                      {/* Header: Name + badge */}
                      <div className="space-y-1">
                        <div className="text-sm font-semibold truncate">{user.company_name || '—'}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground truncate">{user.controller_name || '—'}</span>
                          <ProblemBadge type={user.problem_type} />
                        </div>
                      </div>

                      {/* Comparison grid */}
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                        <div>
                          <span className="text-muted-foreground block mb-0.5">App Status</span>
                          <StatusBadge status={user.app_status} />
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-0.5">Stripe Status</span>
                          <StatusBadge status={user.stripe_status} isStripe />
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-0.5">App Plan</span>
                          <PlanLabel plan={user.app_plan} mismatch={user.plan_mismatch} />
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-0.5">Stripe Plan</span>
                          <PlanLabel plan={user.stripe_plan} mismatch={user.plan_mismatch} isStripe />
                        </div>
                      </div>

                      {/* Metadata: period end + sync */}
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0" />
                          {user.current_period_end ? (
                            <span>Ends {format(new Date(user.current_period_end), 'dd MMM yyyy')}</span>
                          ) : <span>No period end</span>}
                          {user.cancel_at_period_end && <span className="text-amber-600 font-medium">• Cancelling</span>}
                          {user.pending_subscription_plan && <span className="text-blue-600 font-medium">→ {user.pending_subscription_plan}</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RefreshCw className="h-3 w-3 shrink-0" />
                          {user.last_billing_sync_at ? (
                            <span className={user.sync_stale ? 'text-amber-600 font-medium' : ''}>
                              Synced {formatDistanceToNow(new Date(user.last_billing_sync_at), { addSuffix: true })}
                            </span>
                          ) : <span>Never synced with Stripe</span>}
                        </div>
                      </div>

                      {/* Actions footer */}
                      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                        <Button variant="ghost" size="sm" className="h-8 text-xs flex-1 justify-center gap-1.5" onClick={() => { setSelectedUserId(user.user_id); setEventDrawerOpen(true); }}>
                          <Activity className="h-3.5 w-3.5" />
                          Event History
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs flex-1 justify-center gap-1.5" disabled={resyncingUser === user.user_id} onClick={() => handleResync(user.user_id)}>
                          <RotateCw className={`h-3.5 w-3.5 ${resyncingUser === user.user_id ? 'animate-spin' : ''}`} />
                          Re-sync
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Desktop/tablet: table ── */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs min-w-[140px]">Organisation / User</TableHead>
                        <TableHead className="text-xs">Problem</TableHead>
                        <TableHead className="text-xs">App Status</TableHead>
                        <TableHead className="text-xs">Stripe Status</TableHead>
                        <TableHead className="text-xs">App Plan</TableHead>
                        <TableHead className="text-xs">Stripe Plan</TableHead>
                        <TableHead className="text-xs">Period End</TableHead>
                        <TableHead className="text-xs hidden lg:table-cell">Last Sync</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedUsers.map(user => (
                        <TableRow
                          key={user.user_id}
                          className={user.has_mismatch ? 'bg-destructive/5' : user.problem_type ? 'bg-amber-500/5' : ''}
                        >
                          <TableCell className="min-w-[140px]">
                            <div className="space-y-0.5">
                              <div className="text-sm font-medium truncate max-w-[180px]">{user.company_name || '—'}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[180px]">{user.controller_name || '—'}</div>
                            </div>
                          </TableCell>
                          <TableCell><ProblemBadge type={user.problem_type} /></TableCell>
                          <TableCell><StatusBadge status={user.app_status} /></TableCell>
                          <TableCell><StatusBadge status={user.stripe_status} isStripe /></TableCell>
                          <TableCell><PlanLabel plan={user.app_plan} mismatch={user.plan_mismatch} /></TableCell>
                          <TableCell><PlanLabel plan={user.stripe_plan} mismatch={user.plan_mismatch} isStripe /></TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              {user.current_period_end ? (
                                <span className="text-xs">{format(new Date(user.current_period_end), 'dd MMM yyyy')}</span>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                              {user.cancel_at_period_end && <div className="text-xs text-amber-600 font-medium">Cancels at end</div>}
                              {user.pending_subscription_plan && <div className="text-xs text-blue-600 font-medium">→ {user.pending_subscription_plan}</div>}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {user.last_billing_sync_at ? (
                              <span className={`text-xs ${user.sync_stale ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                                {formatDistanceToNow(new Date(user.last_billing_sync_at), { addSuffix: true })}
                              </span>
                            ) : <span className="text-xs text-muted-foreground italic">Never synced</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setSelectedUserId(user.user_id); setEventDrawerOpen(true); }}>
                                <Activity className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={resyncingUser === user.user_id} onClick={() => handleResync(user.user_id)}>
                                <RotateCw className={`h-3.5 w-3.5 ${resyncingUser === user.user_id ? 'animate-spin' : ''}`} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        </div>

        {/* ═══ SECTION 3: Payment Activity ═══ */}
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/70">Payment Activity</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Failed charges, successful payments, and revenue trends from Stripe — across all customer accounts</p>
          </div>
        <div ref={tabsRef}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full flex">
            <TabsTrigger value="failed" className="flex-1 flex items-center justify-center gap-1 text-xs px-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Failed</span>
              {failedPayments.length > 0 && <Badge variant="destructive" className="ml-1 text-xs shrink-0">{failedPayments.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex-1 flex items-center justify-center gap-1 text-xs px-2">
              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Recent</span>
            </TabsTrigger>
            <TabsTrigger value="overview" className="flex-1 flex items-center justify-center gap-1 text-xs px-2">
              <CreditCard className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Overview</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="failed">
            <Card>
              <CardContent className="p-0">
                {failedPayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
                    <p className="text-sm">No failed payments</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile: stacked cards */}
                    <div className="md:hidden divide-y">
                      {failedPayments.map(p => (
                        <div key={p.id} className="p-4 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">{format(new Date(p.created * 1000), 'dd MMM yyyy')}</span>
                            <Badge variant="destructive" className="text-xs">{p.status}</Badge>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm truncate min-w-0">{p.email || 'Unknown'}</span>
                            <span className="text-sm font-bold whitespace-nowrap">{formatCurrency(p.amount, p.currency)}</span>
                          </div>
                          {p.error && <p className="text-xs text-muted-foreground line-clamp-2">{p.error}</p>}
                        </div>
                      ))}
                    </div>
                    {/* Desktop: table */}
                    <div className="hidden md:block overflow-x-auto p-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Date</TableHead>
                            <TableHead className="text-xs">Customer</TableHead>
                            <TableHead className="text-xs">Amount</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {failedPayments.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="text-xs whitespace-nowrap">{format(new Date(p.created * 1000), 'dd MMM')}</TableCell>
                              <TableCell className="text-xs max-w-[120px] truncate">{p.email || <span className="text-muted-foreground">Unknown</span>}</TableCell>
                              <TableCell className="text-xs font-medium whitespace-nowrap">{formatCurrency(p.amount, p.currency)}</TableCell>
                              <TableCell><Badge variant="destructive" className="text-xs">{p.status}</Badge></TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{p.error}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recent">
            <Card>
              <CardContent className="p-0">
                {recentPayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground"><p className="text-sm">No recent payments</p></div>
                ) : (
                  <>
                    {/* Mobile: stacked cards */}
                    <div className="md:hidden divide-y">
                      {recentPayments.map(p => (
                        <div key={p.id} className="p-4 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">{format(new Date(p.created * 1000), 'dd MMM yyyy')}</span>
                            <Badge className="bg-green-500 text-xs">{p.status}</Badge>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm truncate min-w-0">{p.email || 'Unknown'}</span>
                            <span className="text-sm font-bold whitespace-nowrap">{formatCurrency(p.amount, p.currency)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Desktop: table */}
                    <div className="hidden md:block overflow-x-auto p-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Date</TableHead>
                            <TableHead className="text-xs">Customer</TableHead>
                            <TableHead className="text-xs">Amount</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentPayments.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="text-xs whitespace-nowrap">{format(new Date(p.created * 1000), 'dd MMM')}</TableCell>
                              <TableCell className="text-xs max-w-[120px] truncate">{p.email || <span className="text-muted-foreground">Unknown</span>}</TableCell>
                              <TableCell className="text-xs font-medium whitespace-nowrap">{formatCurrency(p.amount, p.currency)}</TableCell>
                              <TableCell><Badge className="bg-green-500 text-xs">{p.status}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" />Revenue (30 days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{formatCurrency(summary.totalRevenue30Days, summary.balance.currency)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" />Upcoming Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{formatCurrency(summary.upcomingRevenue30Days, summary.balance.currency)}</div>
                  <p className="text-xs text-muted-foreground">From draft invoices</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" />Stripe Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Available:</span>
                      <span className="font-medium">{formatCurrency(summary.balance.available, summary.balance.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pending:</span>
                      <span className="font-medium">{formatCurrency(summary.balance.pending, summary.balance.currency)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        </div>
        </div>
      </div>

      {/* ── Billing Event Log Drawer ── */}
      <Sheet open={eventDrawerOpen} onOpenChange={setEventDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {selectedUserName ? `Events: ${selectedUserName}` : 'Billing Event Log'}
            </SheetTitle>
            <SheetDescription>
              {selectedUserId
                ? 'Sync and webhook events for this user'
                : 'Last 50 billing events across all users'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            {selectedUserEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No billing events recorded yet</p>
              </div>
            ) : (
              selectedUserEvents.map(event => (
                <div
                  key={event.id}
                  className={`rounded-lg border p-3 space-y-1.5 ${
                    event.mismatch_detected ? 'border-destructive bg-destructive/5' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">
                        {eventTypeLabel(event.event_type)}
                      </Badge>
                      {changeTypeLabel(event.details)}
                      {event.mismatch_detected && (
                        <Badge variant="destructive" className="text-xs">Mismatch</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(event.created_at), 'dd MMM HH:mm')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {event.previous_status && (
                      <>
                        <span className="text-muted-foreground">Status:</span>
                        <span>
                          {event.previous_status} → <span className="font-medium">{event.new_status}</span>
                        </span>
                      </>
                    )}
                    {(event.previous_plan || event.new_plan) && (
                      <>
                        <span className="text-muted-foreground">Plan:</span>
                        <span>
                          {event.previous_plan || '—'} → <span className="font-medium">{event.new_plan || '—'}</span>
                        </span>
                      </>
                    )}
                    {event.stripe_status && (
                      <>
                        <span className="text-muted-foreground">Stripe status:</span>
                        <span>{event.stripe_status}</span>
                      </>
                    )}
                  </div>

                  {event.stripe_event_id && (
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {event.stripe_event_id}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
