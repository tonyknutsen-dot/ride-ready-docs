import { useEffect, useMemo, useState } from 'react';
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
  Shield, Upload,
} from 'lucide-react';
import { formatDistanceToNow, subDays, subHours, format } from 'date-fns';

type TimeRange = '24h' | '7d' | '30d';
type FailureCategory = 'Webhooks' | 'PDF Generation' | 'Storage / Uploads' | 'Email' | 'Authentication' | 'Other';
type CategoryKey = 'all' | FailureCategory;

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

interface CategoryCard {
  key: FailureCategory;
  label: string;
  icon: typeof Activity;
  count: number;
  status: 'no_failures' | 'failures' | 'unknown';
  evidence: string;
}

const CATEGORY_CONFIG: CategoryCard[] = [
  { key: 'Webhooks', label: 'Webhooks', icon: Webhook, count: 0, status: 'unknown', evidence: '' },
  { key: 'PDF Generation', label: 'PDF Generation', icon: Wrench, count: 0, status: 'unknown', evidence: '' },
  { key: 'Storage / Uploads', label: 'Storage / Uploads', icon: Upload, count: 0, status: 'unknown', evidence: '' },
  { key: 'Email', label: 'Email Jobs', icon: Mail, count: 0, status: 'unknown', evidence: '' },
  { key: 'Authentication', label: 'Authentication', icon: Shield, count: 0, status: 'unknown', evidence: '' },
  { key: 'Other', label: 'Other Failures', icon: AlertTriangle, count: 0, status: 'unknown', evidence: '' },
];

const uniqueByKey = <T extends { key: string }>(items: T[]): T[] =>
  Array.from(new Map(items.map((item) => [item.key, item])).values());

function categorizeFailure(f: FailureEntry): FailureCategory {
  const action = f.action?.toLowerCase() || '';
  const resource = f.resource_type?.toLowerCase() || '';
  const hint = f.context_hint?.toLowerCase() || '';

  if (action.includes('webhook') || resource.includes('stripe') || resource.includes('webhook') || hint.includes('webhook')) return 'Webhooks';
  if (action.includes('pdf') || resource.includes('pdf') || hint.includes('pdf')) return 'PDF Generation';
  if (action.includes('upload') || action.includes('storage') || resource.includes('document') || resource.includes('storage')) return 'Storage / Uploads';
  if (action.includes('email') || resource.includes('email') || hint.includes('email')) return 'Email';
  if (action.includes('auth') || resource.includes('auth') || action.includes('login') || action.includes('unlock')) return 'Authentication';
  return 'Other';
}

export default function JobsQueues() {
  const [failures, setFailures] = useState<FailureEntry[]>([]);
  const [totalActions, setTotalActions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey>('all');

  const uniqueCategoryConfig = useMemo(() => uniqueByKey(CATEGORY_CONFIG), []);

  const getStartDate = (range: TimeRange) => {
    switch (range) {
      case '24h': return subHours(new Date(), 24).toISOString();
      case '7d': return subDays(new Date(), 7).toISOString();
      case '30d': return subDays(new Date(), 30).toISOString();
    }
  };

  const fetchData = async () => {
    try {
      const startDate = getStartDate(timeRange);

      const [failureRes, totalRes] = await Promise.all([
        supabase
          .from('audit_logs')
          .select('id, action, resource_type, result, created_at, details, context_hint, equipment_name')
          .eq('result', 'failure')
          .gte('created_at', startDate)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('audit_logs')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startDate),
      ]);

      setFailures((failureRes.data as FailureEntry[]) || []);
      setTotalActions(totalRes.count || 0);
    } catch (error) {
      console.error('Error fetching jobs data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [timeRange]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<FailureCategory, number>> = {};
    failures.forEach((failure) => {
      const category = categorizeFailure(failure);
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, [failures]);

  const categoryCards = useMemo(
    () => uniqueByKey(uniqueCategoryConfig.map((cfg) => {
      const count = categoryCounts[cfg.key] || 0;
      return {
        ...cfg,
        count,
        status: totalActions === 0 ? 'unknown' : count > 0 ? 'failures' : 'no_failures',
        evidence: totalActions === 0
          ? 'No audit log entries in selected period'
          : count > 0
            ? `${count} failure${count !== 1 ? 's' : ''} from audit_logs`
            : `No failures in ${totalActions} logged actions`,
      };
    })),
    [categoryCounts, totalActions, uniqueCategoryConfig],
  );

  const filteredFailures = categoryFilter === 'all'
    ? failures
    : failures.filter((failure) => categorizeFailure(failure) === categoryFilter);

  const rangeLabel = timeRange === '24h' ? '24 hours' : timeRange === '7d' ? '7 days' : '30 days';

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Activity className="h-5 md:h-6 w-5 md:w-6 text-primary" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Jobs & Queues</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Webhooks, background jobs, PDFs, uploads, and failure tracking</p>
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
            {/* Summary Cards — exactly 6 */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
              {categoryCards.map((card) => (
                <button
                  key={card.key}
                  onClick={() => setCategoryFilter(categoryFilter === card.key ? 'all' : card.key)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    categoryFilter === card.key
                      ? 'border-primary bg-primary/5'
                      : card.count > 0
                        ? 'border-destructive/30 bg-destructive/5 hover:border-destructive/50'
                        : 'border-border/40 bg-card hover:border-border'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {card.count > 0 ? (
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    ) : card.status === 'unknown' ? (
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    )}
                    <span className="text-xs font-medium truncate">{card.label}</span>
                  </div>
                  <p className="text-lg font-bold leading-none mb-1">{card.count}</p>
                  <p className="text-[10px] text-muted-foreground/60 leading-tight">{card.evidence}</p>
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1">
                {(['24h', '7d', '30d'] as TimeRange[]).map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                    className="text-xs h-7 px-2"
                  >
                    {range}
                  </Button>
                ))}
              </div>
              <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as CategoryKey)}>
                <SelectTrigger className="w-[160px] h-7 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategoryConfig.map((category) => (
                    <SelectItem key={category.key} value={category.key}>
                      {category.label} {categoryCounts[category.key] ? `(${categoryCounts[category.key]})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoryFilter !== 'all' && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setCategoryFilter('all')}>
                  Clear filter
                </Button>
              )}
            </div>

            {/* Recent Failures */}
            <Card className="hover:shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Recent Failures
                  {filteredFailures.length > 0 && (
                    <Badge variant="destructive" className="text-xs">{filteredFailures.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredFailures.length === 0 ? (
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-border/40 bg-muted/10">
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {categoryFilter !== 'all'
                          ? `No ${categoryFilter.toLowerCase()} failures in the last ${rangeLabel}.`
                          : `No recent failures recorded for the last ${rangeLabel}.`
                        }
                      </p>
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                        Based on audit_logs where result = 'failure'.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
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
                              <span className="ml-2 text-muted-foreground/40">{format(new Date(failure.created_at), 'dd MMM HH:mm')}</span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Related Pages */}
            <Card className="hover:shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Related Pages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                  {[
                    { label: 'Audit Logs', href: '/admin/audit-logs', desc: 'Full action history', icon: Database },
                    { label: 'Email Log', href: '/admin/email-log', desc: 'Sent, failed, queued emails', icon: Mail },
                    { label: 'Payments & Billing', href: '/admin/payments', desc: 'Stripe sync and webhooks', icon: Webhook },
                    { label: 'Support Access Grants', href: '/admin/support-access', desc: 'Active and expired grants', icon: Shield },
                  ].map(link => (
                    <Link key={link.href} to={link.href} className="group">
                      <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 bg-card hover:bg-accent/5 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <link.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                          <div>
                            <span className="text-xs font-medium">{link.label}</span>
                            <p className="text-[10px] text-muted-foreground/50">{link.desc}</p>
                          </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
