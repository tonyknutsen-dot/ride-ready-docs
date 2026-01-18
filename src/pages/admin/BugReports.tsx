import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bug,
  Filter,
  RefreshCw,
  ExternalLink,
  User,
  Clock,
  Monitor,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Loader2,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';

interface BugReport {
  id: string;
  reference_id: string;
  user_id: string;
  user_email: string | null;
  user_role: string | null;
  title: string;
  description: string;
  steps_to_reproduce: string | null;
  expected_result: string | null;
  actual_result: string | null;
  severity: string;
  issue_type: string;
  screenshot_url: string | null;
  app_name: string | null;
  app_version: string | null;
  build_date: string | null;
  current_route: string | null;
  device_type: string | null;
  browser_info: string | null;
  captured_at: string;
  is_after_recent_changes: boolean | null;
  status: string;
  assigned_to: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-500' },
  { value: 'fixed', label: 'Fixed', color: 'bg-green-500' },
  { value: 'needs_retest', label: 'Needs Retest', color: 'bg-purple-500' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-500' },
];

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

const ASSIGNEE_OPTIONS = ['Tony', 'Liam'];

const BugReports = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [updating, setUpdating] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchReports();
  }, [statusFilter, severityFilter]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let query = (supabase as any)
        .from('bug_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setReports(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading reports',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateReport = async (id: string, updates: Partial<BugReport>) => {
    setUpdating(true);
    try {
      const { error } = await (supabase as any)
        .from('bug_reports')
        .update(updates as any)
        .eq('id', id);

      if (error) throw error;

      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
      
      if (selectedReport?.id === id) {
        setSelectedReport({ ...selectedReport, ...updates });
      }

      toast({ title: 'Report updated' });
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      r.reference_id.toLowerCase().includes(query) ||
      r.title.toLowerCase().includes(query) ||
      r.user_email?.toLowerCase().includes(query) ||
      r.description.toLowerCase().includes(query)
    );
  });

  const getSeverityBadge = (severity: string) => (
    <Badge className={`${SEVERITY_COLORS[severity] || 'bg-gray-500'} text-white`}>
      {severity}
    </Badge>
  );

  const getStatusBadge = (status: string) => {
    const statusOpt = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <Badge className={`${statusOpt?.color || 'bg-gray-500'} text-white`}>
        {statusOpt?.label || status}
      </Badge>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <Bug className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Bug Reports</h1>
              <p className="text-sm text-muted-foreground">
                {reports.length} reports total
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchReports} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by reference, title, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Reports Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Bug className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No bug reports found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Reference</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-24">Severity</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="w-24">Assigned</TableHead>
                      <TableHead className="w-32">Date</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => (
                      <TableRow
                        key={report.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedReport(report)}
                      >
                        <TableCell>
                          <code className="text-xs font-mono bg-secondary px-2 py-1 rounded">
                            {report.reference_id}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {report.is_after_recent_changes && (
                              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                            )}
                            <span className="truncate max-w-xs">{report.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getSeverityBadge(report.severity)}</TableCell>
                        <TableCell>{getStatusBadge(report.status)}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {report.assigned_to || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(report.created_at), 'dd MMM yyyy')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] p-0">
            {selectedReport && (
              <>
                <DialogHeader className="p-6 pb-0">
                  <DialogTitle className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-secondary px-2 py-1 rounded">
                      {selectedReport.reference_id}
                    </code>
                    {selectedReport.is_after_recent_changes && (
                      <Badge variant="outline" className="text-warning border-warning">
                        After Recent Changes
                      </Badge>
                    )}
                  </DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-[calc(90vh-80px)]">
                  <div className="p-6 pt-4 space-y-6">
                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Status</label>
                        <Select
                          value={selectedReport.status}
                          onValueChange={(v) =>
                            updateReport(selectedReport.id, { status: v })
                          }
                          disabled={updating}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Assign To</label>
                        <Select
                          value={selectedReport.assigned_to || 'unassigned'}
                          onValueChange={(v) =>
                            updateReport(selectedReport.id, {
                              assigned_to: v === 'unassigned' ? null : v,
                            })
                          }
                          disabled={updating}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {ASSIGNEE_OPTIONS.map((a) => (
                              <SelectItem key={a} value={a}>
                                {a}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Title & Badges */}
                    <div>
                      <h3 className="text-lg font-semibold">{selectedReport.title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        {getSeverityBadge(selectedReport.severity)}
                        <Badge variant="outline">{selectedReport.issue_type}</Badge>
                      </div>
                    </div>

                    {/* Context Info */}
                    <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-secondary/50 border">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Reporter:</span>
                        <span>{selectedReport.user_email || 'Unknown'}</span>
                        {selectedReport.user_role === 'tester' && (
                          <Badge variant="outline" className="text-xs">Tester</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Reported:</span>
                        <span>{format(new Date(selectedReport.created_at), 'PPp')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Device:</span>
                        <span>{selectedReport.device_type} • {selectedReport.browser_info}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CircleDot className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Version:</span>
                        <code className="font-mono">{selectedReport.app_version}</code>
                      </div>
                      <div className="col-span-2 flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Route:</span>
                        <code className="font-mono text-xs bg-background px-2 py-0.5 rounded">
                          {selectedReport.current_route}
                        </code>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <h4 className="font-medium">Description</h4>
                      <p className="text-sm whitespace-pre-wrap">{selectedReport.description}</p>
                    </div>

                    {/* Steps to Reproduce */}
                    {selectedReport.steps_to_reproduce && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Steps to Reproduce</h4>
                        <pre className="text-sm whitespace-pre-wrap p-3 rounded-lg bg-secondary/50 border font-mono">
                          {selectedReport.steps_to_reproduce}
                        </pre>
                      </div>
                    )}

                    {/* Expected vs Actual */}
                    {(selectedReport.expected_result || selectedReport.actual_result) && (
                      <div className="grid grid-cols-2 gap-4">
                        {selectedReport.expected_result && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-success">Expected Result</h4>
                            <p className="text-sm">{selectedReport.expected_result}</p>
                          </div>
                        )}
                        {selectedReport.actual_result && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-destructive">Actual Result</h4>
                            <p className="text-sm">{selectedReport.actual_result}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Screenshot */}
                    {selectedReport.screenshot_url && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Screenshot</h4>
                        <a
                          href={selectedReport.screenshot_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View Screenshot
                        </a>
                      </div>
                    )}

                    {/* Internal Notes */}
                    <div className="space-y-2">
                      <h4 className="font-medium">Internal Notes</h4>
                      <Textarea
                        placeholder="Add internal notes for the team..."
                        value={selectedReport.internal_notes || ''}
                        onChange={(e) =>
                          setSelectedReport({
                            ...selectedReport,
                            internal_notes: e.target.value,
                          })
                        }
                        rows={3}
                      />
                      <Button
                        size="sm"
                        onClick={() =>
                          updateReport(selectedReport.id, {
                            internal_notes: selectedReport.internal_notes,
                          })
                        }
                        disabled={updating}
                      >
                        {updating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Save Notes'
                        )}
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default BugReports;
