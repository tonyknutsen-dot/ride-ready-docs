import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Check, X, AlertTriangle, Shield, Loader2, Clock, CheckCircle2, XCircle, Library, ChevronDown, ChevronUp, Inbox, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RiskItemSubmission {
  id: string;
  user_id: string;
  item_type: 'hazard' | 'control';
  label: string;
  category: string;
  equipment_group: string;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  admin_notes: string | null;
  similarity_group: string | null;
  created_at: string;
}

const RiskItemSubmissions = () => {
  const { logEvent } = useAuditLog();
  const [submissions, setSubmissions] = useState<RiskItemSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ status: string; type: string }>({ status: 'pending', type: 'all' });
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [mobileActionMenuId, setMobileActionMenuId] = useState<string | null>(null);
  const [expandedActions, setExpandedActions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('user_submitted_risk_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      toast({ title: 'Error loading submissions', description: error.message, variant: 'destructive' });
    } else {
      setSubmissions((data as RiskItemSubmission[]) || []);
    }
    if (!silent) setLoading(false);
  };

  const updateSubmissionLocally = (id: string, updates: Partial<RiskItemSubmission>) => {
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const clearPointerLock = () => {
    if (typeof document !== 'undefined' && document.body.style.pointerEvents === 'none') {
      document.body.style.removeProperty('pointer-events');
    }
  };

  const closeMobileActionMenu = () => {
    setMobileActionMenuId(null);
    clearPointerLock();
  };

  const openDialogFromActionMenu = (callback: () => void) => {
    closeMobileActionMenu();
    window.setTimeout(callback, 0);
  };

  const toggleActions = useCallback((id: string) => {
    setExpandedActions(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleApprove = async (submission: RiskItemSubmission) => {
    setProcessing(submission.id);
    updateSubmissionLocally(submission.id, { status: 'approved', admin_notes: adminNotes[submission.id] || null });

    try {
      const { data: maxSort } = await supabase
        .from('risk_library_items')
        .select('sort_index')
        .eq('item_type', submission.item_type)
        .order('sort_index', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error: insertError } = await supabase
        .from('risk_library_items')
        .insert([{
          label: submission.label,
          item_type: submission.item_type,
          category: submission.category || 'General',
          equipment_group: submission.equipment_group || 'general',
          sort_index: (maxSort?.sort_index || 0) + 1,
          is_active: true
        }]);
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('user_submitted_risk_items')
        .update({
          status: 'approved',
          admin_notes: adminNotes[submission.id] || null
        })
        .eq('id', submission.id);
      if (updateError) throw updateError;

      toast({ title: 'Added to library', description: `"${submission.label}" is now in the shared risk library.` });
      logEvent('approve', 'risk_intake', submission.id, { label: submission.label, item_type: submission.item_type }, {
        before: { status: 'pending' },
        after: { status: 'approved', admin_notes: adminNotes[submission.id] || null },
        reason: adminNotes[submission.id] || undefined,
        contextHint: 'admin risk intake approval',
      });
      closeMobileActionMenu();
      loadSubmissions(true);
    } catch (error: any) {
      updateSubmissionLocally(submission.id, { status: 'pending', admin_notes: submission.admin_notes });
      toast({ title: 'Error approving', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (submission: RiskItemSubmission) => {
    setProcessing(submission.id);
    updateSubmissionLocally(submission.id, { status: 'rejected', admin_notes: adminNotes[submission.id] || null });

    try {
      const { error } = await supabase
        .from('user_submitted_risk_items')
        .update({
          status: 'rejected',
          admin_notes: adminNotes[submission.id] || null
        })
        .eq('id', submission.id);
      if (error) throw error;

      toast({ title: 'Not added to library', description: 'The user can still use this item privately.' });
      closeMobileActionMenu();
      loadSubmissions(true);
    } catch (error: any) {
      updateSubmissionLocally(submission.id, { status: 'pending', admin_notes: submission.admin_notes });
      toast({ title: 'Error rejecting', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const counts = useMemo(() => ({
    pending: submissions.filter(s => s.status === 'pending').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
  }), [submissions]);

  const filteredSubmissions = useMemo(() =>
    submissions.filter(s => {
      if (filter.status !== 'all' && s.status !== filter.status) return false;
      if (filter.type !== 'all' && s.item_type !== filter.type) return false;
      return true;
    }),
    [submissions, filter]
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'border-l-yellow-500';
      case 'approved': return 'border-l-green-500';
      case 'rejected': return 'border-l-red-500';
      default: return '';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800"><Clock className="w-3 h-3 mr-1" />Awaiting Review</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />In Library</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"><XCircle className="w-3 h-3 mr-1" />Not Added</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Library className="w-5 h-5 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Risk Intake Queue</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-xl">
          Review user-created hazards and controls for inclusion in the shared risk library. Users can already use their own items privately.
        </p>
      </div>

      {/* KPI Summary — matches Check Intake Queue */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <button
          onClick={() => setFilter(f => ({ ...f, status: 'pending' }))}
          className={`text-left rounded-lg border p-3 transition-colors ${filter.status === 'pending' ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/40'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Inbox className="w-4 h-4 text-yellow-600" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Awaiting Review</span>
          </div>
          <div className="text-2xl font-bold text-yellow-600">{counts.pending}</div>
        </button>
        <button
          onClick={() => setFilter(f => ({ ...f, status: 'approved' }))}
          className={`text-left rounded-lg border p-3 transition-colors ${filter.status === 'approved' ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/40'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">In Library</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{counts.approved}</div>
        </button>
        <button
          onClick={() => setFilter(f => ({ ...f, status: 'rejected' }))}
          className={`text-left rounded-lg border p-3 transition-colors ${filter.status === 'rejected' ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/40'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Not Added</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{counts.rejected}</div>
        </button>
      </div>

      {/* Filters — matches Check Intake Queue */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-3 flex-1">
          <Select value={filter.type} onValueChange={(v) => setFilter(f => ({ ...f, type: v }))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="hazard">Hazards</SelectItem>
              <SelectItem value="control">Controls</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active filter indicator */}
      {(filter.status !== 'pending' || filter.type !== 'all') && (
        <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
          <span>Showing {filteredSubmissions.length} items</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setFilter({ status: 'pending', type: 'all' })}>
            Clear filters
          </Button>
        </div>
      )}

      {/* Submissions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {filter.status === 'pending' ? 'No items awaiting library review.' : 'No submissions match your filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSubmissions.map((submission) => {
            const isPending = submission.status === 'pending';

            return (
              <Card key={submission.id} className={`border-l-4 ${getStatusColor(submission.status)} overflow-hidden hover:shadow-none hover:translate-y-0`}>
                <CardContent className="p-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {getStatusBadge(submission.status)}
                      {submission.item_type === 'hazard' ? (
                        <Badge variant="secondary" className="text-xs"><AlertTriangle className="w-3 h-3 mr-0.5" />Hazard</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs"><Shield className="w-3 h-3 mr-0.5" />Control</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">{submission.category || 'General'}</Badge>
                    </div>
                    {isPending && (
                      <DropdownMenu
                        modal={false}
                        open={mobileActionMenuId === submission.id}
                        onOpenChange={(open) => {
                          setMobileActionMenuId(open ? submission.id : null);
                          if (!open) clearPointerLock();
                        }}
                      >
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 sm:hidden">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-background border shadow-lg z-50"
                          onCloseAutoFocus={(event) => {
                            event.preventDefault();
                            clearPointerLock();
                          }}
                        >
                          <DropdownMenuItem onSelect={(event) => {
                            event.preventDefault();
                            openDialogFromActionMenu(() => handleApprove(submission));
                          }}>
                            <Check className="w-4 h-4 mr-2 text-green-600" />Add to Library
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={(event) => {
                            event.preventDefault();
                            openDialogFromActionMenu(() => handleReject(submission));
                          }}>
                            <X className="w-4 h-4 mr-2 text-red-600" />Not Needed
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Item content */}
                  <p className="font-semibold text-sm leading-snug mb-1">{submission.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Submitted {format(new Date(submission.created_at), 'dd MMM yyyy · HH:mm')}
                  </p>

                  {/* Existing admin notes for reviewed items */}
                  {!isPending && submission.admin_notes && (
                    <p className="mt-1.5 text-xs italic text-muted-foreground">
                      Admin: {submission.admin_notes}
                    </p>
                  )}

                  {/* Pending: collapsible admin action area (desktop) */}
                  {isPending && (
                    <div className="mt-3 hidden sm:block">
                      <Separator className="mb-2.5" />
                      <button
                        onClick={() => toggleActions(submission.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        {expandedActions[submission.id] ? (
                          <><ChevronUp className="h-3.5 w-3.5" />Hide review actions</>
                        ) : (
                          <><ChevronDown className="h-3.5 w-3.5" />Review this item</>
                        )}
                      </button>

                      {expandedActions[submission.id] && (
                        <div className="mt-2.5 space-y-2.5">
                          <Textarea
                            placeholder="Admin notes (optional)"
                            className="text-sm min-h-[60px] resize-none"
                            rows={2}
                            value={adminNotes[submission.id] || ''}
                            onChange={(e) => setAdminNotes(prev => ({ ...prev, [submission.id]: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => handleApprove(submission)}
                              disabled={processing === submission.id}
                            >
                              {processing === submission.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 mr-1" />
                              )}
                              Add to Library
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleReject(submission)}
                              disabled={processing === submission.id}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Not Needed
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
};

export default RiskItemSubmissions;
