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
  CheckCircle, XCircle, Clock, Search, AlertTriangle, FolderOpen, Copy,
} from 'lucide-react';
import { format } from 'date-fns';
import { EQUIPMENT_GROUPS, EQUIPMENT_GROUP_LABELS, type EquipmentGroup } from '@/constants/checkLibrary';

/* ─── Types ─── */

interface RideTypeRequest {
  id: string;
  user_id: string;
  name: string;
  type: string; // stored as PascalCase category_group e.g. "Rides"
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

/* ─── Duplicate finder ─── */

function findSimilarCategories(name: string, group: string, existing: ExistingCategory[]): ExistingCategory[] {
  if (!name || name.length < 2) return [];
  const lower = name.toLowerCase().trim();
  const tokens = lower.split(/\s+/);

  return existing
    .map(cat => {
      const catLower = cat.name.toLowerCase();
      // exact match
      if (catLower === lower) return { cat, score: 100 };
      // contains
      if (catLower.includes(lower) || lower.includes(catLower)) return { cat, score: 70 };
      // token overlap
      const catTokens = catLower.split(/\s+/);
      const overlap = tokens.filter(t => catTokens.some(ct => ct.includes(t) || t.includes(ct))).length;
      const tokenScore = (overlap / Math.max(tokens.length, catTokens.length)) * 60;
      if (tokenScore < 15) return null;
      // boost same group
      const groupBoost = cat.category_group === group ? 15 : 0;
      return { cat, score: tokenScore + groupBoost };
    })
    .filter((r): r is { cat: ExistingCategory; score: number } => r !== null && r.score >= 25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(r => r.cat);
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
    () => findSimilarCategories(typeName, categoryGroup, existingCategories),
    [typeName, categoryGroup, existingCategories]
  );

  const handleApprove = async () => {
    if (!request || !typeName.trim()) return;
    setSaving(true);
    try {
      // 1. Create the taxonomy entry
      const { data: newCat, error: catError } = await supabase
        .from('ride_categories')
        .insert({ name: typeName.trim(), category_group: categoryGroup, description: description || null })
        .select('id')
        .single();
      if (catError) throw catError;

      // 2. Update the request status
      const { error: reqError } = await supabase
        .from('ride_type_requests')
        .update({ status: 'approved', admin_notes: adminNote || null })
        .eq('id', request.id);
      if (reqError) throw reqError;

      // 3. Notify user
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
          <DialogTitle>Add Equipment Type to System</DialogTitle>
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
                  <li key={d.id} className="flex items-center gap-2">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-xs opacity-60">({d.category_group})</span>
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

/* ─── Mark Duplicate Dialog ─── */

const DuplicateDialog = memo(function DuplicateDialog({
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
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (request && open) {
      setNote('');
      // Pre-select best match
      const matches = findSimilarCategories(request.name, request.type, existingCategories);
      setMatchedId(matches[0]?.id || '');
    }
  }, [request, open, existingCategories]);

  const handleMark = async () => {
    if (!request) return;
    setSaving(true);
    try {
      const matched = existingCategories.find(c => c.id === matchedId);
      const adminNote = matched
        ? `Duplicate of existing type: ${matched.name} (${matched.category_group})${note ? '. ' + note : ''}`
        : note || 'Marked as duplicate';

      const { error } = await supabase
        .from('ride_type_requests')
        .update({ status: 'duplicate', admin_notes: adminNote })
        .eq('id', request.id);
      if (error) throw error;

      onMarked(request.id);
      toast({ title: 'Marked as Duplicate', description: `Request for "${request.name}" marked as duplicate.` });
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!request) return null;

  const sameGroupCats = existingCategories
    .filter(c => c.category_group === request.type)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark as Duplicate</DialogTitle>
          <DialogDescription>
            Select the existing type that covers "{request.name}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Existing Type</Label>
            <Select value={matchedId} onValueChange={setMatchedId}>
              <SelectTrigger><SelectValue placeholder="Select existing type…" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {sameGroupCats.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{request.type}</div>
                    {sameGroupCats.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </>
                )}
                {existingCategories.filter(c => c.category_group !== request.type).length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Other Groups</div>
                    {existingCategories
                      .filter(c => c.category_group !== request.type)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.category_group})</SelectItem>
                      ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder="Additional context…" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleMark} disabled={saving} variant="secondary" className="gap-2">
            <Copy className="h-4 w-4" />
            {saving ? 'Saving…' : 'Mark Duplicate'}
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
  const [duplicateTarget, setDuplicateTarget] = useState<RideTypeRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RideTypeRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const { toast } = useToast();
  const { logEvent } = useAuditLog();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [reqRes, catRes] = await Promise.all([
      supabase.from('ride_type_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('ride_categories').select('id, name, category_group').order('name'),
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

      // Notify user
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

  const onDuplicateMarked = useCallback((id: string) => {
    logEvent('update', 'ride' as any, id, { action: 'duplicate_type_request' });
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

  /* ─── Duplicate warnings per request ─── */
  const getDuplicateWarnings = useCallback((req: RideTypeRequest) => {
    return findSimilarCategories(req.name, req.type, existingCategories);
  }, [existingCategories]);

  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'duplicate', label: 'Duplicate' },
    { key: 'all', label: 'All' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="h-6 w-6" />
            Equipment Type Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review requests for new shared ride or equipment types used across the app.
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
            <CardContent className="py-12 text-center text-muted-foreground">
              {requests.length === 0
                ? 'No equipment type requests yet'
                : 'No requests match your current filters'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(req => {
              const dupes = req.status === 'pending' ? getDuplicateWarnings(req) : [];
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
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
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

                    {/* Duplicate warning */}
                    {dupes.length > 0 && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-1">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Possible existing match
                        </p>
                        <ul className="text-xs text-muted-foreground space-y-0.5 pl-5">
                          {dupes.map(d => (
                            <li key={d.id}>{d.name} <span className="opacity-60">({d.category_group})</span></li>
                          ))}
                        </ul>
                      </div>
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
                          Add to System
                        </Button>
                        <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setDuplicateTarget(req)}>
                          <Copy className="h-3.5 w-3.5" />
                          Already Exists
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setRejectTarget(req)}>
                          <XCircle className="h-3.5 w-3.5" />
                          Don't Add
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

      {/* Duplicate dialog */}
      <DuplicateDialog
        request={duplicateTarget}
        existingCategories={existingCategories}
        open={!!duplicateTarget}
        onClose={() => setDuplicateTarget(null)}
        onMarked={onDuplicateMarked}
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
    </AdminLayout>
  );
}
