import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  CheckCircle, XCircle, Clock, Search, AlertTriangle, Layers, Copy, Link2, ShieldCheck, Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { EQUIPMENT_GROUPS, EQUIPMENT_GROUP_LABELS, type EquipmentGroup } from '@/constants/checkLibrary';

/* ─── Types ─── */

interface RideTypeRequest {
  id: string;
  user_id: string;
  name: string;
  type: string;
  description: string;
  manufacturer: string | null;
  additional_info: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

interface ExistingCategory {
  id: string;
  name: string;
  category_group: string;
  description?: string | null;
}

type StatusTab = 'pending' | 'approved' | 'rejected' | 'duplicate' | 'all';

/* ─── Helpers ─── */

const GROUP_KEY_TO_CATEGORY: Record<EquipmentGroup, string> = {
  rides: 'Rides', inflatables: 'Inflatables', stalls: 'Stalls',
  attractions: 'Attractions', food_stalls: 'Food Stalls', games: 'Games', equipment: 'Equipment',
};

const categoryGroupToKey = (cg: string): EquipmentGroup => {
  const lower = cg.toLowerCase().replace(/\s+/g, '_') as EquipmentGroup;
  return EQUIPMENT_GROUPS.includes(lower) ? lower : 'rides';
};

const statusColor = (s: string) => {
  switch (s) {
    case 'approved': return 'bg-green-600 text-white';
    case 'rejected': return 'bg-destructive text-destructive-foreground';
    case 'duplicate': return 'bg-amber-600 text-white';
    default: return 'border border-border text-foreground';
  }
};

const statusIcon = (s: string) => {
  switch (s) {
    case 'approved': return <CheckCircle className="h-3 w-3" />;
    case 'rejected': return <XCircle className="h-3 w-3" />;
    case 'duplicate': return <Copy className="h-3 w-3" />;
    default: return <Clock className="h-3 w-3" />;
  }
};

/* ─── Enhanced duplicate finder with confidence + reasons ─── */

interface DuplicateMatch {
  category: ExistingCategory;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}

function findDuplicateMatches(name: string, group: string, existing: ExistingCategory[]): DuplicateMatch[] {
  if (!name || name.length < 2) return [];
  const lower = name.toLowerCase().trim();
  const tokens = lower.split(/\s+/);

  return existing
    .map(cat => {
      const catLower = cat.name.toLowerCase();
      const reasons: string[] = [];
      let score = 0;

      // Exact name match
      if (catLower === lower) {
        score = 100;
        reasons.push('Exact name match');
      }
      // Name contains or is contained
      else if (catLower.includes(lower) || lower.includes(catLower)) {
        score = 70;
        reasons.push('Similar name');
      }
      // Token overlap
      else {
        const catTokens = catLower.split(/\s+/);
        const overlap = tokens.filter(t => catTokens.some(ct => ct.includes(t) || t.includes(ct))).length;
        const tokenScore = (overlap / Math.max(tokens.length, catTokens.length)) * 60;
        if (tokenScore >= 15) {
          score = tokenScore;
          reasons.push('Partial word match');
        }
      }

      if (score < 15) return null;

      // Same group boost + reason
      if (cat.category_group === group) {
        score += 15;
        reasons.push('Same equipment group');
      } else {
        reasons.push('Different group');
      }

      const confidence: 'high' | 'medium' | 'low' = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

      return { category: cat, score, confidence, reasons };
    })
    .filter((r): r is DuplicateMatch => r !== null && r.score >= 25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* ─── Confidence helpers ─── */

const confidenceLabel = (c: DuplicateMatch['confidence']) =>
  c === 'high' ? 'High' : c === 'medium' ? 'Medium' : 'Low';

const confidenceVariant = (c: DuplicateMatch['confidence']): 'destructive' | 'default' | 'secondary' =>
  c === 'high' ? 'destructive' : c === 'medium' ? 'default' : 'secondary';

/* ─── Duplicate Status Banner on Cards ─── */

function DuplicateStatusBanner({
  matches,
  onPreview,
}: {
  matches: DuplicateMatch[];
  onPreview: (cat: ExistingCategory) => void;
}) {
  if (matches.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2.5">
        <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
        <p className="text-xs text-muted-foreground">No similar type found</p>
      </div>
    );
  }

  const hasHigh = matches.some(m => m.confidence === 'high');

  return (
    <div className={`rounded-lg border p-2.5 space-y-2 ${
      hasHigh
        ? 'border-destructive/40 bg-destructive/5'
        : 'border-amber-500/30 bg-amber-500/5'
    }`}>
      <p className={`text-xs font-medium flex items-center gap-1.5 ${
        hasHigh ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'
      }`}>
        <AlertTriangle className="h-3.5 w-3.5" />
        {hasHigh ? 'Likely existing type found' : 'Possible similar type found'}
      </p>
      <div className="space-y-1.5">
        {matches.map(m => (
          <button
            key={m.category.id}
            onClick={() => onPreview(m.category)}
            className="w-full text-left flex items-start gap-2 text-xs rounded-md p-1.5 -m-1 hover:bg-background/60 transition-colors"
          >
            <Badge
              variant={confidenceVariant(m.confidence)}
              className="text-[10px] shrink-0 mt-0.5"
            >
              {confidenceLabel(m.confidence)}
            </Badge>
            <div className="min-w-0">
              <span className="font-medium underline decoration-dotted">{m.category.name}</span>
              <span className="text-muted-foreground ml-1">({m.category.category_group})</span>
              {m.category.description && (
                <p className="text-muted-foreground/70 line-clamp-1 mt-0.5">{m.category.description}</p>
              )}
              <p className="text-muted-foreground/60 mt-0.5">{m.reasons.join(' · ')}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Quick Type Preview Dialog ─── */

function TypePreviewDialog({
  category, open, onClose,
}: {
  category: ExistingCategory | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!category) return null;
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Existing Type</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">{category.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Equipment Group</p>
            <p>{category.category_group}</p>
          </div>
          {category.description && (
            <div>
              <p className="text-xs text-muted-foreground">Description</p>
              <p>{category.description}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Approval Dialog ─── */

const ApprovalDialog = memo(function ApprovalDialog({
  request, existingCategories, open, onClose, onApproved,
}: {
  request: RideTypeRequest | null;
  existingCategories: ExistingCategory[];
  open: boolean;
  onClose: () => void;
  onApproved: (id: string, categoryName: string, categoryGroup: string) => void;
}) {
  const [typeName, setTypeName] = useState('');
  const [group, setGroup] = useState<EquipmentGroup>('rides');
  const [description, setDescription] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (request && open) {
      setTypeName(request.name);
      setGroup(categoryGroupToKey(request.type));
      setDescription(request.description || '');
      setAdminNote('');
    }
  }, [request, open]);

  const categoryGroup = GROUP_KEY_TO_CATEGORY[group];
  const duplicates = useMemo(
    () => findDuplicateMatches(typeName, categoryGroup, existingCategories),
    [typeName, categoryGroup, existingCategories]
  );

  const handleApprove = async () => {
    if (!request || !typeName.trim()) return;
    setSaving(true);
    try {
      const { data: newCat, error: catError } = await supabase
        .from('ride_categories')
        .insert({ name: typeName.trim(), category_group: categoryGroup, description: description || null, source: 'approved_request', approved_from_request_id: request?.id || null })
        .select('id')
        .single();
      if (catError) throw catError;

      const { error: reqError } = await supabase
        .from('ride_type_requests')
        .update({ status: 'approved', admin_notes: adminNote || null })
        .eq('id', request.id);
      if (reqError) throw reqError;

      try {
        const { data: emailData } = await supabase.functions.invoke('get-user-email', {
          body: { userId: request.user_id },
        });
        if (emailData?.email) {
          await supabase.functions.invoke('send-request-status-email', {
            body: {
              userEmail: emailData.email,
              requestType: 'ride_type',
              requestName: typeName.trim(),
              status: 'approved',
              adminNotes: adminNote || undefined,
            },
          });
        }
      } catch { /* email failure is non-blocking */ }

      onApproved(request.id, typeName.trim(), categoryGroup);
      toast({ title: 'Type Created', description: `"${typeName.trim()}" added to ${categoryGroup} and is now available to all users.` });
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create type', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to Library</DialogTitle>
          <DialogDescription>
            Review and confirm the details before creating a new shared equipment type.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type Name</Label>
            <Input value={typeName} onChange={(e) => setTypeName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Equipment Group</Label>
            <Select value={group} onValueChange={(v) => setGroup(v as EquipmentGroup)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EQUIPMENT_GROUPS.map(g => (
                  <SelectItem key={g} value={g}>{EQUIPMENT_GROUP_LABELS[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          {duplicates.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                Similar types already exist
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {duplicates.map(d => (
                  <li key={d.category.id} className="flex items-center gap-2">
                    <Badge variant={confidenceVariant(d.confidence)} className="text-[10px]">
                      {confidenceLabel(d.confidence)}
                    </Badge>
                    <span className="font-medium">{d.category.name}</span>
                    <span className="text-xs opacity-60">({d.category.category_group})</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Check whether this type is already covered before approving.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Admin Note (optional)</Label>
            <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2}
              placeholder="Internal note about this decision…" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApprove} disabled={saving || !typeName.trim()} className="gap-2">
            <CheckCircle className="h-4 w-4" />
            {saving ? 'Creating…' : 'Create Type'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

/* ─── Link to Existing Type Dialog ─── */

const LinkExistingDialog = memo(function LinkExistingDialog({
  request, existingCategories, open, onClose, onMarked,
}: {
  request: RideTypeRequest | null;
  existingCategories: ExistingCategory[];
  open: boolean;
  onClose: () => void;
  onMarked: (id: string) => void;
}) {
  const [matchedId, setMatchedId] = useState('');
  const [note, setNote] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Compute suggested matches
  const suggestedMatches = useMemo(() => {
    if (!request) return [];
    return findDuplicateMatches(request.name, request.type, existingCategories);
  }, [request, existingCategories]);

  useEffect(() => {
    if (request && open) {
      setNote('');
      setSearchTerm('');
      // Pre-select best match
      setMatchedId(suggestedMatches[0]?.category.id || '');
    }
  }, [request, open, suggestedMatches]);

  const handleMark = async () => {
    if (!request) return;
    setSaving(true);
    try {
      const matched = existingCategories.find(c => c.id === matchedId);
      const adminNote = matched
        ? `Linked to existing type: ${matched.name} (${matched.category_group})${note ? '. ' + note : ''}`
        : note || 'Marked as duplicate';

      const { error } = await supabase
        .from('ride_type_requests')
        .update({ status: 'duplicate', admin_notes: adminNote })
        .eq('id', request.id);
      if (error) throw error;

      onMarked(request.id);
      toast({ title: 'Linked to Existing', description: `Request for "${request.name}" linked to "${matched?.name || 'existing type'}".` });
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!request) return null;

  // Filter library for the searchable list
  const filteredCategories = useMemo(() => {
    const suggestedIds = new Set(suggestedMatches.map(m => m.category.id));
    let cats = existingCategories.filter(c => !suggestedIds.has(c.id));
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      cats = cats.filter(c => c.name.toLowerCase().includes(q) || c.category_group.toLowerCase().includes(q));
    }
    return cats.sort((a, b) => a.name.localeCompare(b.name));
  }, [existingCategories, suggestedMatches, searchTerm]);

  const selectedCategory = existingCategories.find(c => c.id === matchedId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link to Existing Type</DialogTitle>
          <DialogDescription>
            Select the existing equipment type that covers "{request.name}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Suggested matches */}
          {suggestedMatches.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Suggested Matches</Label>
              <div className="space-y-1.5">
                {suggestedMatches.map(m => (
                  <button
                    key={m.category.id}
                    onClick={() => setMatchedId(m.category.id)}
                    className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors ${
                      matchedId === m.category.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={confidenceVariant(m.confidence)}
                        className="text-[10px] shrink-0"
                      >
                        {confidenceLabel(m.confidence)}
                      </Badge>
                      <span className="font-medium">{m.category.name}</span>
                      <span className="text-xs text-muted-foreground">({m.category.category_group})</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 mt-1 pl-1">{m.reasons.join(' · ')}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search full library */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              {suggestedMatches.length > 0 ? 'Or search all types' : 'Search equipment types'}
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search library…"
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border p-1">
              {filteredCategories.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No types found</p>
              ) : (
                filteredCategories.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setMatchedId(c.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-sm transition-colors ${
                      matchedId === c.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    {c.name} <span className="text-xs text-muted-foreground">({c.category_group})</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Selected preview */}
          {selectedCategory && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5 text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">Selected</p>
              <p className="font-medium">{selectedCategory.name} <span className="text-muted-foreground font-normal">({selectedCategory.category_group})</span></p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder="Additional context…" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleMark} disabled={saving || !matchedId} variant="secondary" className="gap-2">
            <Link2 className="h-4 w-4" />
            {saving ? 'Saving…' : 'Link to Existing'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

/* ─── Main Page ─── */

export default function RideTypeRequests() {
  const [requests, setRequests] = useState<RideTypeRequest[]>([]);
  const [existingCategories, setExistingCategories] = useState<ExistingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');

  // Dialog state
  const [approveTarget, setApproveTarget] = useState<RideTypeRequest | null>(null);
  const [linkTarget, setLinkTarget] = useState<RideTypeRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RideTypeRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [previewCategory, setPreviewCategory] = useState<ExistingCategory | null>(null);

  const { toast } = useToast();
  const { logEvent } = useAuditLog();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [reqRes, catRes] = await Promise.all([
      supabase.from('ride_type_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('ride_categories').select('id, name, category_group, description').order('name'),
    ]);
    if (reqRes.data) setRequests(reqRes.data);
    if (catRes.data) setExistingCategories(catRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── Reject handler ─── */
  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      const { error } = await supabase
        .from('ride_type_requests')
        .update({ status: 'rejected', admin_notes: rejectNote || 'Not suitable for addition' })
        .eq('id', rejectTarget.id);
      if (error) throw error;

      try {
        const { data: emailData } = await supabase.functions.invoke('get-user-email', {
          body: { userId: rejectTarget.user_id },
        });
        if (emailData?.email) {
          await supabase.functions.invoke('send-request-status-email', {
            body: {
              userEmail: emailData.email,
              requestType: 'ride_type',
              requestName: rejectTarget.name,
              status: 'rejected',
              adminNotes: rejectNote || undefined,
            },
          });
        }
      } catch { /* non-blocking */ }

      logEvent('update', 'ride' as any, rejectTarget.id, { action: 'reject_type_request', name: rejectTarget.name });

      setRequests(prev => prev.map(r => r.id === rejectTarget.id
        ? { ...r, status: 'rejected', admin_notes: rejectNote || 'Not suitable for addition' } : r));
      toast({ title: 'Request Rejected', description: `"${rejectTarget.name}" has been rejected.` });
      setRejectTarget(null);
      setRejectNote('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setRejecting(false);
    }
  };

  /* ─── Optimistic update callbacks ─── */
  const onApproved = useCallback((id: string, catName: string, catGroup: string) => {
    logEvent('create', 'ride' as any, id, { action: 'approve_type_request', created_category: catName, category_group: catGroup });
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
    setExistingCategories(prev => [...prev, { id: crypto.randomUUID(), name: catName, category_group: catGroup }]);
  }, [logEvent]);

  const onLinked = useCallback((id: string) => {
    logEvent('update', 'ride' as any, id, { action: 'link_type_request' });
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'duplicate' } : r));
  }, [logEvent]);

  /* ─── Filtering ─── */
  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, approved: 0, rejected: 0, duplicate: 0, all: 0 };
    requests.forEach(r => {
      c.all++;
      c[r.status] = (c[r.status] || 0) + 1;
    });
    return c;
  }, [requests]);

  const filtered = useMemo(() => {
    let list = requests;
    if (statusTab !== 'all') list = list.filter(r => r.status === statusTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.name.toLowerCase().includes(q)
        || r.type.toLowerCase().includes(q)
        || (r.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [requests, statusTab, search]);

  /* ─── Duplicate matches per pending request ─── */
  const getMatches = useCallback((req: RideTypeRequest) => {
    return findDuplicateMatches(req.name, req.type, existingCategories);
  }, [existingCategories]);

  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'duplicate', label: 'Linked' },
    { key: 'all', label: 'All' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6" />
            Equipment Type Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review requests for new equipment types. If a matching type already exists, link the request to that existing library item.
          </p>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setStatusTab(t.key)}
              className={`flex-shrink-0 text-xs font-medium py-1.5 px-3 rounded-full transition-colors ${
                statusTab === t.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label} ({tabCounts[t.key] || 0})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Input
            placeholder="Search requests…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>

        {/* Request list */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading requests…</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <Layers className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {requests.length === 0
                  ? 'No equipment type requests yet. New requests from users will appear here for review.'
                  : statusTab !== 'all'
                    ? `No ${statusTab === 'duplicate' ? 'linked' : statusTab} equipment type requests`
                    : 'No requests match your search'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(req => {
              const matches = req.status === 'pending' ? getMatches(req) : [];
              return (
                <Card key={req.id}>
                  <CardContent className="p-4 space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-base leading-tight break-words">{req.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {req.type} · {format(new Date(req.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Badge className={`flex-shrink-0 gap-1 ${statusColor(req.status)}`}>
                        {statusIcon(req.status)}
                        {req.status === 'duplicate' ? 'Linked' : req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </Badge>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground">{req.description}</p>

                    {/* Optional fields */}
                    {req.manufacturer && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Manufacturer:</span> {req.manufacturer}
                      </p>
                    )}
                    {req.additional_info && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Additional info:</span> {req.additional_info}
                      </p>
                    )}

                    {/* Duplicate detection status — only on pending */}
                    {req.status === 'pending' && (
                      <DuplicateStatusBanner matches={matches} onPreview={setPreviewCategory} />
                    )}

                    {/* Admin notes */}
                    {req.admin_notes && req.status !== 'pending' && (
                      <div className="rounded-lg bg-muted/40 p-2.5">
                        <p className="text-xs font-medium mb-0.5">Admin Notes</p>
                        <p className="text-xs text-muted-foreground">{req.admin_notes}</p>
                      </div>
                    )}

                    {/* Actions */}
                    {req.status === 'pending' && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" className="gap-1.5" onClick={() => setApproveTarget(req)}>
                          <CheckCircle className="h-3.5 w-3.5" />
                          Add to Library
                        </Button>
                        <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setLinkTarget(req)}>
                          <Link2 className="h-3.5 w-3.5" />
                          Link to Existing Type
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setRejectTarget(req)}>
                          <XCircle className="h-3.5 w-3.5" />
                          Reject Request
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Approval dialog */}
      <ApprovalDialog
        request={approveTarget}
        existingCategories={existingCategories}
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        onApproved={onApproved}
      />

      {/* Link to existing dialog */}
      <LinkExistingDialog
        request={linkTarget}
        existingCategories={existingCategories}
        open={!!linkTarget}
        onClose={() => setLinkTarget(null)}
        onMarked={onLinked}
      />

      {/* Reject confirmation */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(v) => !v && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Request</AlertDialogTitle>
            <AlertDialogDescription>
              "{rejectTarget?.name}" will not be added to the system. The user will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Reason for rejection…" rows={2} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={rejecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {rejecting ? 'Rejecting…' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Type preview */}
      <TypePreviewDialog
        category={previewCategory}
        open={!!previewCategory}
        onClose={() => setPreviewCategory(null)}
      />
    </AdminLayout>
  );
}
