import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Search, Loader2, Sparkles, Clock, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { AdminLayout } from '@/components/admin/AdminLayout';

interface Submission {
  id: string;
  user_id: string;
  ride_category_id: string | null;
  label: string;
  hint: string | null;
  frequency: string;
  is_generic: boolean;
  status: string;
  admin_notes: string | null;
  similarity_group: string | null;
  created_at: string;
  ride_category?: {
    name: string;
    category_group: string;
  } | null;
}

interface GroupedSubmissions {
  [key: string]: Submission[];
}

export default function CheckItemSubmissions() {
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; category_group: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [grouping, setGrouping] = useState(false);
  const [filter, setFilter] = useState({ status: 'pending', frequency: 'all', search: '' });
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [approvalData, setApprovalData] = useState({
    label: '',
    hint: '',
    ride_category_id: '',
    risk_level: 'low',
    admin_notes: ''
  });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchSubmissions();
    fetchCategories();
  }, [filter.status, filter.frequency]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('ride_categories')
      .select('id, name, category_group')
      .order('category_group')
      .order('name');
    if (data) setCategories(data);
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('user_submitted_check_items')
        .select(`
          *,
          ride_category:ride_categories(name, category_group)
        `)
        .order('created_at', { ascending: false });

      if (filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }
      if (filter.frequency !== 'all') {
        query = query.eq('frequency', filter.frequency);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSubmissions(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading submissions",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGroupSimilar = async () => {
    setGrouping(true);
    try {
      const { error } = await supabase.functions.invoke('group-similar-check-items', {});
      if (error) throw error;
      toast({
        title: "Grouping complete",
        description: "Similar items have been grouped together"
      });
      fetchSubmissions();
    } catch (error: any) {
      toast({
        title: "Error grouping items",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setGrouping(false);
    }
  };

  const openApprovalDialog = (submission: Submission) => {
    setSelectedSubmission(submission);
    setApprovalData({
      label: submission.label,
      hint: submission.hint || '',
      ride_category_id: submission.is_generic ? '' : (submission.ride_category_id || ''),
      risk_level: 'low',
      admin_notes: ''
    });
  };

  const handleApprove = async () => {
    if (!selectedSubmission) return;
    setProcessing(true);

    try {
      // Get max sort_index for this frequency
      const freq = selectedSubmission.frequency as 'preopening' | 'daily' | 'monthly' | 'yearly';
      const { data: maxSort } = await supabase
        .from('check_library_items')
        .select('sort_index')
        .eq('frequency', freq)
        .order('sort_index', { ascending: false })
        .limit(1)
        .maybeSingle();

      const newSortIndex = (maxSort?.sort_index || 0) + 1;

      // Insert into check_library_items
      const { error: insertError } = await supabase
        .from('check_library_items')
        .insert([{
          label: approvalData.label.trim(),
          hint: approvalData.hint.trim() || null,
          frequency: freq,
          ride_category_id: approvalData.ride_category_id || null,
          risk_level: approvalData.risk_level,
          sort_index: newSortIndex,
          is_active: true
        }]);

      if (insertError) throw insertError;

      // Update submission status
      const { error: updateError } = await supabase
        .from('user_submitted_check_items')
        .update({
          status: 'approved',
          admin_notes: approvalData.admin_notes || null,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedSubmission.id);

      if (updateError) throw updateError;

      toast({
        title: "Item approved",
        description: "Added to the check library for all users"
      });

      setSelectedSubmission(null);
      fetchSubmissions();
    } catch (error: any) {
      toast({
        title: "Error approving item",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (submission: Submission, reason?: string) => {
    try {
      const { error } = await supabase
        .from('user_submitted_check_items')
        .update({
          status: 'rejected',
          admin_notes: reason || 'Not suitable for library',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', submission.id);

      if (error) throw error;

      toast({
        title: "Item rejected",
        description: "Submission has been rejected"
      });
      fetchSubmissions();
    } catch (error: any) {
      toast({
        title: "Error rejecting item",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleMarkDuplicate = async (submission: Submission) => {
    try {
      const { error } = await supabase
        .from('user_submitted_check_items')
        .update({
          status: 'duplicate',
          admin_notes: 'Already exists in library or similar submission',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', submission.id);

      if (error) throw error;

      toast({
        title: "Marked as duplicate",
        description: "Submission marked as duplicate"
      });
      fetchSubmissions();
    } catch (error: any) {
      toast({
        title: "Error updating item",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Group submissions by similarity_group for display
  const groupedSubmissions: GroupedSubmissions = submissions.reduce((acc, sub) => {
    const key = sub.similarity_group || sub.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(sub);
    return acc;
  }, {} as GroupedSubmissions);

  const filteredSubmissions = submissions.filter(s => 
    !filter.search || s.label.toLowerCase().includes(filter.search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'duplicate':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200"><Copy className="w-3 h-3 mr-1" />Duplicate</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'preopening': return 'Pre-Use';
      case 'daily': return 'Daily';
      case 'monthly': return 'Monthly';
      case 'yearly': return 'Yearly';
      default: return freq;
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Check Item Submissions</h1>
        <p className="text-muted-foreground">Review user-submitted check items for the library</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={filter.search}
                  onChange={(e) => setFilter(f => ({ ...f, search: e.target.value }))}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="w-[150px]">
              <Label className="text-xs">Status</Label>
              <Select value={filter.status} onValueChange={(v) => setFilter(f => ({ ...f, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="duplicate">Duplicate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <Label className="text-xs">Frequency</Label>
              <Select value={filter.frequency} onValueChange={(v) => setFilter(f => ({ ...f, frequency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="preopening">Pre-Use</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={handleGroupSimilar} disabled={grouping}>
              {grouping ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Group Similar (AI)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">
              {submissions.filter(s => s.status === 'pending').length}
            </div>
            <div className="text-xs text-muted-foreground">Pending Review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">
              {submissions.filter(s => s.status === 'approved').length}
            </div>
            <div className="text-xs text-muted-foreground">Approved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">
              {submissions.filter(s => s.status === 'rejected').length}
            </div>
            <div className="text-xs text-muted-foreground">Rejected</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-600">
              {submissions.filter(s => s.status === 'duplicate').length}
            </div>
            <div className="text-xs text-muted-foreground">Duplicates</div>
          </CardContent>
        </Card>
      </div>

      {/* Submissions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No submissions found matching your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSubmissions.map((submission) => (
            <Card key={submission.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {getStatusBadge(submission.status)}
                      <Badge variant="secondary">{getFrequencyLabel(submission.frequency)}</Badge>
                      {submission.is_generic ? (
                        <Badge variant="outline">Generic</Badge>
                      ) : submission.ride_category ? (
                        <Badge className="bg-primary/10 text-primary">{submission.ride_category.name}</Badge>
                      ) : null}
                    </div>
                    <p className="font-medium text-sm">{submission.label}</p>
                    {submission.hint && (
                      <p className="text-xs text-muted-foreground mt-1">{submission.hint}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Submitted {format(new Date(submission.created_at), 'PPp')}
                    </p>
                  </div>
                  
                  {submission.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openApprovalDialog(submission)}>
                        <Check className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleMarkDuplicate(submission)}>
                        <Copy className="w-4 h-4 mr-1" />
                        Duplicate
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReject(submission)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approval Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve Check Item</DialogTitle>
            <DialogDescription>
              Edit the item before adding it to the library for all users.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Label</Label>
              <Input
                value={approvalData.label}
                onChange={(e) => setApprovalData(d => ({ ...d, label: e.target.value }))}
                placeholder="Check item text"
              />
            </div>
            <div>
              <Label>Hint (optional)</Label>
              <Textarea
                value={approvalData.hint}
                onChange={(e) => setApprovalData(d => ({ ...d, hint: e.target.value }))}
                placeholder="Additional guidance for this check"
                rows={2}
              />
            </div>
            <div>
              <Label>Category (leave empty for generic)</Label>
              <Select 
                value={approvalData.ride_category_id} 
                onValueChange={(v) => setApprovalData(d => ({ ...d, ride_category_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Generic (all equipment)" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50 max-h-[300px]">
                  <SelectItem value="">Generic (all equipment)</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name} ({cat.category_group})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Risk Level</Label>
              <Select 
                value={approvalData.risk_level} 
                onValueChange={(v) => setApprovalData(d => ({ ...d, risk_level: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="med">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Admin Notes (optional)</Label>
              <Textarea
                value={approvalData.admin_notes}
                onChange={(e) => setApprovalData(d => ({ ...d, admin_notes: e.target.value }))}
                placeholder="Internal notes about this approval"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={processing || !approvalData.label.trim()}>
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Add to Library
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
