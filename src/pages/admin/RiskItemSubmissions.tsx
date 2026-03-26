import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Check, X, AlertTriangle, Shield, Loader2, RefreshCw, Clock, CheckCircle2, XCircle, Library, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

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
  const [submissions, setSubmissions] = useState<RiskItemSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [typeFilter, setTypeFilter] = useState<'all' | 'hazard' | 'control'>('all');
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedActions, setExpandedActions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadSubmissions();
  }, [filter, typeFilter]);

  const loadSubmissions = async () => {
    setLoading(true);
    let query = supabase
      .from('user_submitted_risk_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }
    if (typeFilter !== 'all') {
      query = query.eq('item_type', typeFilter);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      toast({ title: 'Error loading submissions', description: error.message, variant: 'destructive' });
    } else {
      setSubmissions((data as RiskItemSubmission[]) || []);
    }
    setLoading(false);
  };

  const updateSubmissionLocally = (id: string, updates: Partial<RiskItemSubmission>) => {
    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
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
    } catch (error: any) {
      updateSubmissionLocally(submission.id, { status: 'pending', admin_notes: submission.admin_notes });
      toast({ title: 'Error rejecting', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const counts = useMemo(() => {
    const all = submissions;
    return {
      pending: all.filter(s => s.status === 'pending').length,
      hazards: all.filter(s => s.item_type === 'hazard').length,
      controls: all.filter(s => s.item_type === 'control').length,
    };
  }, [submissions]);

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Library className="w-5 h-5 text-primary shrink-0" />
          <h1 className="text-base sm:text-2xl font-bold tracking-tight leading-tight">Risk Library Intake</h1>
        </div>
        <p className="max-w-md text-[12px] sm:text-[13px] text-foreground/60 font-medium leading-snug">
          Review user-created hazards and controls for the shared library. Users already use these items privately.
        </p>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5">
        <button
          onClick={() => setFilter('pending')}
          className={`w-full rounded-xl border bg-card px-3 py-3 text-left transition-colors sm:px-3.5 ${
            filter === 'pending'
              ? 'ring-2 ring-primary border-primary bg-primary/5'
              : 'hover:border-primary/40'
          }`}
        >
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] leading-tight text-foreground/75">
            Awaiting Review
          </span>
          <span className="text-[26px] leading-none font-bold text-[hsl(var(--warning))]">{counts.pending}</span>
        </button>
        <div className="rounded-xl border bg-card px-3 py-3 sm:px-3.5">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] leading-tight text-foreground/75">
            Hazards
          </span>
          <span className="text-[26px] leading-none font-bold text-[hsl(var(--destructive))]">{counts.hazards}</span>
        </div>
        <div className="rounded-xl border bg-card px-3 py-3 sm:px-3.5">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] leading-tight text-foreground/75">
            Controls
          </span>
          <span className="text-[26px] leading-none font-bold text-[hsl(var(--success))]">{counts.controls}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="h-9 w-full text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Awaiting Review</SelectItem>
              <SelectItem value="approved">In Library</SelectItem>
              <SelectItem value="rejected">Not Added</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <SelectTrigger className="h-9 w-full text-sm">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="hazard">Hazards</SelectItem>
              <SelectItem value="control">Controls</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end sm:justify-start">
          <Button
            variant="ghost"
            size="icon"
            onClick={loadSubmissions}
            disabled={loading}
            className="h-9 w-9 shrink-0 rounded-lg"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Submissions List */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : submissions.length === 0 ? (
        <Card className="hover:shadow-none hover:translate-y-0">
          <CardContent className="py-10 text-center">
            <Check className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--success))]" />
            <h3 className="font-semibold text-[15px]">No submissions to review</h3>
            <p className="text-sm text-muted-foreground mt-1">All caught up!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {submissions.map((submission) => (
            <SubmissionCard
              key={submission.id}
              submission={submission}
              processing={processing}
              adminNote={adminNotes[submission.id] || ''}
              isActionsExpanded={!!expandedActions[submission.id]}
              onToggleActions={() => toggleActions(submission.id)}
              onAdminNoteChange={(val) => setAdminNotes(prev => ({ ...prev, [submission.id]: val }))}
              onApprove={() => handleApprove(submission)}
              onReject={() => handleReject(submission)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Submission Card ── */

interface SubmissionCardProps {
  submission: RiskItemSubmission;
  processing: string | null;
  adminNote: string;
  isActionsExpanded: boolean;
  onToggleActions: () => void;
  onAdminNoteChange: (val: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

function SubmissionCard({
  submission,
  processing,
  adminNote,
  isActionsExpanded,
  onToggleActions,
  onAdminNoteChange,
  onApprove,
  onReject,
}: SubmissionCardProps) {
  const isPending = submission.status === 'pending';
  const isProcessing = processing === submission.id;

  const borderColor = submission.status === 'pending'
    ? 'border-l-[hsl(var(--warning)/0.55)]'
    : submission.status === 'approved'
    ? 'border-l-[hsl(var(--success)/0.45)]'
    : 'border-l-[hsl(var(--destructive)/0.35)]';

  return (
    <Card className={`border-l-[3px] ${borderColor} hover:shadow-none hover:translate-y-0`}>
      <CardContent className="px-3.5 py-3.5">
        {/* Badge row */}
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          {submission.item_type === 'hazard' ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--destructive)/0.18)] bg-[hsl(var(--destructive)/0.10)] px-2 py-0.5 text-[11px] font-semibold text-foreground">
              <AlertTriangle className="h-3 w-3" />
              Hazard
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--info)/0.18)] bg-[hsl(var(--info)/0.10)] px-2 py-0.5 text-[11px] font-semibold text-foreground">
              <Shield className="h-3 w-3" />
              Control
            </span>
          )}
          <span className="inline-flex items-center rounded-full border border-border/80 bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground/75">
            {submission.category || 'General'}
          </span>
          <StatusBadge status={submission.status} />
        </div>

        {/* Item content */}
        <p className="mb-1.5 font-semibold text-[14px] leading-snug text-foreground">
          {submission.label}
        </p>

        {/* Meta line */}
        <p className="text-[12px] font-medium text-foreground/60">
          Submitted {format(new Date(submission.created_at), 'dd MMM yyyy · HH:mm')}
        </p>

        {/* Existing admin notes for reviewed items */}
        {!isPending && submission.admin_notes && (
          <p className="mt-1.5 text-[12px] italic text-foreground/55">
            Admin: {submission.admin_notes}
          </p>
        )}

        {/* Pending: collapsible admin action area */}
        {isPending && (
          <div className="mt-3">
            <Separator className="mb-2.5" />

            <button
              onClick={onToggleActions}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-primary/80 transition-colors w-full"
            >
              {isActionsExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Hide review actions
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Review this item
                </>
              )}
            </button>

            {isActionsExpanded && (
              <div className="mt-2.5 space-y-2.5">
                <Textarea
                  placeholder="Admin notes (optional)"
                  className="text-sm min-h-[60px] resize-none"
                  rows={2}
                  value={adminNote}
                  onChange={(e) => onAdminNoteChange(e.target.value)}
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    size="sm"
                    className="h-10 w-full sm:flex-1"
                    onClick={onApprove}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Add to Library
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 w-full sm:flex-1"
                    onClick={onReject}
                    disabled={isProcessing}
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
}

/* ── Status Badge ── */

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--warning)/0.22)] bg-[hsl(var(--warning)/0.12)] px-2 py-0.5 text-[11px] font-semibold text-foreground">
          <Clock className="h-3 w-3" />
          Awaiting Review
        </span>
      );
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--success)/0.22)] bg-[hsl(var(--success)/0.12)] px-2 py-0.5 text-[11px] font-semibold text-foreground">
          <CheckCircle2 className="h-3 w-3" />
          In Library
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--destructive)/0.18)] bg-[hsl(var(--destructive)/0.10)] px-2 py-0.5 text-[11px] font-semibold text-foreground">
          <XCircle className="h-3 w-3" />
          Not Added
        </span>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default RiskItemSubmissions;
