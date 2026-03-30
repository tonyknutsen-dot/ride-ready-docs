import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity, RefreshCw, Loader2, CheckCircle, AlertTriangle, XCircle,
  Webhook, Mail, Database, ArrowRight, HelpCircle,
} from 'lucide-react';
import { subHours } from 'date-fns';

type HealthStatus = 'no_failures' | 'warning' | 'error' | 'unknown';

interface HealthCheck {
  name: string;
  status: HealthStatus;
  detail: string;
  evidence: string;
  icon: typeof Activity;
  drillDownHref?: string;
  drillDownLabel?: string;
}

export default function SystemHealth() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = async () => {
    try {
      const last24h = subHours(new Date(), 24).toISOString();
      const now = new Date().toISOString();

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

      const whMismatches = webhookMismatches || 0;

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
          status: whMismatches === 0 ? 'no_failures' : 'warning',
          detail: whMismatches === 0 ? 'No mismatches in last 24h' : `${whMismatches} mismatch${whMismatches > 1 ? 'es' : ''}`,
          evidence: whMismatches === 0 ? 'No plan/status mismatches in last 24h' : `${whMismatches} mismatch${whMismatches > 1 ? 'es' : ''} between Stripe and local state`,
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
          evidence: (expiredGrants || 0) === 0 ? 'No active grants past expiry' : 'Some grants expired but remain active',
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
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHealth();
  };

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
              <h1 className="text-xl md:text-2xl font-bold">System Health</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Operational health from audit logs, webhooks, email delivery, and access grants</p>
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
        )}
      </div>
    </AdminLayout>
  );
}
