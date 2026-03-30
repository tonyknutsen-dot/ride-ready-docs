import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity, RefreshCw, Loader2, CheckCircle, AlertTriangle, XCircle,
  Webhook, FileText, Mail, Upload, Clock, Database,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  detail: string;
  lastChecked: string;
  icon: typeof Activity;
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
      // Fetch recent failures from audit logs
      const { data: failures } = await supabase
        .from('audit_logs')
        .select('id, action, resource_type, result, created_at, details, context_hint')
        .eq('result', 'failure')
        .order('created_at', { ascending: false })
        .limit(20);

      setRecentFailures((failures as RecentFailure[]) || []);

      // Build health checks from available data
      const now = new Date().toISOString();

      // Check edge function health via recent audit log patterns
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

      // Check webhook health (billing sync log for stripe webhooks)
      const { count: webhookFailures } = await supabase
        .from('billing_sync_log')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', last24h)
        .eq('mismatch_detected', true);

      // Check email health via email_send_log if it exists
      let emailFailures = 0;
      let emailTotal = 0;
      try {
        const { count: emailFails } = await (supabase as any)
          .from('email_send_log')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', last24h)
          .in('status', ['failed', 'dlq']);
        emailFailures = emailFails || 0;

        const { count: emailAll } = await (supabase as any)
          .from('email_send_log')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', last24h);
        emailTotal = emailAll || 0;
      } catch {
        // email_send_log may not exist yet
      }

      // Check support access grant health
      const { count: expiredGrants } = await supabase
        .from('support_access_grants')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .lt('expires_at', now);

      const checks: HealthCheck[] = [
        {
          name: 'System Operations',
          status: (failureCount24h || 0) === 0 ? 'healthy' : (failureCount24h || 0) < 5 ? 'warning' : 'error',
          detail: `${failureCount24h || 0} failures / ${totalActions24h || 0} actions in last 24h`,
          lastChecked: now,
          icon: Activity,
        },
        {
          name: 'Stripe Webhooks',
          status: (webhookFailures || 0) === 0 ? 'healthy' : 'warning',
          detail: (webhookFailures || 0) === 0 ? 'No mismatches in last 24h' : `${webhookFailures} mismatch${(webhookFailures || 0) > 1 ? 'es' : ''} detected`,
          lastChecked: now,
          icon: Webhook,
        },
        {
          name: 'Email Delivery',
          status: emailTotal === 0 ? 'unknown' : emailFailures === 0 ? 'healthy' : emailFailures < 3 ? 'warning' : 'error',
          detail: emailTotal === 0 ? 'No email data available' : `${emailFailures} failed / ${emailTotal} sent in last 24h`,
          lastChecked: now,
          icon: Mail,
        },
        {
          name: 'Support Access Grants',
          status: (expiredGrants || 0) === 0 ? 'healthy' : 'warning',
          detail: (expiredGrants || 0) === 0 ? 'All grants current' : `${expiredGrants} expired grant${(expiredGrants || 0) > 1 ? 's' : ''} still marked active`,
          lastChecked: now,
          icon: Database,
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

  const statusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-warning-foreground" />;
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">Healthy</Badge>;
      case 'warning': return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">Warning</Badge>;
      case 'error': return <Badge variant="destructive" className="text-xs">Error</Badge>;
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
              <p className="text-sm text-muted-foreground mt-0.5">Jobs, queues, webhooks, and failure tracking</p>
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {statusIcon(check.status)}
                        <div>
                          <p className="text-sm font-medium">{check.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
                        </div>
                      </div>
                      {statusBadge(check.status)}
                    </div>
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
                    <p className="text-sm text-muted-foreground">No recent failures recorded.</p>
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
