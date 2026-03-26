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
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Library className="w-5 h-5 text-primary shrink-0" />
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Risk Library Intake</h1>
        </div>
        <p className="text-[13px] text-foreground/60 font-medium leading-snug max-w-lg">
          Review user-created hazards and controls for the shared library. Users already use these items privately.
        </p>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <button
          onClick={() => setFilter('pending')}
          className={`text-left rounded-xl border p-3.5 transition-colors ${
            filter === 'pending'
              ? 'ring-2 ring-primary border-primary bg-primary/5'
              : 'hover:border-primary/40 bg-card'
          }`}
        >
          <span className="text-[11px] font-bold text-foreground/65 uppercase tracking-wider leading-tight block mb-1">
            Awaiting Review
          </span>
          <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{counts.pending}</span>
        </button>
        <div className="rounded-xl border p-3.5 bg-card">
          <span className="text-[11px] font-bold text-foreground/65 uppercase tracking-wider leading-tight block mb-1">
            Hazards
          </span>
          <span className="text-2xl font-bold text-destructive">{counts.hazards}</span>
        </div>
        <div className="rounded-xl border p-3.5 bg-card col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-foreground/65 uppercase tracking-wider leading-tight block mb-1">
            Controls
          </span>
          <span className="text-2xl font-bold text-green-600 dark:text-green-400">{counts.controls}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5">
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="flex-1 h-9 text-sm">
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
          <SelectTrigger className="flex-1 h-9 text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="hazard">Hazards</SelectItem>
            <SelectItem value="control">Controls</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadSubmissions}
          disabled={loading}
          className="h-9 w-9 min-w-0 min-h-0 px-0 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Submissions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : submissions.length === 0 ? (
        <Card className="hover:shadow-none hover:translate-y-0">
          <CardContent className="py-12 text-center">
            <Check className="h-10 w-10 mx-auto text-green-500 mb-3" />
            <h3 className="font-semibold text-[15px]">No submissions to review</h3>
            <p className="text-sm text-muted-foreground mt-1">All caught up!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
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
    ? 'border-l-yellow-400'
    : submission.status === 'approved'
    ? 'border-l-green-400'
    : 'border-l-red-300';

  return (
    <Card className={`border-l-[3px] ${borderColor} hover:shadow-none hover:translate-y-0`}>
      <CardContent className="px-3.5 pt-3.5 pb-3">
        {/* Badge row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          {submission.item_type === 'hazard' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" />
              Hazard
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
              <Shield className="h-3 w-3" />
              Control
            </span>
          )}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-foreground/70">
            {submission.category || 'General'}
          </span>
          <StatusBadge status={submission.status} />
        </div>

        {/* Item content */}
        <p className="font-semibold text-[14px] leading-snug text-foreground mb-1.5">
          {submission.label}
        </p>

        {/* Meta line */}
        <p className="text-[12px] text-foreground/50 font-medium">
          Submitted {format(new Date(submission.created_at), 'dd MMM yyyy · HH:mm')}
        </p>

        {/* Existing admin notes for reviewed items */}
        {!isPending && submission.admin_notes && (
          <p className="text-[12px] text-foreground/50 mt-1.5 italic">
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
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-10"
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
                    className="flex-1 h-10"
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800">
          <Clock className="h-3 w-3" />
          Awaiting Review
        </span>
      );
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
          <CheckCircle2 className="h-3 w-3" />
          In Library
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
          <XCircle className="h-3 w-3" />
          Not Added
        </span>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default RiskItemSubmissions;
