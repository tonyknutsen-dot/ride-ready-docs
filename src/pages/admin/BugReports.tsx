import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
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
  RefreshCw,
  ExternalLink,
  User,
  Clock,
  Monitor,
  AlertTriangle,
  CircleDot,
  Loader2,
  Search,
  Copy,
  CheckCircle2,
  Download,
  Save,
  FolderOpen,
  Trash2,
  Clipboard,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { APP_VERSION } from '@/config/appVersion';

interface BugReport {
  id: string;
  reference_id: string;
  user_id: string;
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
  created_at: string;
  updated_at: string;
}

interface BugReportAdminData {
  id: string;
  bug_report_id: string;
  internal_notes: string | null;
  assigned_to: string | null;
  priority: string;
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

const ISSUE_TYPE_OPTIONS = ['bug', 'ux', 'data', 'performance', 'other'];

// Helper to increment version
const getNextVersion = (currentVersion: string): string => {
  const match = currentVersion.match(/v(\d+)\.(\d+)/);
  if (match) {
    const major = parseInt(match[1]);
    const minor = parseInt(match[2]) + 1;
    return `v${major}.${minor}`;
  }
  return currentVersion;
};

const BugReports = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [selectedAdminData, setSelectedAdminData] = useState<BugReportAdminData | null>(null);
  const [updating, setUpdating] = useState(false);
  
  // Email cache for user_ids (fetched on demand)
  const [emailCache, setEmailCache] = useState<Record<string, string>>({});
  const [fetchingEmail, setFetchingEmail] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [versionFilter, setVersionFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [issueTypeFilter, setIssueTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-select for Fix Checklist
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [checklistChecked, setChecklistChecked] = useState<Set<string>>(new Set());
  
  // Template management
  const [savedTemplates, setSavedTemplates] = useState<Array<{ id: string; name: string; prompt: string; createdAt: string }>>([]);
  const [templateName, setTemplateName] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  // Fetch user email on demand (admin only)
  const fetchUserEmail = async (userId: string) => {
    if (emailCache[userId]) return emailCache[userId];
    
    setFetchingEmail(userId);
    try {
      const { data, error } = await supabase.functions.invoke('get-user-email', {
        body: { userId }
      });
      
      if (error) throw error;
      
      const email = data?.email || 'Unknown';
      setEmailCache(prev => ({ ...prev, [userId]: email }));
      return email;
    } catch (error) {
      console.error('Failed to fetch email:', error);
      return 'Unknown';
    } finally {
      setFetchingEmail(null);
    }
  };

  // Load templates from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('bug_fix_templates');
    if (stored) {
      try {
        setSavedTemplates(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load templates:', e);
      }
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [statusFilter, severityFilter, versionFilter, roleFilter, issueTypeFilter]);

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
      if (versionFilter !== 'all') {
        query = query.eq('app_version', versionFilter);
      }
      if (roleFilter !== 'all') {
        query = query.eq('user_role', roleFilter);
      }
      if (issueTypeFilter !== 'all') {
        query = query.eq('issue_type', issueTypeFilter);
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

  // Fetch admin data for a specific bug report
  const fetchAdminData = async (bugReportId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('bug_report_admin_data')
        .select('*')
        .eq('bug_report_id', bugReportId)
        .maybeSingle();

      if (error) throw error;
      setSelectedAdminData(data || { bug_report_id: bugReportId, internal_notes: null, assigned_to: null, priority: 'normal' });
    } catch (error: any) {
      console.error('Error fetching admin data:', error);
      setSelectedAdminData({ id: '', bug_report_id: bugReportId, internal_notes: null, assigned_to: null, priority: 'normal' });
    }
  };

  // Save admin data (upsert)
  const updateAdminData = async (bugReportId: string, updates: Partial<BugReportAdminData>) => {
    setUpdating(true);
    try {
      // Check if record exists
      const { data: existing } = await (supabase as any)
        .from('bug_report_admin_data')
        .select('id')
        .eq('bug_report_id', bugReportId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await (supabase as any)
          .from('bug_report_admin_data')
          .update(updates)
          .eq('bug_report_id', bugReportId);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await (supabase as any)
          .from('bug_report_admin_data')
          .insert({ bug_report_id: bugReportId, ...updates });
        if (error) throw error;
      }

      // Update local state
      setSelectedAdminData(prev => prev ? { ...prev, ...updates } : null);
      toast({ title: 'Admin data saved' });
    } catch (error: any) {
      toast({
        title: 'Failed to save admin data',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  // Get admin data for prompt generation (cached lookup)
  const [adminDataCache, setAdminDataCache] = useState<Record<string, BugReportAdminData>>({});
  
  const fetchAllAdminData = async () => {
    try {
      const { data } = await (supabase as any)
        .from('bug_report_admin_data')
        .select('*');
      
      const cache: Record<string, BugReportAdminData> = {};
      (data || []).forEach((item: BugReportAdminData) => {
        cache[item.bug_report_id] = item;
      });
      setAdminDataCache(cache);
    } catch (error) {
      console.error('Error fetching admin data cache:', error);
    }
  };

  useEffect(() => {
    fetchAllAdminData();
  }, []);

  const updateReport = async (id: string, updates: Partial<BugReport>) => {
    setUpdating(true);
    try {
      // Get the current report to check for status change
      const currentReport = reports.find(r => r.id === id);
      
      const { error } = await (supabase as any)
        .from('bug_reports')
        .update(updates as any)
        .eq('id', id);

      if (error) throw error;

      // If status changed to needs_retest, create a notification for the user
      if (updates.status === 'needs_retest' && currentReport?.status !== 'needs_retest') {
        try {
          await supabase.from('notifications').insert({
            user_id: currentReport?.user_id,
            type: 'bug_status',
            title: 'Bug Ready for Retest',
            message: `Your bug report "${currentReport?.title}" (${currentReport?.reference_id}) has been fixed and needs retesting.`,
            related_table: 'bug_reports',
            related_id: id,
          });
        } catch (notifyErr) {
          console.error('Failed to create notification:', notifyErr);
        }
      }

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
      r.description.toLowerCase().includes(query) ||
      (emailCache[r.user_id]?.toLowerCase().includes(query))
    );
  });

  // Get unique versions for filter
  const uniqueVersions = [...new Set(reports.map(r => r.app_version).filter(Boolean))];

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredReports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReports.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Handler for selecting a report - also fetches admin data
  const handleSelectReport = (report: BugReport | null) => {
    setSelectedReport(report);
    if (report) {
      fetchAdminData(report.id);
    } else {
      setSelectedAdminData(null);
    }
  };

  const selectedReports = reports.filter(r => selectedIds.has(r.id));

  const generatePrompt = () => {
    if (selectedReports.length === 0) {
      toast({ title: 'No bugs selected', variant: 'destructive' });
      return;
    }

    const appName = selectedReports[0]?.app_name || 'Showmen\'s Ride Ready';
    const currentVersion = APP_VERSION;
    const nextVersion = getNextVersion(currentVersion);

    // Sort by severity (critical first)
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...selectedReports].sort((a, b) => 
      (severityOrder[a.severity as keyof typeof severityOrder] || 4) - 
      (severityOrder[b.severity as keyof typeof severityOrder] || 4)
    );

    let prompt = `## Bug Fix Request

**HEADER**
- App: ${appName}
- Target Version: ${currentVersion}
- Scope: Fix ONLY the issues listed below. Do not change unrelated UI, pricing, data models, or authentication unless required by a fix.
- After fixes: bump version to ${nextVersion} and mark items as "Needs Retest".

---

## ISSUE LIST

`;

    sorted.forEach((bug, index) => {
      prompt += `### [${bug.reference_id}] ${bug.title}

- **Severity:** ${bug.severity.charAt(0).toUpperCase() + bug.severity.slice(1)}
- **Issue Type:** ${bug.issue_type.charAt(0).toUpperCase() + bug.issue_type.slice(1)}
- **Page/Route:** ${bug.current_route || 'Unknown'}
- **Environment:** ${bug.device_type || 'Unknown'}, ${bug.browser_info || 'Unknown'}
`;

      if (bug.steps_to_reproduce) {
        prompt += `- **Steps to reproduce:**
${bug.steps_to_reproduce.split('\n').map(line => `  ${line}`).join('\n')}
`;
      }

      prompt += `- **Expected:** ${bug.expected_result || 'Not specified'}
- **Actual:** ${bug.actual_result || 'Not specified'}
`;

      const adminData = adminDataCache[bug.id];
      if (adminData?.internal_notes) {
        prompt += `- **Notes:** ${adminData.internal_notes}
`;
      }

      if (bug.screenshot_url) {
        prompt += `- **Attachment:** ${bug.screenshot_url}
`;
      }

      if (index < sorted.length - 1) {
        prompt += '\n---\n\n';
      }
    });

    prompt += `
---

## FOOTER
- When each issue is resolved, update bug status to "Needs Retest".
- Log a short change note in the Change Log with version ${nextVersion} and summary.
`;

    setGeneratedPrompt(prompt);
    setShowPromptDialog(true);
    setCopied(false);
    // Reset checklist
    setChecklistChecked(new Set());
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      toast({ title: 'Copied to clipboard!' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  const toggleChecklistItem = (id: string) => {
    const newSet = new Set(checklistChecked);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setChecklistChecked(newSet);
  };

  const saveTemplate = () => {
    if (!templateName.trim()) {
      toast({ title: 'Please enter a template name', variant: 'destructive' });
      return;
    }
    
    const newTemplate = {
      id: crypto.randomUUID(),
      name: templateName.trim(),
      prompt: generatedPrompt,
      createdAt: new Date().toISOString(),
    };
    
    const updated = [...savedTemplates, newTemplate];
    setSavedTemplates(updated);
    localStorage.setItem('bug_fix_templates', JSON.stringify(updated));
    setTemplateName('');
    toast({ title: 'Template saved!' });
  };

  const loadTemplate = (template: { id: string; name: string; prompt: string }) => {
    setGeneratedPrompt(template.prompt);
    setShowTemplates(false);
    toast({ title: `Loaded: ${template.name}` });
  };

  const deleteTemplate = (id: string) => {
    const updated = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(updated);
    localStorage.setItem('bug_fix_templates', JSON.stringify(updated));
    toast({ title: 'Template deleted' });
  };

  const exportToFile = () => {
    const blob = new Blob([generatedPrompt], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bug-fix-prompt-${format(new Date(), 'yyyy-MM-dd-HHmm')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Prompt exported!' });
  };

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
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Bug className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              Bug Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {reports.length} reports total • {selectedIds.size} selected
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button 
                onClick={generatePrompt} 
                className="gap-2 bg-gradient-to-r from-primary to-purple-600"
              >
                <Sparkles className="h-4 w-4" />
                Generate Fix Prompt ({selectedIds.size})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchReports} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="relative col-span-2 sm:col-span-3 lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
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
              <Select value={versionFilter} onValueChange={setVersionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Versions</SelectItem>
                  {uniqueVersions.map((v) => (
                    <SelectItem key={v} value={v!}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Reporter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reporters</SelectItem>
                  <SelectItem value="tester">Testers</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
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
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.size === filteredReports.length && filteredReports.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-28">Reference</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-20">Severity</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-16">Role</TableHead>
                      <TableHead className="w-20">Version</TableHead>
                      <TableHead className="w-28">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report) => (
                      <TableRow
                        key={report.id}
                        className={`cursor-pointer hover:bg-muted/50 ${selectedIds.has(report.id) ? 'bg-primary/5' : ''}`}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(report.id)}
                            onCheckedChange={() => toggleSelect(report.id)}
                          />
                        </TableCell>
                        <TableCell onClick={() => handleSelectReport(report)}>
                          <code className="text-xs font-mono bg-secondary px-2 py-1 rounded">
                            {report.reference_id}
                          </code>
                        </TableCell>
                        <TableCell onClick={() => handleSelectReport(report)}>
                          <div className="flex items-center gap-2">
                            {report.is_after_recent_changes && (
                              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                            )}
                            <span className="truncate max-w-xs">{report.title}</span>
                          </div>
                        </TableCell>
                        <TableCell onClick={() => handleSelectReport(report)}>
                          {getSeverityBadge(report.severity)}
                        </TableCell>
                        <TableCell onClick={() => handleSelectReport(report)}>
                          {getStatusBadge(report.status)}
                        </TableCell>
                        <TableCell onClick={() => handleSelectReport(report)}>
                          <Badge variant="outline" className="text-xs">
                            {report.user_role || 'user'}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={() => handleSelectReport(report)}>
                          <code className="text-xs font-mono">{report.app_version}</code>
                        </TableCell>
                        <TableCell onClick={() => handleSelectReport(report)}>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(report.created_at), 'dd MMM')}
                          </span>
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
        <Dialog open={!!selectedReport} onOpenChange={() => handleSelectReport(null)}>
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
                          value={selectedAdminData?.assigned_to || 'unassigned'}
                          onValueChange={(v) =>
                            updateAdminData(selectedReport.id, {
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
                        {fetchingEmail === selectedReport.user_id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : emailCache[selectedReport.user_id] ? (
                          <span>{emailCache[selectedReport.user_id]}</span>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-auto p-0 text-primary hover:underline"
                            onClick={() => fetchUserEmail(selectedReport.user_id)}
                          >
                            Show email
                          </Button>
                        )}
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
                          {selectedReport.current_route || 'Unknown'}
                        </code>
                        {selectedReport.current_route && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 ml-auto"
                            onClick={() => {
                              handleSelectReport(null);
                              window.location.href = selectedReport.current_route!;
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Go to Page
                          </Button>
                        )}
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

                    {/* Internal Notes (Admin Only) */}
                    <div className="space-y-2">
                      <h4 className="font-medium">Internal Notes (Admin Only)</h4>
                      <Textarea
                        placeholder="Add internal notes for the team..."
                        value={selectedAdminData?.internal_notes || ''}
                        onChange={(e) =>
                          setSelectedAdminData(prev => prev ? {
                            ...prev,
                            internal_notes: e.target.value,
                          } : null)
                        }
                        rows={3}
                      />
                      <Button
                        size="sm"
                        onClick={() =>
                          updateAdminData(selectedReport.id, {
                            internal_notes: selectedAdminData?.internal_notes,
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

        {/* Fix Prompt Dialog */}
        <Dialog open={showPromptDialog} onOpenChange={setShowPromptDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Lovable Fix Prompt
              </DialogTitle>
            </DialogHeader>

            <div className="p-6 pt-4 space-y-4">
              {/* Checklist Summary */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-secondary/50 px-4 py-2 border-b">
                  <h4 className="font-medium text-sm">Fix Checklist ({selectedReports.length} issues)</h4>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="w-28">Bug ID</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead className="w-20">Severity</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell>
                            <Checkbox
                              checked={checklistChecked.has(report.id)}
                              onCheckedChange={() => toggleChecklistItem(report.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <code className="text-xs font-mono">{report.reference_id}</code>
                          </TableCell>
                          <TableCell className="truncate max-w-xs">{report.title}</TableCell>
                          <TableCell>{getSeverityBadge(report.severity)}</TableCell>
                          <TableCell>{getStatusBadge(report.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Generated Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-medium text-sm">Generated Prompt</h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="gap-2"
                    >
                      <FolderOpen className="h-4 w-4" />
                      Templates ({savedTemplates.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exportToFile}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                    <Button
                      size="sm"
                      variant={copied ? 'default' : 'outline'}
                      onClick={copyToClipboard}
                      className="gap-2"
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Save as Template */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Template name..."
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="flex-1"
                  />
                  <Button size="sm" onClick={saveTemplate} className="gap-2">
                    <Save className="h-4 w-4" />
                    Save Template
                  </Button>
                </div>

                {/* Saved Templates List */}
                {showTemplates && savedTemplates.length > 0 && (
                  <div className="border rounded-lg p-3 space-y-2 bg-secondary/30">
                    <h5 className="text-sm font-medium">Saved Templates</h5>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {savedTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-secondary"
                        >
                          <button
                            className="text-sm text-left flex-1 hover:text-primary"
                            onClick={() => loadTemplate(template)}
                          >
                            {template.name}
                            <span className="text-xs text-muted-foreground ml-2">
                              {format(new Date(template.createdAt), 'dd MMM yyyy')}
                            </span>
                          </button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteTemplate(template.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Textarea
                  value={generatedPrompt}
                  readOnly
                  className="font-mono text-xs h-64"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default BugReports;
