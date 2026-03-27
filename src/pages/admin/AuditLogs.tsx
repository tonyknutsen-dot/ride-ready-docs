import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  History, RefreshCw, Search, Users, FileText, LogIn, Download, Shield,
  AlertTriangle, ChevronRight, Loader2, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format, subDays } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AuditDetailDrawer,
  AuditEntry,
  getEventResult,
  getTargetName,
  getEventFamily,
  getResourceLabel,
  ACTION_VERBS,
  RESULT_VARIANTS,
  EVENT_FAMILIES,
} from '@/components/admin/AuditDetailDrawer';

// ── KPI Card ──

function KpiCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground leading-tight truncate">{label}</p>
        </div>
      </div>
    </Card>
  );
}

// ── Result badge ──

function ResultBadge({ result }: { result: string }) {
  const rv = RESULT_VARIANTS[result] || RESULT_VARIANTS.success;
  return <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${rv.className}`}>{rv.label}</Badge>;
}

// ── Family options ──

const FAMILY_OPTIONS = [
  { value: 'all', label: 'All Families' },
  { value: 'Authentication', label: 'Authentication' },
  { value: 'Documents', label: 'Documents' },
  { value: 'Checks & Records', label: 'Checks & Records' },
  { value: 'Libraries & Requests', label: 'Libraries & Requests' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Equipment', label: 'Equipment' },
  { value: 'User & Access', label: 'User & Access' },
  { value: 'System', label: 'System' },
];

const ACTION_OPTIONS = [
  'all', 'login', 'logout', 'lock', 'unlock', 'failed_unlock',
  'view', 'download', 'share', 'export',
  'create', 'update', 'delete', 'archive', 'unarchive', 'support_view',
];

const RESULT_OPTIONS = ['all', 'success', 'failed', 'blocked'];

const DATE_OPTIONS = [
  { value: '1', label: 'Last 24h' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

// ── Page ──

const AuditLogs = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState({ events: 0, users: 0, failed: 0, logins: 0, highRisk: 0, admin: 0 });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('7');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Detail drawer
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const pageSize = 50;

  // Profile cache
  const [profileMap, setProfileMap] = useState<Map<string, { name: string; email: string }>>(new Map());

  const fetchProfiles = useCallback(async (userIds: string[]) => {
    const missing = userIds.filter(id => !profileMap.has(id));
    if (missing.length === 0) return profileMap;

    const { data } = await supabase
      .from('profiles')
      .select('user_id, controller_name, company_name')
      .in('user_id', missing);

    const newMap = new Map(profileMap);
    data?.forEach(p => {
      newMap.set(p.user_id, {
        name: p.controller_name || p.company_name || 'Unknown',
        email: '', // email not in profiles table for security
      });
    });
    setProfileMap(newMap);
    return newMap;
  }, [profileMap]);

  const fetchStats = async () => {
    const yesterday = subDays(new Date(), 1).toISOString();

    const [totalRes, uniqueRes, loginRes, failedRes] = await Promise.all([
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', yesterday),
      supabase.from('audit_logs').select('user_id').gte('created_at', yesterday),
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'login').gte('created_at', yesterday),
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'failed_unlock').gte('created_at', yesterday),
    ]);

    const uniqueUserIds = new Set(uniqueRes.data?.map(d => d.user_id) || []);

    // Count high-risk actions (delete, support_view, failed_unlock)
    const { count: highRiskCount } = await supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .in('action', ['delete', 'support_view', 'failed_unlock'])
      .gte('created_at', yesterday);

    // Count admin actions (support_view + actions on library types)
    const { count: adminCount } = await supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .in('resource_type', ['check_library_item', 'risk_library', 'document_type', 'equipment_type'])
      .gte('created_at', yesterday);

    setStats({
      events: totalRes.count || 0,
      users: uniqueUserIds.size,
      failed: (failedRes.count || 0),
      logins: loginRes.count || 0,
      highRisk: highRiskCount || 0,
      admin: adminCount || 0,
    });
  };

  const fetchLogs = async (reset = false) => {
    try {
      const currentPage = reset ? 0 : page;
      const fromDate = subDays(new Date(), parseInt(dateFilter)).toISOString();

      let query = supabase
        .from('audit_logs')
        .select('*')
        .gte('created_at', fromDate)
        .order('created_at', { ascending: false })
        .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);

      if (actionFilter !== 'all') query = query.eq('action', actionFilter);

      // Family filter maps to resource_types
      if (familyFilter !== 'all') {
        const matchingTypes = Object.entries(EVENT_FAMILIES)
          .filter(([, family]) => family === familyFilter)
          .map(([type]) => type);
        if (matchingTypes.length > 0) {
          query = query.in('resource_type', matchingTypes);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const rawLogs = data || [];

      // Fetch profiles
      const uniqueUserIds = [...new Set(rawLogs.map(l => l.user_id))];
      const pMap = await fetchProfiles(uniqueUserIds);

      const enriched: AuditEntry[] = rawLogs.map(log => ({
        ...log,
        details: log.details as Record<string, any> | null,
        actor_name: pMap.get(log.user_id)?.name || 'Unknown',
        actor_email: pMap.get(log.user_id)?.email || '',
      }));

      if (reset) {
        setLogs(enriched);
        setPage(0);
      } else {
        setLogs(prev => [...prev, ...enriched]);
      }
      setHasMore(enriched.length === pageSize);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({ title: 'Error', description: 'Failed to fetch audit logs', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchStats();
    fetchLogs(true);
  }, [actionFilter, familyFilter, dateFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchLogs(true)]);
    toast({ title: 'Refreshed', description: 'Audit logs updated' });
  };

  // Client-side filters: search + result
  const filteredLogs = logs.filter(log => {
    if (resultFilter !== 'all' && getEventResult(log) !== resultFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const haystack = [
        log.actor_name, log.action, log.resource_type,
        getTargetName(log), JSON.stringify(log.details),
      ].join(' ').toLowerCase();
      if (!haystack.includes(s)) return false;
    }
    return true;
  });

  // Export
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Actor', 'Action', 'Family', 'Target Type', 'Target Name', 'Result', 'IP Address'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.actor_name || '',
      ACTION_VERBS[log.action] || log.action,
      getEventFamily(log),
      getResourceLabel(log.resource_type),
      getTargetName(log),
      getEventResult(log),
      log.ip_address || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeFilterCount = [familyFilter !== 'all', actionFilter !== 'all', resultFilter !== 'all'].filter(Boolean).length;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-3 md:space-y-4 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <History className="h-5 w-5 md:h-6 md:w-6 text-primary flex-shrink-0" />
              <span className="truncate">Audit Trail</span>
            </h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Platform-wide activity and compliance audit log
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="hidden sm:flex">
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-2 grid-cols-3 md:grid-cols-6">
          <KpiCard label="Events (24h)" value={stats.events} icon={History} />
          <KpiCard label="Active Users" value={stats.users} icon={Users} />
          <KpiCard label="Failed / Blocked" value={stats.failed} icon={AlertTriangle} />
          <KpiCard label="Logins" value={stats.logins} icon={LogIn} />
          <KpiCard label="High-Risk" value={stats.highRisk} icon={Shield} />
          <KpiCard label="Admin Actions" value={stats.admin} icon={FileText} />
        </div>

        {/* Search + Date + Filters */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actor, action, target…"
                className="pl-9 h-9 text-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[110px] h-9 text-xs flex-shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Collapsible filters */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
                <ChevronDown className={`h-3 w-3 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="default" className="ml-1 h-4 px-1 text-[10px]">{activeFilterCount}</Badge>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex gap-2 flex-wrap pt-1">
                <Select value={familyFilter} onValueChange={setFamilyFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Family" />
                  </SelectTrigger>
                  <SelectContent>
                    {FAMILY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map(a => (
                      <SelectItem key={a} value={a}>{a === 'all' ? 'All Actions' : a.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={resultFilter} onValueChange={setResultFilter}>
                  <SelectTrigger className="w-[110px] h-8 text-xs">
                    <SelectValue placeholder="Result" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESULT_OPTIONS.map(r => (
                      <SelectItem key={r} value={r}>{r === 'all' ? 'All Results' : r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                    setFamilyFilter('all');
                    setActionFilter('all');
                    setResultFilter('all');
                  }}>Clear</Button>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Mobile export */}
        <div className="sm:hidden">
          <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        </div>

        {/* Event List */}
        <div className="space-y-1.5">
          {filteredLogs.length === 0 ? (
            <Card className="p-8">
              <div className="text-center space-y-2">
                <History className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm font-medium text-muted-foreground">No audit events matched these filters.</p>
                <p className="text-xs text-muted-foreground/70">Try adjusting your search or date range.</p>
              </div>
            </Card>
          ) : (
            filteredLogs.map(log => {
              const result = getEventResult(log);
              const targetName = getTargetName(log);
              const family = getEventFamily(log);

              return (
                <button
                  key={log.id}
                  onClick={() => { setSelectedEntry(log); setDrawerOpen(true); }}
                  className="w-full text-left rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-start gap-2.5">
                    {/* Left: content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Actor + verb + target */}
                      <p className="text-sm leading-snug">
                        <span className="font-semibold">{log.actor_name}</span>
                        <span className="text-muted-foreground">{' '}{ACTION_VERBS[log.action] || log.action}{' '}</span>
                        <span className="text-muted-foreground">{getResourceLabel(log.resource_type).toLowerCase()}{' '}</span>
                        <span className="font-medium truncate">{targetName !== '—' ? `"${targetName}"` : ''}</span>
                      </p>
                      {/* Meta row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(log.created_at), 'dd MMM yyyy HH:mm')}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{family}</Badge>
                        <ResultBadge result={result} />
                      </div>
                    </div>
                    {/* Right: chevron */}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground mt-0.5 flex-shrink-0" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Load more */}
        {hasMore && filteredLogs.length > 0 && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" size="sm" onClick={() => { setPage(p => p + 1); fetchLogs(); }}>
              Load More
            </Button>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <AuditDetailDrawer entry={selectedEntry} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </AdminLayout>
  );
};

export default AuditLogs;
