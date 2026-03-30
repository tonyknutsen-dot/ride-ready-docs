import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity, RefreshCw, Loader2, CheckCircle, AlertTriangle, XCircle,
  Webhook, Mail, Clock, Database, ArrowRight, HelpCircle, Wrench,
} from 'lucide-react';
import { formatDistanceToNow, subDays, subHours } from 'date-fns';

type HealthStatus = 'no_failures' | 'warning' | 'error' | 'unknown';
type TimeRange = '24h' | '7d' | '30d';

interface HealthCheck {
  name: string;
  status: HealthStatus;
  detail: string;
  evidence: string;
  icon: typeof Activity;
  drillDownHref?: string;
  drillDownLabel?: string;
}

interface FailureEntry {
  id: string;
  action: string;
  resource_type: string;
  result: string;
  created_at: string;
  details: any;
  context_hint: string | null;
  equipment_name: string | null;
}

interface CategorySummary {
  category: string;
  count: number;
  icon: typeof Activity;
}

export default function SystemHealth() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [failures, setFailures] = useState<FailureEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const getStartDate = (range: TimeRange) => {
    switch (range) {
      case '24h': return subHours(new Date(), 24).toISOString();
      case '7d': return subDays(new Date(), 7).toISOString();
      case '30d': return subDays(new Date(), 30).toISOString();
    }
  };

  const categorizeFailure = (f: FailureEntry): string => {
    const action = f.action?.toLowerCase() || '';
    const resource = f.resource_type?.toLowerCase() || '';
    const hint = f.context_hint?.toLowerCase() || '';

    if (action.includes('webhook') || resource.includes('stripe') || resource.includes('webhook') || hint.includes('webhook')) return 'Webhooks';
    if (action.includes('pdf') || resource.includes('pdf') || hint.includes('pdf')) return 'PDF Generation';
    if (action.includes('upload') || action.includes('storage') || resource.includes('document') || resource.includes('storage')) return 'Storage / Uploads';
    if (action.includes('email') || resource.includes('email') || hint.includes('email')) return 'Email';
    if (action.includes('auth') || resource.includes('auth') || action.includes('login') || action.includes('unlock')) return 'Authentication';
    return 'Other';
  };

  const fetchHealth = async () => {
    try {
      const startDate = getStartDate(timeRange);
      const now = new Date().toISOString();

      // Fetch failures within time range
      const { data: failureData } = await supabase
        .from('audit_logs')
        .select('id, action, resource_type, result, created_at, details, context_hint, equipment_name')
        .eq('result', 'failure')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false })
        .limit(50);

      const allFailures = (failureData as FailureEntry[]) || [];
      setFailures(allFailures);

      // Health check counts (always last 24h for status cards)
      const last24h = subHours(new Date(), 24).toISOString();

      const [
        { count: failureCount24h },
        { count: totalActions24h },
        { count: webhookMismatches },
        { count: expiredGrants },
      ] = await Promise.all([
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('result', 'failure').gte('created_at', last24h),
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', last24h),
        supabase.from('billing_sync_log').select('id', { count: 'exact', head: true }).gte('created_at', last24h).eq('mismatch_detected', true),
        supabase.from('support_access_grants').select('id', { count: 'exact', head: true }).eq('status', 'active').lt('expires_at', now),
      ]);

      // Email health check
      let emailStatus: HealthStatus = 'unknown';
      let emailDetail = 'Email logging table not yet active';
      let emailEvidence = 'Table does not exist — email delivery is not tracked';
      let emailTableExists = false;
      try {
        const { count: emailFails, error: emailError } = await (supabase as any)
          .from('email_send_log')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', last24h)
          .in('status', ['failed', 'dlq']);

        if (!emailError || (!emailError.message?.includes('relation') && emailError.code !== '42P01')) {
          emailTableExists = true;
          const { count: emailAll } = await (supabase as any)
            .from('email_send_log')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', last24h);

          const fails = emailFails || 0;
          const total = emailAll || 0;

          if (total === 0) {
            emailStatus = 'unknown';
            emailDetail = 'No emails logged in last 24h';
            emailEvidence = 'Table exists but has no recent records';
          } else if (fails === 0) {
            emailStatus = 'no_failures';
            emailDetail = `${total} email${total !== 1 ? 's' : ''} logged, 0 failures`;
            emailEvidence = 'Based on email_send_log — no failures detected';
          } else {
            emailStatus = fails < 3 ? 'warning' : 'error';
            emailDetail = `${fails} failed / ${total} total in last 24h`;
            emailEvidence = `Based on email_send_log — ${fails} delivery failure${fails !== 1 ? 's' : ''}`;
          }
        }
      } catch { /* table doesn't exist */ }

      // System ops status
      const sysFailures = failureCount24h || 0;
      const sysTotal = totalActions24h || 0;
      let sysStatus: HealthStatus;
      let sysEvidence: string;
      if (sysTotal === 0) {
        sysStatus = 'unknown';
        sysEvidence = 'No audit log entries in last 24h';
      } else if (sysFailures === 0) {
        sysStatus = 'no_failures';
        sysEvidence = `${sysTotal} actions logged, no failures`;
      } else if (sysFailures < 5) {
        sysStatus = 'warning';
        sysEvidence = `${sysFailures} of ${sysTotal} actions failed`;
      } else {
        sysStatus = 'error';
        sysEvidence = `${sysFailures} failures — review recommended`;
      }

      // Webhook status
      const whMismatches = webhookMismatches || 0;
      let whStatus: HealthStatus = whMismatches === 0 ? 'no_failures' : 'warning';
      let whEvidence = whMismatches === 0
        ? 'No plan/status mismatches in last 24h'
        : `${whMismatches} mismatch${whMismatches > 1 ? 'es' : ''} between Stripe and local state`;

      const checks: HealthCheck[] = [
        {
          name: 'System Operations',
          status: sysStatus,
          detail: sysTotal === 0 ? 'No activity in last 24h' : `${sysFailures} failure${sysFailures !== 1 ? 's' : ''} / ${sysTotal} actions`,
          evidence: sysEvidence,
          icon: Activity,
          drillDownHref: '/admin/jobs-queues',
          drillDownLabel: 'View Jobs & Queues',
        },
        {
          name: 'Stripe Webhooks',
          status: whStatus,
          detail: whMismatches === 0 ? 'No mismatches in last 24h' : `${whMismatches} mismatch${whMismatches > 1 ? 'es' : ''}`,
          evidence: whEvidence,
          icon: Webhook,
          drillDownHref: '/admin/payments',
          drillDownLabel: 'View Payments',
        },
        {
          name: 'Email Delivery',
          status: emailStatus,
          detail: emailDetail,
          evidence: emailEvidence,
          icon: Mail,
          drillDownHref: emailTableExists ? '/admin/email-log' : undefined,
          drillDownLabel: emailTableExists ? 'View Email Log' : undefined,
        },
        {
          name: 'Support Access Grants',
          status: (expiredGrants || 0) === 0 ? 'no_failures' : 'warning',
          detail: (expiredGrants || 0) === 0 ? 'All grants current' : `${expiredGrants} expired grant${(expiredGrants || 0) > 1 ? 's' : ''} still active`,
          evidence: (expiredGrants || 0) === 0
            ? 'No active grants past expiry'
            : 'Some grants expired but remain active',
          icon: Database,
          drillDownHref: '/admin/support-access',
          drillDownLabel: 'View Grants',
        },
      ];

      setHealthChecks(checks);
    } catch (error) {
      console.error('Error fetching health data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchHealth();
  }, [timeRange]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHealth();
  };

  // Categorize failures for summary
  const categoryCounts: CategorySummary[] = (() => {
    const counts: Record<string, number> = {};
    failures.forEach(f => {
      const cat = categorizeFailure(f);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const iconMap: Record<string, typeof Activity> = {
      'Webhooks': Webhook,
      'PDF Generation': Wrench,
      'Storage / Uploads': Database,
      'Email': Mail,
      'Authentication': Activity,
      'Other': AlertTriangle,
    };
    return Object.entries(counts)
      .map(([category, count]) => ({ category, count, icon: iconMap[category] || AlertTriangle }))
      .sort((a, b) => b.count - a.count);
  })();

  const filteredFailures = categoryFilter === 'all'
    ? failures
    : failures.filter(f => categorizeFailure(f) === categoryFilter);

  const statusIcon = (status: HealthStatus) => {
    switch (status) {
      case 'no_failures': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusBadge = (status: HealthStatus) => {
    switch (status) {
      case 'no_failures': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">No recent failures</Badge>;
      case 'warning': return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">Warning</Badge>;
      case 'error': return <Badge variant="destructive" className="text-xs">Failures detected</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Unknown</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Activity className="h-5 md:h-6 w-5 md:w-6 text-primary" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold">System Health & Jobs</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Operational failures from audit logs, webhooks, email delivery, and access grants</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Health Status Cards */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {healthChecks.map(check => (
                <Card key={check.name} className="hover:shadow-none">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-3">
                        {statusIcon(check.status)}
                        <div>
                          <p className="text-sm font-medium">{check.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
                        </div>
                      </div>
                      {statusBadge(check.status)}
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 mt-1 pl-7">{check.evidence}</p>
                    {check.drillDownHref && (
                      <Link
                        to={check.drillDownHref}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-2 pl-7"
                      >
                        {check.drillDownLabel} <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Failure Breakdown */}
            <Card className="hover:shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="text-base flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    Failure Breakdown
                    {failures.length > 0 && (
                      <Badge variant="destructive" className="text-xs">{failures.length}</Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {(['24h', '7d', '30d'] as TimeRange[]).map(range => (
                        <Button
                          key={range}
                          variant={timeRange === range ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setTimeRange(range)}
                          className="text-xs h-7 px-2"
                        >
                          {range === '24h' ? '24h' : range === '7d' ? '7d' : '30d'}
                        </Button>
                      ))}
                    </div>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-[140px] h-7 text-xs">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categoryCounts.map(c => (
                          <SelectItem key={c.category} value={c.category}>
                            {c.category} ({c.count})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Category summary chips */}
                {categoryCounts.length > 0 && categoryFilter === 'all' && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {categoryCounts.map(c => (
                      <button
                        key={c.category}
                        onClick={() => setCategoryFilter(c.category)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium hover:bg-accent/10 transition-colors"
                      >
                        <c.icon className="h-3 w-3 text-muted-foreground" />
                        {c.category}
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">{c.count}</Badge>
                      </button>
                    ))}
                  </div>
                )}

                {filteredFailures.length === 0 ? (
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-border/40 bg-muted/10">
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {categoryFilter !== 'all'
                          ? `No ${categoryFilter.toLowerCase()} failures in the selected time range.`
                          : `No failures recorded in the last ${timeRange === '24h' ? '24 hours' : timeRange === '7d' ? '7 days' : '30 days'}.`
                        }
                      </p>
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                        This only tracks actions logged to audit_logs with result = 'failure'.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredFailures.map(failure => {
                      const cat = categorizeFailure(failure);
                      return (
                        <div key={failure.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/5">
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{failure.action}</span>
                              <Badge variant="secondary" className="text-[10px]">{failure.resource_type}</Badge>
                              <Badge variant="outline" className="text-[10px]">{cat}</Badge>
                            </div>
                            {failure.context_hint && (
                              <p className="text-xs text-muted-foreground mt-0.5">{failure.context_hint}</p>
                            )}
                            {failure.equipment_name && (
                              <p className="text-xs text-muted-foreground/70 mt-0.5">Equipment: {failure.equipment_name}</p>
                            )}
                            {failure.details && typeof failure.details === 'object' && (failure.details as any).error && (
                              <p className="text-xs text-destructive/80 mt-0.5 truncate max-w-full">{(failure.details as any).error}</p>
                            )}
                            <p className="text-[11px] text-muted-foreground/60 mt-1">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {formatDistanceToNow(new Date(failure.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
