import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, AlertTriangle, Activity, Clock, RefreshCw, TrendingUp, Users, Ban, Unlock, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';

interface RateLimitEntry {
  id: string;
  key: string;
  count: number;
  window_start: string;
  created_at: string;
}

interface BlockedIp {
  id: string;
  ip_address: string;
  reason: string;
  blocked_at: string;
  expires_at: string;
  is_active: boolean;
  blocked_by: string;
  request_count: number | null;
  unblocked_at: string | null;
  unblocked_by: string | null;
}

interface AggregatedStats {
  totalEntries: number;
  totalRequests: number;
  uniqueSources: number;
  topSources: { key: string; count: number }[];
  recentActivity: RateLimitEntry[];
  blockedIps: BlockedIp[];
}

const SecurityDashboard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [monitorResult, setMonitorResult] = useState<any>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [newBlockIp, setNewBlockIp] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');
  const [newBlockDuration, setNewBlockDuration] = useState('24');

  const fetchData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('monitor-rate-limits', {
        body: { action: 'stats' },
      });

      if (error) {
        console.log('Using fallback - monitor function fetch failed');
        setStats({
          totalEntries: 0,
          totalRequests: 0,
          uniqueSources: 0,
          topSources: [],
          recentActivity: [],
          blockedIps: [],
        });
        return;
      }

      if (data?.stats) {
        setStats(data.stats);
      } else {
        setStats({
          totalEntries: 0,
          totalRequests: 0,
          uniqueSources: 0,
          topSources: [],
          recentActivity: [],
          blockedIps: [],
        });
      }
    } catch (error: any) {
      console.error('Error fetching security data:', error);
      setStats({
        totalEntries: 0,
        totalRequests: 0,
        uniqueSources: 0,
        topSources: [],
        recentActivity: [],
        blockedIps: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast({
      title: 'Refreshed',
      description: 'Security data has been refreshed',
    });
  };

  const handleRunMonitor = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('monitor-rate-limits', {
        body: { manual: true },
      });

      if (error) throw error;

      setMonitorResult(data);
      
      if (data?.stats) {
        setStats(data.stats);
      }
      
      const blockedCount = data?.blockedIps?.length || 0;
      toast({
        title: 'Monitor Complete',
        description: `Detected ${data?.patternsDetected || 0} patterns${blockedCount > 0 ? `, blocked ${blockedCount} IPs` : ''}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to run monitor',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleUnblockIp = async (ipAddress: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('monitor-rate-limits', {
        body: { action: 'unblock', ipAddress },
      });

      if (error) throw error;

      toast({
        title: 'IP Unblocked',
        description: `${ipAddress} has been unblocked`,
      });
      
      await fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to unblock IP',
        variant: 'destructive',
      });
    }
  };

  const handleBlockIp = async () => {
    if (!newBlockIp.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an IP address',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('monitor-rate-limits', {
        body: { 
          action: 'block', 
          ipAddress: newBlockIp.trim(),
          reason: newBlockReason.trim() || 'Manually blocked by admin',
          durationHours: parseInt(newBlockDuration),
        },
      });

      if (error) throw error;

      toast({
        title: 'IP Blocked',
        description: `${newBlockIp} has been blocked for ${newBlockDuration} hours`,
      });
      
      setBlockDialogOpen(false);
      setNewBlockIp('');
      setNewBlockReason('');
      setNewBlockDuration('24');
      await fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to block IP',
        variant: 'destructive',
      });
    }
  };

  const parseSourceKey = (key: string) => {
    const parts = key.split(':');
    const endpoint = parts[0] || 'unknown';
    const type = parts[1] || 'unknown';
    const identifier = parts.slice(2).join(':') || 'unknown';
    return { endpoint, type, identifier };
  };

  const getSeverityBadge = (count: number) => {
    if (count >= 20) return <Badge variant="destructive">High</Badge>;
    if (count >= 10) return <Badge className="bg-orange-500">Medium</Badge>;
    return <Badge variant="secondary">Low</Badge>;
  };

  const getBlockStatusBadge = (blockedIp: BlockedIp) => {
    const now = new Date();
    const expiresAt = new Date(blockedIp.expires_at);
    
    if (!blockedIp.is_active) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    if (expiresAt <= now) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    return <Badge variant="destructive">Active</Badge>;
  };

  const activeBlockedIps = stats?.blockedIps?.filter(ip => 
    ip.is_active && new Date(ip.expires_at) > new Date()
  ) || [];

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Security Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor rate limiting, abuse patterns, and manage blocked IPs
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleRunMonitor} disabled={refreshing}>
              <Activity className="h-4 w-4 mr-2" />
              Run Monitor
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests (24h)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalRequests || 0}</div>
              <p className="text-xs text-muted-foreground">
                Tracked rate-limited requests
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Sources</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.uniqueSources || 0}</div>
              <p className="text-xs text-muted-foreground">
                Distinct IPs/Users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rate Limit Entries</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalEntries || 0}</div>
              <p className="text-xs text-muted-foreground">
                Active tracking records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Abuse Patterns</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monitorResult?.patternsDetected || 0}</div>
              <p className="text-xs text-muted-foreground">
                {monitorResult ? 'From last scan' : 'Run monitor to check'}
              </p>
            </CardContent>
          </Card>

          <Card className={activeBlockedIps.length > 0 ? 'border-destructive' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blocked IPs</CardTitle>
              <Ban className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeBlockedIps.length}</div>
              <p className="text-xs text-muted-foreground">
                Currently blocked
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Monitor Results */}
        {monitorResult?.patterns?.length > 0 && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Detected Abuse Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {monitorResult.patterns.map((pattern: any, idx: number) => (
                  <div 
                    key={idx} 
                    className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10"
                  >
                    <Badge variant={pattern.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {pattern.severity}
                    </Badge>
                    <div>
                      <p className="font-medium">{pattern.type.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-muted-foreground">{pattern.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="blocked" className="space-y-4">
          <TabsList>
            <TabsTrigger value="blocked" className="flex items-center gap-2">
              <Ban className="h-4 w-4" />
              Blocked IPs
              {activeBlockedIps.length > 0 && (
                <Badge variant="destructive" className="ml-1">{activeBlockedIps.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sources">Top Sources</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
            <TabsTrigger value="cron">Scheduled Jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="blocked">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Blocked IP Addresses</CardTitle>
                  <CardDescription>
                    IPs that have been blocked due to suspicious activity
                  </CardDescription>
                </div>
                <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Block IP
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Block IP Address</DialogTitle>
                      <DialogDescription>
                        Manually block an IP address from accessing the application
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="ip">IP Address</Label>
                        <Input
                          id="ip"
                          placeholder="e.g., 192.168.1.1"
                          value={newBlockIp}
                          onChange={(e) => setNewBlockIp(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reason">Reason</Label>
                        <Input
                          id="reason"
                          placeholder="Reason for blocking"
                          value={newBlockReason}
                          onChange={(e) => setNewBlockReason(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="duration">Duration</Label>
                        <Select value={newBlockDuration} onValueChange={setNewBlockDuration}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 hour</SelectItem>
                            <SelectItem value="6">6 hours</SelectItem>
                            <SelectItem value="24">24 hours</SelectItem>
                            <SelectItem value="72">3 days</SelectItem>
                            <SelectItem value="168">1 week</SelectItem>
                            <SelectItem value="720">30 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleBlockIp} variant="destructive">
                        Block IP
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {stats?.blockedIps?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No blocked IPs
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Blocked By</TableHead>
                        <TableHead>Blocked At</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats?.blockedIps?.map((blocked) => (
                        <TableRow key={blocked.id}>
                          <TableCell className="font-mono font-medium">
                            {blocked.ip_address}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {blocked.reason}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{blocked.blocked_by}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDistanceToNow(new Date(blocked.blocked_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(blocked.expires_at), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell>{getBlockStatusBadge(blocked)}</TableCell>
                          <TableCell className="text-right">
                            {blocked.is_active && new Date(blocked.expires_at) > new Date() && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnblockIp(blocked.ip_address)}
                              >
                                <Unlock className="h-4 w-4 mr-1" />
                                Unblock
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sources">
            <Card>
              <CardHeader>
                <CardTitle>Top Request Sources (24h)</CardTitle>
                <CardDescription>
                  Sources with the most rate-limited requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.topSources?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No rate limit data in the last 24 hours
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Identifier</TableHead>
                        <TableHead className="text-right">Requests</TableHead>
                        <TableHead>Severity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats?.topSources?.map((source, idx) => {
                        const { endpoint, type, identifier } = parseSourceKey(source.key);
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{endpoint}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{type}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm truncate max-w-[200px]">
                              {identifier}
                            </TableCell>
                            <TableCell className="text-right font-bold">{source.count}</TableCell>
                            <TableCell>{getSeverityBadge(source.count)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent Rate Limit Activity</CardTitle>
                <CardDescription>
                  Latest rate limit entries recorded
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.recentActivity?.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No recent activity
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats?.recentActivity?.map((entry, idx) => (
                        <TableRow key={entry.id || idx}>
                          <TableCell className="text-muted-foreground">
                            {formatDistanceToNow(new Date(entry.window_start), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="font-mono text-sm truncate max-w-[300px]">
                            {entry.key}
                          </TableCell>
                          <TableCell className="text-right font-bold">{entry.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cron">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Security Jobs</CardTitle>
                <CardDescription>
                  Automated security monitoring tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Rate Limit Cleanup</h4>
                        <Badge variant="secondary">Daily 3 AM UTC</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Removes expired rate limit entries to prevent database bloat
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Abuse Monitor</h4>
                        <Badge variant="secondary">Hourly :30</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Scans for abuse patterns, auto-blocks IPs, sends email alerts
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Auto-Block Thresholds</h4>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Auto-block threshold</span>
                        <span className="font-mono">50 req/hour</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Warning block duration</span>
                        <span className="font-mono">1 hour</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Critical block duration</span>
                        <span className="font-mono">24 hours</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Rate Limit Thresholds</h4>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Public endpoints</span>
                        <span className="font-mono">5 req/hour</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Authenticated endpoints</span>
                        <span className="font-mono">60 req/min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email endpoints</span>
                        <span className="font-mono">10 req/min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Batch operations</span>
                        <span className="font-mono">5 req/min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment endpoints</span>
                        <span className="font-mono">10 req/min</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default SecurityDashboard;