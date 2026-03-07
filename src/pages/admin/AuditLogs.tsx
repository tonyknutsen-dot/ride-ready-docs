import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History, RefreshCw, Search, Users, FileText, LogIn, Download, Eye, Share2, Key, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format, subDays } from 'date-fns';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user_email?: string;
}

interface AuditStats {
  total24h: number;
  uniqueUsers24h: number;
  documentAccesses: number;
  loginEvents: number;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  login: <LogIn className="h-4 w-4" />,
  logout: <LogIn className="h-4 w-4 rotate-180" />,
  lock: <Key className="h-4 w-4" />,
  unlock: <Key className="h-4 w-4" />,
  failed_unlock: <Key className="h-4 w-4" />,
  view: <Eye className="h-4 w-4" />,
  download: <Download className="h-4 w-4" />,
  share: <Share2 className="h-4 w-4" />,
  export: <FileText className="h-4 w-4" />,
  support_view: <Key className="h-4 w-4" />,
};

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-green-500/10 text-green-600 border-green-500/20',
  logout: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  lock: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  unlock: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  failed_unlock: 'bg-red-500/10 text-red-600 border-red-500/20',
  view: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  download: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  share: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  export: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  support_view: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  create: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  update: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  delete: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const AuditLogs = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    total24h: 0,
    uniqueUsers24h: 0,
    documentAccesses: 0,
    loginEvents: 0,
  });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('7');
  const pageSize = 50;

  const fetchStats = async () => {
    const yesterday = subDays(new Date(), 1).toISOString();
    
    const [totalRes, uniqueRes, docRes, loginRes] = await Promise.all([
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', yesterday),
      supabase.from('audit_logs').select('user_id').gte('created_at', yesterday),
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('resource_type', 'document').gte('created_at', yesterday),
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'login').gte('created_at', yesterday),
    ]);

    const uniqueUserIds = new Set(uniqueRes.data?.map(d => d.user_id) || []);
    
    setStats({
      total24h: totalRes.count || 0,
      uniqueUsers24h: uniqueUserIds.size,
      documentAccesses: docRes.count || 0,
      loginEvents: loginRes.count || 0,
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

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }
      if (resourceFilter !== 'all') {
        query = query.eq('resource_type', resourceFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const rawLogs = data || [];
      
      // Fetch user emails for logs
      const uniqueUserIds = [...new Set(rawLogs.map(log => log.user_id))];
      let profileMap = new Map<string, string>();
      
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, company_name')
          .in('user_id', uniqueUserIds);
        
        profileMap = new Map(profiles?.map(p => [p.user_id, p.company_name || 'Unknown']) || []);
      }

      const logsWithEmails: AuditLog[] = rawLogs.map(log => ({
        ...log,
        user_email: profileMap.get(log.user_id) || 'Unknown User',
      }));

      if (reset) {
        setLogs(logsWithEmails);
        setPage(0);
      } else {
        setLogs(prev => [...prev, ...logsWithEmails]);
      }
      
      setHasMore(logsWithEmails.length === pageSize);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch audit logs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchLogs(true);
  }, [actionFilter, resourceFilter, dateFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchLogs(true)]);
    toast({
      title: 'Refreshed',
      description: 'Audit logs have been refreshed',
    });
  };

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
    fetchLogs();
  };

  const filteredLogs = searchTerm
    ? logs.filter(log => 
        log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase())
      )
    : logs;

  const getActionBadge = (action: string) => {
    const colorClass = ACTION_COLORS[action] || 'bg-muted text-muted-foreground';
    const icon = ACTION_ICONS[action];
    return (
      <Badge variant="outline" className={`gap-1 ${colorClass}`}>
        {icon}
        {action}
      </Badge>
    );
  };

  const formatDetails = (details: any) => {
    if (!details || Object.keys(details).length === 0) return '-';
    
    const entries = Object.entries(details).slice(0, 3);
    return entries.map(([key, value]) => (
      <span key={key} className="inline-block mr-2 text-xs">
        <span className="text-muted-foreground">{key}:</span>{' '}
        <span className="font-medium">{String(value).slice(0, 30)}</span>
      </span>
    ));
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
      <div className="space-y-4 md:space-y-6 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <History className="h-5 w-5 md:h-6 md:w-6 text-primary flex-shrink-0" />
              <span className="truncate">Audit Logs</span>
            </h1>
            <p className="text-sm text-muted-foreground hidden sm:block">
              Platform-wide activity tracking
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="flex-shrink-0">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline ml-2">Refresh</span>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Events (24h)</p>
                <p className="text-xl md:text-2xl font-bold">{stats.total24h}</p>
              </div>
              <History className="h-5 w-5 text-muted-foreground hidden sm:block" />
            </div>
          </Card>

          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Users (24h)</p>
                <p className="text-xl md:text-2xl font-bold">{stats.uniqueUsers24h}</p>
              </div>
              <Users className="h-5 w-5 text-muted-foreground hidden sm:block" />
            </div>
          </Card>

          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Doc Accesses</p>
                <p className="text-xl md:text-2xl font-bold">{stats.documentAccesses}</p>
              </div>
              <FileText className="h-5 w-5 text-muted-foreground hidden sm:block" />
            </div>
          </Card>

          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Logins</p>
                <p className="text-xl md:text-2xl font-bold">{stats.loginEvents}</p>
              </div>
              <LogIn className="h-5 w-5 text-muted-foreground hidden sm:block" />
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Activity Log</CardTitle>
            <CardDescription className="text-sm">Platform activity with filters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-3 md:px-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, action, or details..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Filters - horizontal scroll on mobile */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[120px] flex-shrink-0">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="lock">Lock</SelectItem>
                  <SelectItem value="unlock">Unlock</SelectItem>
                  <SelectItem value="failed_unlock">Failed Unlock</SelectItem>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="download">Download</SelectItem>
                  <SelectItem value="share">Share</SelectItem>
                  <SelectItem value="export">Export</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="support_view">Support View</SelectItem>
                </SelectContent>
              </Select>
              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger className="w-[120px] flex-shrink-0">
                  <SelectValue placeholder="Resource" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  <SelectItem value="session">Session</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="ride">Ride</SelectItem>
                  <SelectItem value="defect">Defect</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="risk_assessment">Risk Assessment</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[110px] flex-shrink-0">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 24h</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Logs - Card view on mobile, Table on desktop */}
            <div className="hidden md:block rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="w-[110px]">Action</TableHead>
                    <TableHead className="w-[110px]">Resource</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No audit logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          <div>{format(new Date(log.created_at), 'dd MMM yyyy')}</div>
                          <div className="text-muted-foreground">{format(new Date(log.created_at), 'HH:mm:ss')}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm truncate max-w-[180px]">
                            {log.user_email || 'Unknown'}
                          </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{log.resource_type}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="truncate">{formatDetails(log.details)}</div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  No audit logs found
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{log.user_email || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'dd MMM yyyy HH:mm')}
                        </p>
                      </div>
                      {getActionBadge(log.action)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{log.resource_type}</Badge>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <span className="text-xs text-muted-foreground truncate">
                          {Object.entries(log.details).slice(0, 1).map(([k, v]) => `${k}: ${String(v).slice(0, 20)}`)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {hasMore && filteredLogs.length > 0 && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={handleLoadMore}>
                  Load More
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AuditLogs;
