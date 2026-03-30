import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import {
  Mail, RefreshCw, Loader2, CheckCircle, XCircle, Clock,
  Send, AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow, subDays, subHours } from 'date-fns';

interface EmailStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  suppressed: number;
}

interface EmailLogEntry {
  id: string;
  message_id: string;
  template_name: string | null;
  recipient_email: string | null;
  subject: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

type TimeRange = '24h' | '7d' | '30d';

export default function EmailLog() {
  const [stats, setStats] = useState<EmailStats>({ total: 0, sent: 0, failed: 0, pending: 0, suppressed: 0 });
  const [entries, setEntries] = useState<EmailLogEntry[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tableAvailable, setTableAvailable] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');

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

      let query = (supabase as any)
        .from('email_send_log')
        .select('id, message_id, template_name, recipient_email, subject, status, error_message, created_at')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        if (statusFilter === 'failed') {
          query = query.in('status', ['failed', 'dlq']);
        } else {
          query = query.eq('status', statusFilter);
        }
      }

      if (templateFilter !== 'all') {
        query = query.eq('template_name', templateFilter);
      }

      const { data, error } = await query;

      if (error) {
        if (error.message?.includes('relation') || error.code === '42P01') {
          setTableAvailable(false);
        }
        console.error('Email log query error:', error);
        return;
      }

      setTableAvailable(true);
      const rows = (data as EmailLogEntry[]) || [];

      const byMessageId = new Map<string, EmailLogEntry>();
      for (const row of rows) {
        const key = row.message_id || row.id;
        const existing = byMessageId.get(key);
        if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
          byMessageId.set(key, row);
        }
      }
      const deduped = Array.from(byMessageId.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setEntries(deduped);

      const sent = deduped.filter(e => e.status === 'sent').length;
      const failed = deduped.filter(e => ['failed', 'dlq'].includes(e.status)).length;
      const pending = deduped.filter(e => e.status === 'pending').length;
      const suppressed = deduped.filter(e => e.status === 'suppressed').length;
      setStats({ total: deduped.length, sent, failed, pending, suppressed });

      const { data: tplData } = await (supabase as any)
        .from('email_send_log')
        .select('template_name')
        .gte('created_at', startDate)
        .not('template_name', 'is', null);

      if (tplData) {
        const unique = [...new Set((tplData as any[]).map(t => t.template_name).filter(Boolean))] as string[];
        setTemplates(unique.sort());
      }
    } catch (error) {
      console.error('Error fetching email log:', error);
      setTableAvailable(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [timeRange, statusFilter, templateFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">Sent</Badge>;
      case 'failed':
      case 'dlq': return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      case 'pending': return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs">Pending</Badge>;
      case 'suppressed': return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">Suppressed</Badge>;
      case 'bounced': return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 text-xs">Bounced</Badge>;
      case 'complained': return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-xs">Complained</Badge>;
      default: return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Mail className="h-5 md:h-6 w-5 md:w-6 text-primary" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Email Log</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Sent, failed, and queued email communications</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {!tableAvailable ? (
          <Card className="hover:shadow-none border-dashed">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <Mail className="h-10 w-10 text-muted-foreground/20" />
                <div>
                  <p className="text-sm font-semibold">Email logging not yet active</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    The <code className="text-[11px] px-1 py-0.5 rounded bg-muted">email_send_log</code> table does not exist. Until email infrastructure logs to this table, no delivery data is available.
                  </p>
                  <p className="text-[11px] text-muted-foreground/50 mt-2">
                    This is not an error — it means email tracking has not been configured yet. Stats showing "0" on other pages reflect this absence, not confirmed zero activity.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : loading && !refreshing ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex gap-1">
                {(['24h', '7d', '30d'] as TimeRange[]).map(range => (
                  <Button
                    key={range}
                    variant={timeRange === range ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                    className="text-xs"
                  >
                    {range === '24h' ? 'Last 24h' : range === '7d' ? 'Last 7 days' : 'Last 30 days'}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2 flex-1">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="suppressed">Suppressed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={templateFilter} onValueChange={setTemplateFilter}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder="Template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Templates</SelectItem>
                    {templates.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <Card className="hover:shadow-none">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Send className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Total</p>
                  </div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-none">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Sent</p>
                  </div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.sent}</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-none">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Failed</p>
                  </div>
                  <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
                </CardContent>
              </Card>
              <Card className="hover:shadow-none">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Pending</p>
                  </div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="hover:shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Email History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {entries.length === 0 ? (
                  <div className="flex items-center gap-3 p-6">
                    <Mail className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">No emails match the current filters.</p>
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                        {statusFilter !== 'all' || templateFilter !== 'all'
                          ? 'Try adjusting the status or template filter, or expanding the time range.'
                          : `No records found in the last ${timeRange === '24h' ? '24 hours' : timeRange === '7d' ? '7 days' : '30 days'}. This may mean no emails were sent in this period.`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                         <TableRow>
                           <TableHead className="text-xs">Template</TableHead>
                           <TableHead className="text-xs hidden sm:table-cell">Recipient</TableHead>
                           <TableHead className="text-xs hidden md:table-cell">Subject</TableHead>
                           <TableHead className="text-xs">Status</TableHead>
                           <TableHead className="text-xs">Time</TableHead>
                           <TableHead className="text-xs hidden lg:table-cell">Error</TableHead>
                         </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map(entry => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-xs font-medium py-2.5">
                              {entry.template_name || '—'}
                              <span className="sm:hidden block text-muted-foreground mt-0.5 truncate max-w-[150px]">
                                {entry.recipient_email || '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden sm:table-cell py-2.5 max-w-[200px] truncate">
                              {entry.recipient_email || '—'}
                            </TableCell>
                            <TableCell className="py-2.5">{statusBadge(entry.status)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground py-2.5 whitespace-nowrap">
                              {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                            </TableCell>
                            <TableCell className="text-xs text-destructive/80 hidden md:table-cell py-2.5 max-w-[200px] truncate">
                              {entry.error_message || ''}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
