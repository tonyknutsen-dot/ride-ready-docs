import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Check, X, AlertTriangle, Shield, Loader2, RefreshCw, Clock, CheckCircle2, XCircle, Library } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  const handleApprove = async (submission: RiskItemSubmission) => {
    setProcessing(submission.id);
    // Optimistic update
    updateSubmissionLocally(submission.id, { status: 'approved', admin_notes: adminNotes[submission.id] || null });

    try {
      // 1. Get next sort_index for this item_type
      const { data: maxSort } = await supabase
        .from('risk_library_items')
        .select('sort_index')
        .eq('item_type', submission.item_type)
        .order('sort_index', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2. Insert into shared risk library
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

      // 3. Update submission status
      const { error: updateError } = await supabase
        .from('user_submitted_risk_items')
        .update({
          status: 'approved',
          admin_notes: adminNotes[submission.id] || null
        })
        .eq('id', submission.id);
      if (updateError) throw updateError;

      toast({ title: 'Added to library', description: `"${submission.label}" is now available in the shared risk library.` });
    } catch (error: any) {
      // Revert optimistic update
      updateSubmissionLocally(submission.id, { status: 'pending', admin_notes: submission.admin_notes });
      toast({ title: 'Error approving', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (submission: RiskItemSubmission) => {
    setProcessing(submission.id);
    // Optimistic update
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

      toast({ title: 'Not added to library', description: 'The user can still use this item in their own risk assessments.' });
    } catch (error: any) {
      // Revert
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
    <div className="space-y-5">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Library className="w-5 h-5 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Risk Library Intake</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-xl">
          Review user-created hazards and controls for inclusion in the shared risk library. Users can already use their own items privately — this queue is for promoting items to the global library.
        </p>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setFilter('pending')}
          className={`text-left rounded-lg border p-3 transition-colors ${filter === 'pending' ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/40'}`}
        >
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Awaiting Review</span>
          <div className="text-2xl font-bold text-yellow-600">{counts.pending}</div>
        </button>
        <div className="rounded-lg border p-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hazards</span>
          <div className="text-2xl font-bold text-destructive">{counts.hazards}</div>
        </div>
        <div className="rounded-lg border p-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Controls</span>
          <div className="text-2xl font-bold text-green-600">{counts.controls}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
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
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="hazard">Hazards</SelectItem>
            <SelectItem value="control">Controls</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={loadSubmissions} disabled={loading} className="ml-auto h-9">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Submissions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="font-semibold">No submissions to review</h3>
            <p className="text-sm text-muted-foreground">All caught up!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {submissions.map((submission) => (
            <Card key={submission.id} className={`border-l-4 ${
              submission.status === 'pending' ? 'border-l-yellow-500' :
              submission.status === 'approved' ? 'border-l-green-500' :
              submission.status === 'rejected' ? 'border-l-red-500' : ''
            }`}>
              <CardContent className="pt-4 pb-3">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <Badge variant={submission.item_type === 'hazard' ? 'destructive' : 'default'} className="text-xs">
                          {submission.item_type === 'hazard' ? <AlertTriangle className="h-3 w-3 mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
                          {submission.item_type}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{submission.category}</Badge>
                        {getStatusBadge(submission.status)}
                      </div>
                      <p className="font-medium">{submission.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(submission.created_at), 'dd MMM yyyy HH:mm')}
                      </p>
                      {submission.admin_notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          Notes: {submission.admin_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {submission.status === 'pending' && (
                    <div className="space-y-2 pt-1 border-t">
                      <Textarea
                        placeholder="Admin notes (optional)"
                        className="text-sm h-16"
                        rows={2}
                        value={adminNotes[submission.id] || ''}
                        onChange={(e) => setAdminNotes(prev => ({ ...prev, [submission.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 h-9"
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
                          className="flex-1 h-9"
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RiskItemSubmissions;
