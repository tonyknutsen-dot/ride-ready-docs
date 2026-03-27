import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  History, RefreshCw, Search, Users, Download, Shield,
  AlertTriangle, ChevronRight, Loader2, ChevronDown, FileDown,
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
  getContextHint,
  ACTION_VERBS,
  RESULT_VARIANTS,
  EVENT_FAMILIES,
  HIGH_PRIORITY_ACTIONS,
  HIGH_PRIORITY_RESULTS,
} from '@/components/admin/AuditDetailDrawer';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── KPI Card ──

function KpiCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: React.ElementType; accent?: boolean }) {
  return (
    <Card className={`p-3 ${accent && value > 0 ? 'border-destructive/30 bg-destructive/5' : ''}`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${accent && value > 0 ? 'bg-destructive/10' : 'bg-primary/10'}`}>
          <Icon className={`h-4 w-4 ${accent && value > 0 ? 'text-destructive' : 'text-primary'}`} />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
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
  { value: 'Checks', label: 'Checks' },
  { value: 'Libraries', label: 'Libraries' },
  { value: 'Requests', label: 'Requests' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Equipment', label: 'Equipment' },
  { value: 'Security', label: 'Security' },
  { value: 'Billing', label: 'Billing' },
  { value: 'Compliance', label: 'Compliance' },
  { value: 'System', label: 'System' },
];

const ACTION_OPTIONS = [
  'all', 'login', 'logout', 'lock', 'unlock', 'failed_unlock',
  'view', 'download', 'share', 'export',
  'create', 'update', 'delete', 'archive', 'unarchive',
  'approve', 'reject', 'import', 'send',
  'grant', 'revoke', 'complete', 'close',
  'subscribe', 'unsubscribe', 'block', 'unblock',
  'support_view',
];

const RESULT_OPTIONS = ['all', 'success', 'failed', 'blocked', 'denied'];

const DATE_OPTIONS = [
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

// Default view excludes routine auth noise
const DEFAULT_EXCLUDED_FAMILIES = new Set<string>();
// We don't exclude by default anymore, but provide a quick toggle

// ── Page ──

const AuditLogs = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState({ events: 0, users: 0, failed: 0, highRisk: 0 });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('7');
  const [hideRoutineAuth, setHideRoutineAuth] = useState(true);
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
        email: '',
      });
    });
    setProfileMap(newMap);
    return newMap;
  }, [profileMap]);

  const fetchStats = async () => {
    const yesterday = subDays(new Date(), 1).toISOString();

    const [totalRes, uniqueRes, failedRes, highRiskRes] = await Promise.all([
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', yesterday),
      supabase.from('audit_logs').select('user_id').gte('created_at', yesterday),
      supabase.from('audit_logs').select('id', { count: 'exact', head: true })
        .or('action.eq.failed_unlock,result.eq.failed,result.eq.blocked')
        .gte('created_at', yesterday),
      supabase.from('audit_logs').select('id', { count: 'exact', head: true })
        .in('action', ['delete', 'support_view', 'failed_unlock', 'approve', 'reject', 'grant', 'revoke', 'block'])
        .gte('created_at', yesterday),
    ]);

    const uniqueUserIds = new Set(uniqueRes.data?.map(d => d.user_id) || []);

    setStats({
      events: totalRes.count || 0,
      users: uniqueUserIds.size,
      failed: failedRes.count || 0,
      highRisk: highRiskRes.count || 0,
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
      const uniqueUserIds = [...new Set(rawLogs.map(l => l.user_id))];
      const pMap = await fetchProfiles(uniqueUserIds);

      const enriched: AuditEntry[] = rawLogs.map(log => ({
        ...log,
        details: log.details as Record<string, any> | null,
        before_data: log.before_data as Record<string, any> | null,
        after_data: log.after_data as Record<string, any> | null,
        changed_fields: log.changed_fields as string[] | null,
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

  // Client-side filters: search + result + routine auth toggle
  const ROUTINE_AUTH_ACTIONS = new Set(['login', 'logout', 'lock', 'unlock']);

  const filteredLogs = logs.filter(log => {
    if (resultFilter !== 'all' && getEventResult(log) !== resultFilter) return false;
    // Hide routine auth unless viewing Authentication family or auth toggle is off
    if (hideRoutineAuth && familyFilter !== 'Authentication' && ROUTINE_AUTH_ACTIONS.has(log.action) && log.resource_type === 'session') {
      return false;
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const haystack = [
        log.actor_name, log.action, log.resource_type,
        getTargetName(log), log.equipment_name, log.organisation_name,
        log.context_hint, log.reason,
        JSON.stringify(log.details),
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(s)) return false;
    }
    return true;
  });

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Actor', 'Action', 'Family', 'Target Type', 'Target Name', 'Result', 'Context', 'Equipment', 'Organisation', 'Changed Fields', 'Reason', 'IP Address'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.actor_name || '',
      ACTION_VERBS[log.action] || log.action,
      getEventFamily(log),
      getResourceLabel(log.resource_type),
      getTargetName(log),
      getEventResult(log),
      getContextHint(log) || '',
      log.equipment_name || '',
      log.organisation_name || '',
      log.changed_fields?.join(', ') || '',
      log.reason || '',
      log.ip_address || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // PDF Export — summary report
  const handleExportPDF = (detailed = false) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const now = new Date();

    // Title
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 95);
    doc.text(detailed ? 'Detailed Audit Trail Report' : 'Audit Trail Report', 14, 18);

    // Meta line
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${format(now, 'dd MMM yyyy HH:mm')}`, 14, 25);
    doc.text(`Date Range: Last ${dateFilter} day${dateFilter !== '1' ? 's' : ''}`, 14, 30);

    // Active filters
    const activeFilters: string[] = [];
    if (familyFilter !== 'all') activeFilters.push(`Family: ${familyFilter}`);
    if (actionFilter !== 'all') activeFilters.push(`Action: ${actionFilter}`);
    if (resultFilter !== 'all') activeFilters.push(`Result: ${resultFilter}`);
    if (hideRoutineAuth) activeFilters.push('Routine auth hidden');
    if (searchTerm) activeFilters.push(`Search: "${searchTerm}"`);
    if (activeFilters.length > 0) {
      doc.text(`Filters: ${activeFilters.join(' | ')}`, 14, 35);
    }

    // KPI summary
    const kpiY = activeFilters.length > 0 ? 42 : 37;
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`Events (24h): ${stats.events}   |   Active Users: ${stats.users}   |   Failed/Blocked: ${stats.failed}   |   High-Risk: ${stats.highRisk}`, 14, kpiY);
    doc.text(`Total filtered events: ${filteredLogs.length}`, 14, kpiY + 5);

    if (detailed) {
      // Detailed: wider columns with change data
      const headers = ['Timestamp', 'Actor', 'Action', 'Family', 'Target', 'Result', 'Equipment', 'Org', 'Changed Fields', 'Reason'];
      const rows = filteredLogs.map(log => [
        format(new Date(log.created_at), 'dd/MM/yyyy HH:mm'),
        log.actor_name || '',
        ACTION_VERBS[log.action] || log.action,
        getEventFamily(log),
        `${getResourceLabel(log.resource_type)}: ${getTargetName(log)}`,
        getEventResult(log),
        log.equipment_name || '',
        log.organisation_name || '',
        log.changed_fields?.join(', ') || '',
        log.reason || '',
      ]);

      autoTable(doc, {
        startY: kpiY + 10,
        head: [headers],
        body: rows,
        styles: { fontSize: 6, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 58, 95], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
          0: { cellWidth: 26 },
          5: { cellWidth: 14 },
          8: { cellWidth: 35 },
          9: { cellWidth: 30 },
        },
        didDrawCell: (data: any) => {
          // Highlight failed/blocked/denied rows
          if (data.section === 'body' && data.column.index === 5) {
            const val = data.cell.raw;
            if (val === 'failed' || val === 'blocked' || val === 'denied') {
              doc.setFillColor(255, 230, 230);
              doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
              doc.setTextColor(180, 20, 20);
              doc.setFontSize(6);
              doc.text(String(val), data.cell.x + 1.5, data.cell.y + data.cell.height / 2 + 1.5);
            }
          }
        },
      });
    } else {
      // Summary table
      const headers = ['Timestamp', 'Actor', 'Action', 'Family', 'Target', 'Result', 'Context', 'Equipment'];
      const rows = filteredLogs.map(log => [
        format(new Date(log.created_at), 'dd/MM/yyyy HH:mm'),
        log.actor_name || '',
        ACTION_VERBS[log.action] || log.action,
        getEventFamily(log),
        `${getResourceLabel(log.resource_type)}: ${getTargetName(log)}`,
        getEventResult(log),
        getContextHint(log) || '',
        log.equipment_name || '',
      ]);

      autoTable(doc, {
        startY: kpiY + 10,
        head: [headers],
        body: rows,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 95], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
          0: { cellWidth: 30 },
          5: { cellWidth: 18 },
        },
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Ride Ready Docs — ${detailed ? 'Detailed ' : ''}Audit Trail — Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 8);
    }

    doc.save(`audit-trail-${detailed ? 'detailed-' : ''}${format(now, 'yyyy-MM-dd')}.pdf`);
  };

  const activeFilterCount = [
    familyFilter !== 'all',
    actionFilter !== 'all',
    resultFilter !== 'all',
    !hideRoutineAuth,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFamilyFilter('all');
    setActionFilter('all');
    setResultFilter('all');
    setHideRoutineAuth(true);
    setSearchTerm('');
  };

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
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="hidden sm:flex h-8 text-xs">
              <Download className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExportPDF(false)} className="hidden sm:flex h-8 text-xs">
              <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExportPDF(true)} className="hidden sm:flex h-8 text-xs">
              <FileDown className="h-3.5 w-3.5 mr-1" /> Detailed PDF
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
          <KpiCard label="Events (24h)" value={stats.events} icon={History} />
          <KpiCard label="Active Users (24h)" value={stats.users} icon={Users} />
          <KpiCard label="Failed / Blocked" value={stats.failed} icon={AlertTriangle} accent />
          <KpiCard label="High-Risk Actions" value={stats.highRisk} icon={Shield} accent />
        </div>

        {/* Search + Date + Filters */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actor, action, target, equipment…"
                className="pl-9 h-9 text-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[130px] h-9 text-xs flex-shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Collapsible filters */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <div className="flex items-center gap-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
                  <ChevronDown className={`h-3 w-3 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="default" className="ml-1 h-4 px-1.5 text-[10px]">{activeFilterCount}</Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              {/* Routine auth toggle – visible at top level */}
              <button
                onClick={() => setHideRoutineAuth(h => !h)}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${hideRoutineAuth ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground'}`}
              >
                {hideRoutineAuth ? 'Logins hidden' : 'Showing logins'}
              </button>
            </div>
            <CollapsibleContent>
              <div className="flex gap-2 flex-wrap pt-1">
                <Select value={familyFilter} onValueChange={setFamilyFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
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
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>Clear all</Button>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Mobile export */}
        <div className="flex gap-2 sm:hidden">
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => handleExportPDF(false)}>
            <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
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
                {(activeFilterCount > 0 || searchTerm) && (
                  <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={clearFilters}>Reset Filters</Button>
                )}
              </div>
            </Card>
          ) : (
            filteredLogs.map(log => {
              const result = getEventResult(log);
              const targetName = getTargetName(log);
              const family = getEventFamily(log);
              const contextHint = getContextHint(log);
              const isHighPriority = HIGH_PRIORITY_ACTIONS.has(log.action) || HIGH_PRIORITY_RESULTS.has(result);
              const hasChanges = !!(log.changed_fields?.length || log.before_data || log.after_data);

              return (
                <button
                  key={log.id}
                  onClick={() => { setSelectedEntry(log); setDrawerOpen(true); }}
                  className={`w-full text-left rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors group ${isHighPriority ? 'border-l-[3px] border-l-destructive/60' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {/* Line 1: Actor + action verb + record type */}
                      <p className="text-sm leading-snug">
                        <span className="font-semibold">{log.actor_name}</span>
                        <span className="text-muted-foreground">{' '}{ACTION_VERBS[log.action] || log.action}{' '}</span>
                        <span className="text-foreground/70">{getResourceLabel(log.resource_type).toLowerCase()}</span>
                      </p>
                      {/* Line 2: Target name */}
                      {targetName !== '—' && (
                        <p className="text-sm font-medium truncate">{targetName}</p>
                      )}
                      {/* Context hint */}
                      {contextHint && (
                        <p className="text-[11px] text-muted-foreground italic">{contextHint}</p>
                      )}
                      {/* Line 3: Timestamp + family + result + change indicator */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(log.created_at), 'dd MMM yyyy HH:mm')}
                        </span>
                        <span className="text-muted-foreground/40 text-[10px]">•</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{family}</Badge>
                        <ResultBadge result={result} />
                        {hasChanges && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-400/30 text-blue-600">
                            Δ {log.changed_fields?.length || ''}
                          </Badge>
                        )}
                        {log.equipment_name && (
                          <span className="text-[10px] text-muted-foreground/60 truncate max-w-[120px]">⚙ {log.equipment_name}</span>
                        )}
                      </div>
                    </div>
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
