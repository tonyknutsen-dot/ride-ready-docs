import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Search, Loader2, Sparkles, Clock, CheckCircle2, XCircle, Copy, Inbox, MoreVertical, Library, BookOpen, Globe, Target } from 'lucide-react';
import { format } from 'date-fns';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const CHECK_CATEGORIES = [
  "Restraints", "Structure", "Control Systems", "Safety Devices",
  "Electrical", "Mechanical", "Hydraulic/Pneumatic", "General"
];

const EQUIPMENT_GROUPS = [
  "Rides", "Inflatables", "Stalls", "Attractions", "Food Stalls", "Games", "Equipment"
];

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
  category: string | null;
  created_at: string;
  reviewed_at: string | null;
  ride_category?: {
    name: string;
    category_group: string;
  } | null;
}

interface LibraryMatch {
  id: string;
  label: string;
  category: string | null;
  equipment_group: string;
  ride_category_id: string | null;
  frequency: string;
}

export default function CheckItemSubmissions() {
  const { toast } = useToast();
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryMatch[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; category_group: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [grouping, setGrouping] = useState(false);
  const [filter, setFilter] = useState({ status: 'pending', frequency: 'all', search: '' });
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Submission | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvalData, setApprovalData] = useState({
    label: '',
    hint: '',
    scope: 'general' as 'general' | 'specific',
    equipment_group: 'Rides',
    ride_category_id: '',
    check_category: 'General',
    risk_level: 'low',
    admin_notes: ''
  });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchAllSubmissions();
    fetchCategories();
    fetchLibraryItems();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('ride_categories')
      .select('id, name, category_group')
      .order('category_group')
      .order('name');
    if (data) setCategories(data);
  };

  const fetchLibraryItems = async () => {
    const { data } = await supabase
      .from('check_library_items')
      .select('id, label, category, equipment_group, ride_category_id, frequency')
      .eq('is_active', true);
    if (data) setLibraryItems(data as LibraryMatch[]);
  };

  const fetchAllSubmissions = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_submitted_check_items')
        .select(`*, ride_category:ride_categories(name, category_group)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAllSubmissions(data || []);
    } catch (error: any) {
      toast({ title: "Error loading submissions", description: error.message, variant: "destructive" });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Optimistically update a submission's status in local state
  const updateSubmissionLocally = (id: string, updates: Partial<Submission>) => {
    setAllSubmissions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Find library items that match a submission by text similarity
  const findLibraryMatches = (submission: Submission): LibraryMatch[] => {
    const words = submission.label.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (words.length === 0) return [];
    return libraryItems.filter(item => {
      const itemLower = item.label.toLowerCase();
      // Exact match
      if (itemLower === submission.label.toLowerCase()) return true;
      // Significant word overlap
      const matchCount = words.filter(w => itemLower.includes(w)).length;
      return matchCount >= Math.ceil(words.length * 0.6);
    }).slice(0, 3);
  };

  const counts = {
    pending: allSubmissions.filter(s => s.status === 'pending').length,
    approved: allSubmissions.filter(s => s.status === 'approved').length,
    rejected: allSubmissions.filter(s => s.status === 'rejected').length,
    duplicate: allSubmissions.filter(s => s.status === 'duplicate').length,
  };

  const filteredSubmissions = allSubmissions.filter(s => {
    if (filter.status !== 'all' && s.status !== filter.status) return false;
    if (filter.frequency !== 'all' && s.frequency !== filter.frequency) return false;
    if (filter.search && !s.label.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  const handleGroupSimilar = async () => {
    setGrouping(true);
    try {
      const { error } = await supabase.functions.invoke('group-similar-check-items', {});
      if (error) throw error;
      toast({ title: "Grouping complete", description: "Similar items have been grouped together" });
      fetchAllSubmissions();
    } catch (error: any) {
      toast({ title: "Error grouping items", description: error.message, variant: "destructive" });
    } finally {
      setGrouping(false);
    }
  };

  const openApprovalDialog = (submission: Submission) => {
    const matchedCategoryGroup = submission.ride_category?.category_group;
    const inferredGroup = matchedCategoryGroup && EQUIPMENT_GROUPS.includes(matchedCategoryGroup)
      ? matchedCategoryGroup : 'Rides';

    setSelectedSubmission(submission);
    setApprovalData({
      label: submission.label,
      hint: submission.hint || '',
      scope: submission.is_generic ? 'general' : 'specific',
      equipment_group: inferredGroup,
      ride_category_id: submission.ride_category_id || '',
      check_category: submission.category || 'General',
      risk_level: 'low',
      admin_notes: ''
    });
  };

  const handleApprove = async () => {
    if (!selectedSubmission) return;
    setProcessing(true);
    try {
      const freq = selectedSubmission.frequency as 'preopening' | 'daily' | 'monthly' | 'yearly';
      const { data: maxSort } = await supabase
        .from('check_library_items')
        .select('sort_index')
        .eq('frequency', freq)
        .order('sort_index', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error: insertError } = await supabase
        .from('check_library_items')
        .insert([{
          label: approvalData.label.trim(),
          hint: approvalData.hint.trim() || null,
          frequency: freq,
          equipment_group: approvalData.scope === 'general' ? 'Rides' : approvalData.equipment_group,
          ride_category_id: approvalData.scope === 'specific' && approvalData.ride_category_id
            ? approvalData.ride_category_id : null,
          category: approvalData.check_category,
          risk_level: approvalData.risk_level,
          sort_index: (maxSort?.sort_index || 0) + 1,
          is_active: true
        }]);
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('user_submitted_check_items')
        .update({ status: 'approved', admin_notes: approvalData.admin_notes || null, reviewed_at: new Date().toISOString() })
        .eq('id', selectedSubmission.id);
      if (updateError) throw updateError;

      toast({ title: "Added to library", description: `"${approvalData.label.trim()}" is now available in the shared library.` });
      updateSubmissionLocally(selectedSubmission.id, { status: 'approved', admin_notes: approvalData.admin_notes || null, reviewed_at: new Date().toISOString() });
      setSelectedSubmission(null);
      fetchLibraryItems();
      fetchAllSubmissions(true); // silent background sync
    } catch (error: any) {
      toast({ title: "Error approving item", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('user_submitted_check_items')
        .update({ status: 'rejected', admin_notes: rejectReason || 'Not suitable for shared library', reviewed_at: new Date().toISOString() })
        .eq('id', rejectTarget.id);
      if (error) throw error;
      toast({ title: "Not added to library", description: "The user can still use this item in their own checks." });
      setRejectTarget(null);
      setRejectReason('');
      fetchAllSubmissions();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const [duplicateTarget, setDuplicateTarget] = useState<Submission | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [duplicateNote, setDuplicateNote] = useState('');

  const openDuplicateDialog = (submission: Submission) => {
    const matches = findLibraryMatches(submission);
    setDuplicateTarget(submission);
    setSelectedMatchId(matches.length > 0 ? matches[0].id : '');
    setDuplicateNote('');
  };

  const handleMarkDuplicate = async () => {
    if (!duplicateTarget) return;
    setProcessing(true);
    const matchedItem = libraryItems.find(i => i.id === selectedMatchId);
    const matchNote = matchedItem
      ? `Already in library: "${matchedItem.label}"`
      : duplicateNote || 'Already covered by existing library item';
    try {
      const { error } = await supabase
        .from('user_submitted_check_items')
        .update({
          status: 'duplicate',
          admin_notes: matchNote,
          matched_library_item_id: selectedMatchId || null,
          reviewed_at: new Date().toISOString()
        } as any)
        .eq('id', duplicateTarget.id);
      if (error) throw error;
      toast({ title: "Already covered", description: "Marked as covered by existing library item." });
      setDuplicateTarget(null);
      fetchAllSubmissions();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'preopening': return 'Pre-Opening';
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      case 'yearly': return 'Yearly';
      default: return freq;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'border-l-yellow-500';
      case 'approved': return 'border-l-green-500';
      case 'rejected': return 'border-l-red-500';
      case 'duplicate': return 'border-l-muted-foreground';
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
      case 'duplicate':
        return <Badge variant="outline" className="bg-muted text-muted-foreground"><Copy className="w-3 h-3 mr-1" />Already Covered</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSimilarItems = (submission: Submission) => {
    if (!submission.similarity_group) return [];
    return allSubmissions.filter(s => s.similarity_group === submission.similarity_group && s.id !== submission.id);
  };

  const filteredCategories = useMemo(() => {
    if (approvalData.scope !== 'specific') return [];
    return categories.filter(c => c.category_group === approvalData.equipment_group);
  }, [categories, approvalData.scope, approvalData.equipment_group]);

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Library className="w-5 h-5 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Library Intake Queue</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-xl">
          Review user-created check items for inclusion in the shared library. Users can already use their own items privately — this queue is for promoting items to the global library.
        </p>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
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
          onClick={() => setFilter(f => ({ ...f, status: 'duplicate' }))}
          className={`text-left rounded-lg border p-3 transition-colors ${filter.status === 'duplicate' ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/40'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Copy className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Already Covered</span>
          </div>
          <div className="text-2xl font-bold text-muted-foreground">{counts.duplicate}</div>
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search check items..."
            value={filter.search}
            onChange={(e) => setFilter(f => ({ ...f, search: e.target.value }))}
            className="pl-9"
          />
        </div>
        <div className="flex gap-3">
          <Select value={filter.frequency} onValueChange={(v) => setFilter(f => ({ ...f, frequency: v }))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Frequency" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="all">All Frequencies</SelectItem>
              <SelectItem value="preopening">Pre-Opening</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          {counts.pending >= 3 && (
            <Button variant="outline" size="sm" onClick={handleGroupSimilar} disabled={grouping} className="whitespace-nowrap">
              {grouping ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
              Group Similar
            </Button>
          )}
        </div>
      </div>

      {/* Active filter indicator */}
      {(filter.status !== 'pending' || filter.frequency !== 'all' || filter.search) && (
        <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
          <span>Showing {filteredSubmissions.length} items</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setFilter({ status: 'pending', frequency: 'all', search: '' })}>
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
            const similarItems = getSimilarItems(submission);
            const libraryMatches = findLibraryMatches(submission);
            const isPending = submission.status === 'pending';

            return (
              <Card key={submission.id} className={`border-l-4 ${getStatusColor(submission.status)} overflow-hidden`}>
                <CardContent className="p-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {getStatusBadge(submission.status)}
                      <Badge variant="secondary" className="text-xs">{getFrequencyLabel(submission.frequency)}</Badge>
                      {submission.ride_category ? (
                        <Badge className="bg-primary/10 text-primary text-xs">{submission.ride_category.name}</Badge>
                      ) : submission.is_generic ? (
                        <Badge variant="outline" className="text-xs"><Globe className="w-3 h-3 mr-0.5" />General</Badge>
                      ) : null}
                    </div>
                    {isPending && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 sm:hidden">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
                          <DropdownMenuItem onClick={() => openApprovalDialog(submission)}>
                            <Check className="w-4 h-4 mr-2 text-green-600" />Add to Library
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDuplicateDialog(submission)}>
                            <Copy className="w-4 h-4 mr-2" />Already Covered
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setRejectTarget(submission); setRejectReason(''); }} className="text-destructive">
                            <X className="w-4 h-4 mr-2" />Don't Add
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Card Body */}
                  <p className="font-medium text-sm leading-snug mb-1 break-words">{submission.label}</p>
                  {submission.hint && (
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2 break-words">{submission.hint}</p>
                  )}

                  {submission.category && submission.category !== 'General' && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800 mb-2">
                      {submission.category}
                    </Badge>
                  )}

                  {/* Library match detection */}
                  {isPending && libraryMatches.length > 0 && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-2.5 mb-2">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> Possible library match
                      </p>
                      {libraryMatches.map(match => (
                        <div key={match.id} className="text-xs text-amber-700 dark:text-amber-400 mb-0.5">
                          <span className="font-medium">"{match.label}"</span>
                          <span className="text-amber-600/70 dark:text-amber-500/70 ml-1">
                            · {match.equipment_group}{match.category ? ` · ${match.category}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Similarity group matches (between submissions) */}
                  {isPending && similarItems.length > 0 && libraryMatches.length === 0 && (
                    <div className="rounded-md bg-muted/60 border border-dashed p-2.5 mb-2">
                      <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Similar submissions ({similarItems.length})
                      </p>
                      {similarItems.slice(0, 2).map(s => (
                        <p key={s.id} className="text-xs text-muted-foreground truncate">• {s.label}</p>
                      ))}
                    </div>
                  )}

                  {/* Admin notes on reviewed items */}
                  {submission.admin_notes && !isPending && (
                    <p className="text-xs text-muted-foreground italic mt-1">Note: {submission.admin_notes}</p>
                  )}

                  {/* Card Footer */}
                  <Separator className="my-2.5" />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(submission.created_at), 'dd MMM yyyy')}
                      {submission.reviewed_at && (
                        <> · Reviewed {format(new Date(submission.reviewed_at), 'dd MMM yyyy')}</>
                      )}
                    </p>

                    {isPending && (
                      <div className="hidden sm:flex gap-2">
                        <Button size="sm" className="h-8 text-xs" onClick={() => openApprovalDialog(submission)}>
                          <Check className="w-3.5 h-3.5 mr-1" />Add to Library
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openDuplicateDialog(submission)}>
                          <Copy className="w-3.5 h-3.5 mr-1" />Already Covered
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => { setRejectTarget(submission); setRejectReason(''); }}>
                          <X className="w-3.5 h-3.5 mr-1" />Don't Add
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approval Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="w-5 h-5 text-primary" />
              Add to Shared Library
            </DialogTitle>
            <DialogDescription>
              This item will become available to all users in the check library. The submitting user already has access to it in their own checks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Check Item Text</Label>
              <Input
                value={approvalData.label}
                onChange={(e) => setApprovalData(d => ({ ...d, label: e.target.value }))}
                placeholder="Check item text"
              />
            </div>
            <div>
              <Label>Hint / Guidance (optional)</Label>
              <Textarea
                value={approvalData.hint}
                onChange={(e) => setApprovalData(d => ({ ...d, hint: e.target.value }))}
                placeholder="Additional guidance for inspectors"
                rows={2}
              />
            </div>

            {/* Scope selection */}
            <div>
              <Label className="mb-2 block">Library Scope</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setApprovalData(d => ({ ...d, scope: 'general' }))}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                    approvalData.scope === 'general' ? 'ring-2 ring-primary border-primary bg-primary/5' : 'hover:border-primary/40'
                  }`}
                >
                  <Globe className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="font-medium">General shared item</p>
                    <p className="text-xs text-muted-foreground">Available for all equipment types</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalData(d => ({ ...d, scope: 'specific' }))}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                    approvalData.scope === 'specific' ? 'ring-2 ring-primary border-primary bg-primary/5' : 'hover:border-primary/40'
                  }`}
                >
                  <Target className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="font-medium">Equipment-specific shared item</p>
                    <p className="text-xs text-muted-foreground">Only for a specific equipment group or type</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Equipment group / category (only for specific scope) */}
            {approvalData.scope === 'specific' && (
              <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
                <div>
                  <Label>Equipment Group</Label>
                  <Select
                    value={approvalData.equipment_group}
                    onValueChange={(v) => setApprovalData(d => ({ ...d, equipment_group: v, ride_category_id: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {EQUIPMENT_GROUPS.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Equipment Type (optional — leave blank for whole group)</Label>
                  <Select
                    value={approvalData.ride_category_id || '__none__'}
                    onValueChange={(v) => setApprovalData(d => ({ ...d, ride_category_id: v === '__none__' ? '' : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All types in group" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50 max-h-[300px]">
                      <SelectItem value="__none__">All types in {approvalData.equipment_group}</SelectItem>
                      {filteredCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Check Category</Label>
                <Select
                  value={approvalData.check_category}
                  onValueChange={(v) => setApprovalData(d => ({ ...d, check_category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {CHECK_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
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
            </div>
            <div>
              <Label>Admin Notes (optional, internal only)</Label>
              <Textarea
                value={approvalData.admin_notes}
                onChange={(e) => setApprovalData(d => ({ ...d, admin_notes: e.target.value }))}
                placeholder="Internal notes about this approval"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setSelectedSubmission(null)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={processing || !approvalData.label.trim()} className="w-full sm:w-auto">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Library className="w-4 h-4 mr-2" />}
              Add to Shared Library
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Don't Add to Library</DialogTitle>
            <DialogDescription>
              This item won't be added to the shared library. The user can still use it in their own checks — this only affects library promotion.
            </DialogDescription>
          </DialogHeader>
          {rejectTarget && (
            <div className="rounded-md bg-muted p-3 mb-2">
              <p className="text-sm font-medium break-words">{rejectTarget.label}</p>
            </div>
          )}
          <div>
            <Label>Reason (optional)</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Too specific, already covered, unclear wording..."
              rows={2}
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)} className="w-full sm:w-auto">Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing} className="w-full sm:w-auto">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
              Don't Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate / Already Covered Dialog */}
      <Dialog open={!!duplicateTarget} onOpenChange={(open) => !open && setDuplicateTarget(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5 text-muted-foreground" />
              Already Covered
            </DialogTitle>
            <DialogDescription>
              Select the existing library item that already covers this check. The user can still use their own item privately.
            </DialogDescription>
          </DialogHeader>
          {duplicateTarget && (
            <div className="rounded-md bg-muted p-3 mb-2">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Submitted item</p>
              <p className="text-sm font-medium break-words">{duplicateTarget.label}</p>
            </div>
          )}
          <div>
            <Label className="mb-1.5 block">Matched library item</Label>
            <Select value={selectedMatchId || '__none__'} onValueChange={(v) => setSelectedMatchId(v === '__none__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select matching library item" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50 max-h-[250px]">
                <SelectItem value="__none__">No specific match (general duplicate)</SelectItem>
                {duplicateTarget && findLibraryMatches(duplicateTarget).map(match => (
                  <SelectItem key={match.id} value={match.id}>
                    ⭐ {match.label} ({match.equipment_group})
                  </SelectItem>
                ))}
                {libraryItems.slice(0, 30).map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label} ({item.equipment_group})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Textarea
              value={duplicateNote}
              onChange={(e) => setDuplicateNote(e.target.value)}
              placeholder="Additional context..."
              rows={2}
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDuplicateTarget(null)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleMarkDuplicate} disabled={processing} className="w-full sm:w-auto">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
              Mark as Already Covered
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
