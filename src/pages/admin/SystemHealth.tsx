import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity, RefreshCw, Loader2, CheckCircle, AlertTriangle, XCircle,
  Webhook, Mail, Clock, Database, ArrowRight, HelpCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type HealthStatus = 'no_failures' | 'warning' | 'error' | 'unknown';

interface HealthCheck {
  name: string;
  status: HealthStatus;
  detail: string;
  evidence: string;
  lastChecked: string;
  icon: typeof Activity;
  drillDownHref?: string;
  drillDownLabel?: string;
}

interface RecentFailure {
  id: string;
  action: string;
  resource_type: string;
  result: string;
  created_at: string;
  details: any;
  context_hint: string | null;
}

export default function SystemHealth() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [recentFailures, setRecentFailures] = useState<RecentFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = async () => {
    try {
      const { data: failures } = await supabase
        .from('audit_logs')
        .select('id, action, resource_type, result, created_at, details, context_hint')
        .eq('result', 'failure')
        .order('created_at', { ascending: false })
        .limit(20);

      setRecentFailures((failures as RecentFailure[]) || []);

      const now = new Date().toISOString();
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { count: failureCount24h } = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('result', 'failure')
        .gte('created_at', last24h);

      const { count: totalActions24h } = await supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', last24h);

      const { count: webhookMismatches } = await supabase
        .from('billing_sync_log')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', last24h)
        .eq('mismatch_detected', true);

      // Email: check if table exists
      let emailStatus: HealthStatus = 'unknown';
      let emailDetail = 'Email logging table (email_send_log) not available';
      let emailEvidence = 'Table does not exist or is not accessible — email delivery is not tracked';
      let emailTableExists = false;
      try {
        const { count: emailFails, error: emailError } = await (supabase as any)
          .from('email_send_log')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', last24h)
          .in('status', ['failed', 'dlq']);
        
        if (emailError && (emailError.message?.includes('relation') || emailError.code === '42P01')) {
          // Table doesn't exist
        } else {
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
            emailEvidence = 'Table exists but has no recent records — cannot determine delivery health';
          } else if (fails === 0) {
            emailStatus = 'no_failures';
            emailDetail = `${total} email${total !== 1 ? 's' : ''} logged, 0 failures in last 24h`;
            emailEvidence = 'Based on email_send_log records — no failed or DLQ entries detected';
          } else if (fails < 3) {
            emailStatus = 'warning';
            emailDetail = `${fails} failed / ${total} total in last 24h`;
            emailEvidence = 'Based on email_send_log — some delivery failures detected';
          } else {
            emailStatus = 'error';
            emailDetail = `${fails} failed / ${total} total in last 24h`;
            emailEvidence = 'Based on email_send_log — significant delivery failures detected';
          }
        }
      } catch {
        // table doesn't exist
      }

      // Support access grants
      const { count: expiredGrants } = await supabase
        .from('support_access_grants')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .lt('expires_at', now);

      // Determine system operations status
      const sysFailures = failureCount24h || 0;
      const sysTotal = totalActions24h || 0;
      let sysStatus: HealthStatus;
      let sysEvidence: string;
      if (sysTotal === 0) {
        sysStatus = 'unknown';
        sysEvidence = 'No audit log entries in last 24h — cannot assess operational health';
      } else if (sysFailures === 0) {
        sysStatus = 'no_failures';
        sysEvidence = `Based on ${sysTotal} audit log entries — no failure results recorded`;
      } else if (sysFailures < 5) {
        sysStatus = 'warning';
        sysEvidence = `Based on audit_logs — ${sysFailures} action${sysFailures !== 1 ? 's' : ''} recorded as failed`;
      } else {
        sysStatus = 'error';
        sysEvidence = `Based on audit_logs — ${sysFailures} failures detected, review recommended`;
      }

      // Webhook status
      const whMismatches = webhookMismatches || 0;
      let whStatus: HealthStatus;
      let whEvidence: string;
      if (whMismatches === 0) {
        whStatus = 'no_failures';
        whEvidence = 'Based on billing_sync_log — no plan/status mismatches detected in last 24h';
      } else {
        whStatus = 'warning';
        whEvidence = `Based on billing_sync_log — ${whMismatches} mismatch${whMismatches > 1 ? 'es' : ''} between Stripe and local subscription state`;
      }

      const checks: HealthCheck[] = [
        {
          name: 'System Operations',
          status: sysStatus,
          detail: sysTotal === 0 ? 'No activity logged in last 24h' : `${sysFailures} failure${sysFailures !== 1 ? 's' : ''} / ${sysTotal} actions in last 24h`,
          evidence: sysEvidence,
          lastChecked: now,
          icon: Activity,
          drillDownHref: '/admin/audit-logs',
          drillDownLabel: 'View Audit Trail',
        },
        {
          name: 'Stripe Webhooks',
          status: whStatus,
          detail: whMismatches === 0 ? 'No mismatches in last 24h' : `${whMismatches} mismatch${whMismatches > 1 ? 'es' : ''} detected`,
          evidence: whEvidence,
          lastChecked: now,
          icon: Webhook,
          drillDownHref: '/admin/payments',
          drillDownLabel: 'View Payments',
        },
        {
          name: 'Email Delivery',
          status: emailStatus,
          detail: emailDetail,
          evidence: emailEvidence,
          lastChecked: now,
          icon: Mail,
          drillDownHref: emailTableExists ? '/admin/email-log' : undefined,
          drillDownLabel: emailTableExists ? 'View Email Log' : undefined,
        },
        {
          name: 'Support Access Grants',
          status: (expiredGrants || 0) === 0 ? 'no_failures' : 'warning',
          detail: (expiredGrants || 0) === 0 ? 'All grants current' : `${expiredGrants} expired grant${(expiredGrants || 0) > 1 ? 's' : ''} still marked active`,
          evidence: (expiredGrants || 0) === 0
            ? 'Based on support_access_grants table — no active grants past their expiry'
            : 'Based on support_access_grants — some grants have expired but remain marked active',
          lastChecked: now,
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

  useEffect(() => { fetchHealth(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHealth();
  };

  const statusIcon = (status: HealthStatus) => {
    switch (status) {
      case 'no_failures': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-warning-foreground" />;
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
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Activity className="h-5 md:h-6 w-5 md:w-6 text-primary" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold">System Health</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Indirect health signals from audit logs, sync logs, and access grants</p>
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

            {/* Recent Failures */}
            <Card className="hover:shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Recent Failures
                  {recentFailures.length > 0 && (
                    <Badge variant="destructive" className="text-xs">{recentFailures.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentFailures.length === 0 ? (
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-border/40 bg-muted/10">
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">No recent failures recorded in audit logs.</p>
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5">This only tracks actions logged to audit_logs with result = 'failure'.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentFailures.map(failure => (
                      <div key={failure.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/5">
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{failure.action}</span>
                            <Badge variant="secondary" className="text-[10px]">{failure.resource_type}</Badge>
                          </div>
                          {failure.context_hint && (
                            <p className="text-xs text-muted-foreground mt-0.5">{failure.context_hint}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground/60 mt-1">
                            {formatDistanceToNow(new Date(failure.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
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
