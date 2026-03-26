import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useDocumentTypes, type DocumentType } from '@/hooks/useDocumentTypes';
import {
  CheckCircle, XCircle, Clock, Search, AlertTriangle, FileText, ShieldCheck, Link2,
} from 'lucide-react';
import { format } from 'date-fns';

/* ─── Types use live document_types table via useDocumentTypes hook ─── */

/* ─── Types ─── */

interface DocTypeRequest {
  id: string;
  user_id: string;
  document_type_name: string;
  description: string | null;
  justification: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

type StatusTab = 'pending' | 'approved' | 'rejected' | 'linked' | 'all';

/* ─── Duplicate detection ─── */

interface DuplicateMatch {
  docType: { id: string; name: string; category: string };
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}

function findDuplicateMatches(name: string, existingTypes: { id: string; name: string; category: string }[]): DuplicateMatch[] {
  if (!name || name.length < 2 || existingTypes.length === 0) return [];
  const lower = name.toLowerCase().trim();
  const tokens = lower.split(/\s+/);

  return existingTypes
    .map(dt => {
      const dtLower = dt.name.toLowerCase();
      const reasons: string[] = [];
      let score = 0;

      if (dtLower === lower) {
        score = 100;
        reasons.push('Exact name match');
      } else if (dtLower.includes(lower) || lower.includes(dtLower)) {
        score = 70;
        reasons.push('Similar name');
      } else {
        const dtTokens = dtLower.split(/\s+/);
        const overlap = tokens.filter(t => dtTokens.some(ct => ct.includes(t) || t.includes(ct))).length;
        const tokenScore = (overlap / Math.max(tokens.length, dtTokens.length)) * 60;
        if (tokenScore >= 15) {
          score = tokenScore;
          reasons.push('Partial word match');
        }
      }

      if (score < 15) return null;
      reasons.push(dt.category);

      const confidence: 'high' | 'medium' | 'low' = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
      return { docType: dt, score, confidence, reasons };
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

/* ─── Status helpers ─── */

const statusColor = (s: string) => {
  switch (s) {
    case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'linked': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
    default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
  }
};

const statusIcon = (s: string) => {
  switch (s) {
    case 'approved': return <CheckCircle className="h-3 w-3" />;
    case 'rejected': return <XCircle className="h-3 w-3" />;
    case 'linked': return <Link2 className="h-3 w-3" />;
    default: return <Clock className="h-3 w-3" />;
  }
};

const statusLabel = (s: string) => {
  switch (s) {
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    case 'linked': return 'Linked';
    default: return 'Pending';
  }
};

/* ─── Duplicate Status Banner ─── */

function DuplicateStatusBanner({ matches }: { matches: DuplicateMatch[] }) {
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
          <div key={m.docType.id} className="flex items-start gap-2 text-xs p-1.5">
            <Badge variant={confidenceVariant(m.confidence)} className="text-[10px] shrink-0 mt-0.5">
              {confidenceLabel(m.confidence)}
            </Badge>
            <div className="min-w-0">
              <span className="font-medium">{m.docType.name}</span>
              <p className="text-muted-foreground/60 mt-0.5">{m.reasons.join(' · ')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Link to Existing Dialog ─── */

const LinkExistingDialog = memo(function LinkExistingDialog({
  request, open, onClose, onLinked, existingTypes,
}: {
  request: DocTypeRequest | null;
  open: boolean;
  onClose: () => void;
  onLinked: (id: string) => void;
  existingTypes: { id: string; name: string; category: string }[];
}) {
  const [matchedId, setMatchedId] = useState('');
  const [note, setNote] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const suggestedMatches = useMemo(() => {
    if (!request) return [];
    return findDuplicateMatches(request.document_type_name, existingTypes);
  }, [request, existingTypes]);

  const filteredTypes = useMemo(() => {
    const suggestedIds = new Set(suggestedMatches.map(m => m.docType.id));
    let types = existingTypes.filter(t => !suggestedIds.has(t.id));
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      types = types.filter(t => t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
    }
    return types;
  }, [suggestedMatches, searchTerm]);

  const selectedType = existingTypes.find(t => t.id === matchedId);

  useEffect(() => {
    if (request && open) {
      setNote('');
      setSearchTerm('');
      setMatchedId(suggestedMatches[0]?.docType.id || '');
    }
  }, [request, open, suggestedMatches]);

  const handleLink = async () => {
    if (!request) return;
    setSaving(true);
    try {
      const matched = existingTypes.find(t => t.id === matchedId);
      const adminNote = matched
        ? `Linked to existing type: ${matched.name} (${matched.category})${note ? '. ' + note : ''}`
        : note || 'Linked to existing type';

      const { error } = await supabase
        .from('document_type_requests')
        .update({ status: 'linked', admin_notes: adminNote })
        .eq('id', request.id);
      if (error) throw error;

      onLinked(request.id);
      toast({ title: 'Linked to Existing', description: `Request for "${request.document_type_name}" linked to "${matched?.name || 'existing type'}".` });
      onClose();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!request) return null;

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="max-h-[85dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Link to Existing Type</AlertDialogTitle>
          <AlertDialogDescription>
            Select the existing document type that covers "{request.document_type_name}".
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {suggestedMatches.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Suggested Matches</Label>
              <div className="space-y-1.5">
                {suggestedMatches.map(m => (
                  <button
                    key={m.docType.id}
                    onClick={() => setMatchedId(m.docType.id)}
                    className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors ${
                      matchedId === m.docType.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={confidenceVariant(m.confidence)} className="text-[10px] shrink-0">
                        {confidenceLabel(m.confidence)}
                      </Badge>
                      <span className="font-medium">{m.docType.name}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 mt-1 pl-1">{m.reasons.join(' · ')}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              {suggestedMatches.length > 0 ? 'Or search all types' : 'Search document types'}
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search types…" className="pl-8 h-9 text-sm" />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border p-1">
              {filteredTypes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No types found</p>
              ) : (
                filteredTypes.map(t => (
                  <button key={t.id} onClick={() => setMatchedId(t.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-sm transition-colors ${
                      matchedId === t.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                    }`}>
                    {t.name} <span className="text-xs text-muted-foreground">({t.category})</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedType && (
            <div className="rounded-lg border-2 border-primary bg-primary/5 p-3 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs font-semibold text-primary">Selected type to link</p>
              </div>
              <p className="font-semibold text-base">{selectedType.name}</p>
              <p className="text-xs text-muted-foreground">{selectedType.category}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder="Additional context…" />
          </div>
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleLink} disabled={saving || !matchedId} className="gap-2">
            <Link2 className="h-4 w-4" />
            {saving ? 'Saving…' : 'Link to Existing'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

/* ─── Main Page ─── */

export default function DocumentTypeRequests() {
  const [requests, setRequests] = useState<DocTypeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');

  // Dialog state
  const [linkTarget, setLinkTarget] = useState<DocTypeRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<DocTypeRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [approveTarget, setApproveTarget] = useState<DocTypeRequest | null>(null);
  const [approveNote, setApproveNote] = useState('');
  const [approving, setApproving] = useState(false);

  const { toast } = useToast();

  // Live document types from DB for duplicate detection and linking
  const { allTypes: liveDocTypes } = useDocumentTypes();
  const existingTypesForMatching = useMemo(() =>
    liveDocTypes.map(t => ({ id: t.type_key, name: t.name, category: t.category })),
    [liveDocTypes]
  );
  const { logEvent } = useAuditLog();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('document_type_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRequests(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── Approve handler ─── */
  const handleApprove = async () => {
    if (!approveTarget) return;
    setApproving(true);
    const target = approveTarget;
    const note = approveNote;
    try {
      // Generate a type_key from the name
      const typeKey = target.document_type_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

      // Create the document type in the library
      const { error: dtError } = await supabase
        .from('document_types')
        .insert({
          type_key: typeKey,
          name: target.document_type_name.trim(),
          category: 'Other',
          description: target.description || null,
          source: 'approved_request',
          approved_from_request_id: target.id,
        });
      if (dtError && !dtError.message?.includes('duplicate key')) throw dtError;

      // Update request status
      const { error } = await supabase
        .from('document_type_requests')
        .update({ status: 'approved', admin_notes: note || null })
        .eq('id', target.id);
      if (error) throw error;

      // Optimistic UI
      setRequests(prev => prev.map(r => r.id === target.id
        ? { ...r, status: 'approved', admin_notes: note || null } : r));
      toast({ title: 'Request Approved', description: `"${target.document_type_name}" has been approved and added to the Document Type Library.` });
      setApproveTarget(null);
      setApproveNote('');
      setApproving(false);

      // Fire-and-forget email
      logEvent('update', 'document' as any, target.id, { action: 'approve_doc_type_request', name: target.document_type_name });
      supabase.functions.invoke('get-user-email', { body: { userId: target.user_id } })
        .then(({ data: emailData }) => {
          if (emailData?.email) {
            supabase.functions.invoke('send-request-status-email', {
              body: {
                userEmail: emailData.email,
                requestType: 'document_type',
                requestName: target.document_type_name,
                status: 'approved',
                adminNotes: note || undefined,
              },
            }).catch(() => {});
          }
        }).catch(() => {});
    } catch (err: any) {
      const msg = err?.message?.includes('row-level security')
        ? 'Permission denied. The technical error has been logged.'
        : (err.message || 'Failed to approve');
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      setApproving(false);
    }
  };

  /* ─── Reject handler ─── */
  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    const target = rejectTarget;
    const note = rejectNote || 'Not suitable for addition';
    try {
      const { error } = await supabase
        .from('document_type_requests')
        .update({ status: 'rejected', admin_notes: note })
        .eq('id', target.id);
      if (error) throw error;

      // Optimistic UI
      setRequests(prev => prev.map(r => r.id === target.id
        ? { ...r, status: 'rejected', admin_notes: note } : r));
      toast({ title: 'Request Rejected', description: `"${target.document_type_name}" has been rejected.` });
      setRejectTarget(null);
      setRejectNote('');
      setRejecting(false);

      // Fire-and-forget email + audit
      logEvent('update', 'document' as any, target.id, { action: 'reject_doc_type_request', name: target.document_type_name });
      supabase.functions.invoke('get-user-email', { body: { userId: target.user_id } })
        .then(({ data: emailData }) => {
          if (emailData?.email) {
            supabase.functions.invoke('send-request-status-email', {
              body: {
                userEmail: emailData.email,
                requestType: 'document_type',
                requestName: target.document_type_name,
                status: 'rejected',
                adminNotes: note !== 'Not suitable for addition' ? note : undefined,
              },
            }).catch(() => {});
          }
        }).catch(() => {});
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setRejecting(false);
    }
  };

  /* ─── Linked callback ─── */
  const onLinked = useCallback((id: string) => {
    logEvent('update', 'document' as any, id, { action: 'link_doc_type_request' });
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'linked' } : r));
  }, [logEvent]);

  /* ─── Filtering ─── */
  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, approved: 0, rejected: 0, linked: 0, all: 0 };
    requests.forEach(r => {
      c.all++;
      const key = r.status === 'duplicate' ? 'linked' : r.status;
      c[key] = (c[key] || 0) + 1;
    });
    return c;
  }, [requests]);

  const filtered = useMemo(() => {
    let list = requests;
    if (statusTab !== 'all') {
      list = list.filter(r =>
        statusTab === 'linked'
          ? (r.status === 'linked' || r.status === 'duplicate')
          : r.status === statusTab
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.document_type_name.toLowerCase().includes(q)
        || (r.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [requests, statusTab, search]);

  /* ─── Duplicate matches per pending request ─── */
  const getMatches = useCallback((req: DocTypeRequest) => {
    return findDuplicateMatches(req.document_type_name, existingTypesForMatching);
  }, [existingTypesForMatching]);

  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'linked', label: 'Linked' },
    { key: 'all', label: 'All' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            Document Type Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review requests for new document types. If a matching type already exists, link the request to that existing type.
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
          <Input placeholder="Search requests…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>

        {/* Request list */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading requests…</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {requests.length === 0
                  ? 'No document type requests yet. New requests from users will appear here for review.'
                  : statusTab !== 'all'
                    ? `No ${statusTab} document type requests`
                    : 'No requests match your search'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(req => {
              const matches = req.status === 'pending' ? getMatches(req) : [];
              const displayStatus = req.status === 'duplicate' ? 'linked' : req.status;
              return (
                <Card key={req.id}>
                  <CardContent className="p-4 space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-base leading-tight break-words">{req.document_type_name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(req.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Badge className={`flex-shrink-0 gap-1 ${statusColor(displayStatus)}`}>
                        {statusIcon(displayStatus)}
                        {statusLabel(displayStatus)}
                      </Badge>
                    </div>

                    {/* Description */}
                    {req.description && (
                      <p className="text-sm text-muted-foreground">{req.description}</p>
                    )}

                    {/* Justification */}
                    {req.justification && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Justification:</span> {req.justification}
                      </p>
                    )}

                    {/* Duplicate detection — pending only */}
                    {req.status === 'pending' && (
                      <DuplicateStatusBanner matches={matches} />
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
                          Approve
                        </Button>
                        <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setLinkTarget(req)}>
                          <Link2 className="h-3.5 w-3.5" />
                          Link to Existing
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setRejectTarget(req)}>
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
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

      {/* Approve confirmation */}
      <AlertDialog open={!!approveTarget} onOpenChange={(v) => !v && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Request</AlertDialogTitle>
            <AlertDialogDescription>
              "{approveTarget?.document_type_name}" will be marked as approved. Remember to add this document type to the system manually.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Admin Note (optional)</Label>
            <Textarea value={approveNote} onChange={(e) => setApproveNote(e.target.value)}
              placeholder="Note about this decision…" rows={2} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={approving}
              className="gap-2">
              <CheckCircle className="h-4 w-4" />
              {approving ? 'Approving…' : 'Approve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject confirmation */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(v) => !v && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Request</AlertDialogTitle>
            <AlertDialogDescription>
              "{rejectTarget?.document_type_name}" will not be added. The user will be notified.
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

      {/* Link to existing dialog */}
      <LinkExistingDialog
        request={linkTarget}
        open={!!linkTarget}
        onClose={() => setLinkTarget(null)}
        onLinked={onLinked}
        existingTypes={existingTypesForMatching}
      />
    </AdminLayout>
  );
}
