import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search, ChevronRight, CheckCircle, ClipboardCheck, Zap, Wrench,
  FileText, Eye, History, Archive, RotateCcw, MoreVertical, Pencil,
  ChevronsUpDown, ChevronsDownUp, Download, ExternalLink,
} from 'lucide-react';
import { formatDateUK } from '@/utils/dateFormat';
import { format, parseISO } from 'date-fns';
import {
  fetchRideDocuments, fetchDocumentVersions, archiveRideDocument,
  restoreRideDocument, RideDocument,
} from '@/utils/rideDocumentService';
import CompletedEventEditSheet from '@/components/CompletedEventEditSheet';

// ── Types ──

type DaysFilter = 7 | 30 | 90 | 365 | 0;
type CategoryFilter = 'all' | 'inspection' | 'ndt' | 'maintenance' | 'doc_expiry';

interface CompletedItem {
  id: string;
  eventName: string;
  eventType: string;
  category: string;
  rideName: string;
  rideId: string | null;
  dueDate: string;
  completedAt: string;
  inspectorCompany: string | null;
  certificateReference: string | null;
  completionNotes: string | null;
  evidenceUrls: string[];
  documentId: string | null;
  fullDocumentId: string | null;
  completedByName: string | null;
  completedByRole: string | null;
}

interface CompletedComplianceTabProps {
  effectiveUserId: string;
}

// ── Constants ──

const DAYS_OPTIONS: { value: DaysFilter; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 365, label: '12m' },
  { value: 0, label: 'All' },
];

const CATEGORY_CONFIG: { key: string; label: string; icon: typeof ClipboardCheck }[] = [
  { key: 'inspection', label: 'INSPECTIONS', icon: ClipboardCheck },
  { key: 'ndt', label: 'NDT', icon: Zap },
  { key: 'maintenance', label: 'MAINTENANCE', icon: Wrench },
  { key: 'doc_expiry', label: 'DOCUMENT EXPIRY', icon: FileText },
];

const PAGE_SIZE = 25;

// ── Data fetch ──

async function fetchCompletedEvents(userId: string, days: DaysFilter) {
  const query = supabase
    .from('compliance_events')
    .select('id, event_name, event_type, category, ride_id, due_date, completed_at, inspector_company, certificate_reference, completion_notes, evidence_urls, full_document_id, completed_by_name, completed_by_role')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (days > 0) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    query.gte('completed_at', cutoff);
  }

  const [ridesRes, eventsRes] = await Promise.all([
    supabase.from('rides').select('id, ride_name').eq('user_id', userId),
    query,
  ]);

  const rideMap = new Map<string, string>();
  ridesRes.data?.forEach(r => rideMap.set(r.id, r.ride_name));

  const rideList = Array.from(rideMap.entries()).map(([id, name]) => ({ id, name }));

  const items: CompletedItem[] = (eventsRes.data || []).map(e => ({
    id: e.id,
    eventName: e.event_name,
    eventType: e.event_type,
    category: e.category,
    rideName: e.ride_id ? rideMap.get(e.ride_id) || 'Unknown' : 'Global',
    rideId: e.ride_id,
    dueDate: e.due_date,
    completedAt: e.completed_at || '',
    inspectorCompany: e.inspector_company,
    certificateReference: e.certificate_reference,
    completionNotes: e.completion_notes,
    evidenceUrls: (e.evidence_urls as string[]) || [],
    documentId: null,
    fullDocumentId: (e as any).full_document_id || null,
    completedByName: (e as any).completed_by_name || null,
    completedByRole: (e as any).completed_by_role || null,
  }));

  return { items, rideList };
}

// ── Component ──

const CompletedComplianceTab = ({ effectiveUserId }: CompletedComplianceTabProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Filters
  const [daysFilter, setDaysFilter] = useState<DaysFilter>(30);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  // Pagination per ride group
  const [ridePageMap, setRidePageMap] = useState<Record<string, number>>({});

  // Expand/collapse state
  const [openRides, setOpenRides] = useState<Set<string>>(new Set());
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  // Edit sheet
  const [editingEvent, setEditingEvent] = useState<CompletedItem | null>(null);

  // Version history dialog
  const [versionDialogDoc, setVersionDialogDoc] = useState<RideDocument | null>(null);
  const [versions, setVersions] = useState<RideDocument[]>([]);

  // Archive dialog
  const [archiveDialogDoc, setArchiveDialogDoc] = useState<RideDocument | null>(null);
  const [archiveReason, setArchiveReason] = useState('');

  // Ride documents cache per ride
  const [rideDocsCache, setRideDocsCache] = useState<Record<string, RideDocument[]>>({});

  // Fallback: documents table cache per ride (when ride_documents is empty)
  const [docsFallbackCache, setDocsFallbackCache] = useState<Record<string, { id: string; document_name: string; file_path: string; notes: string | null; document_type: string; ride_id: string }[]>>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['compliance-completed', effectiveUserId, daysFilter],
    queryFn: () => fetchCompletedEvents(effectiveUserId, daysFilter),
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
  });

  const allItems = data?.items ?? [];
  const rideList = data?.rideList ?? [];

  // Unified search: ride names + event names + reference numbers
  const filtered = useMemo(() => {
    return allItems.filter(item => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fields = [
          item.eventName, item.rideName, item.eventType,
          item.certificateReference || '', item.completionNotes || '',
        ];
        if (!fields.some(f => f.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [allItems, categoryFilter, searchQuery]);

  // Group: Ride → Category → items
  const rideGroups = useMemo(() => {
    const groups = new Map<string, {
      rideName: string;
      rideId: string | null;
      items: CompletedItem[];
      count: number;
      lastCompleted: string;
    }>();

    filtered.forEach(item => {
      const key = item.rideId || 'global';
      if (!groups.has(key)) {
        groups.set(key, { rideName: item.rideName, rideId: item.rideId, items: [], count: 0, lastCompleted: '' });
      }
      const g = groups.get(key)!;
      g.items.push(item);
      g.count++;
      if (!g.lastCompleted || (item.completedAt && item.completedAt > g.lastCompleted)) {
        g.lastCompleted = item.completedAt;
      }
    });

    return Array.from(groups.values()).sort((a, b) => b.lastCompleted.localeCompare(a.lastCompleted));
  }, [filtered]);

  // Expand/collapse all helpers
  const expandAll = useCallback(() => {
    const rideKeys = new Set(rideGroups.map(g => g.rideId || 'global'));
    setOpenRides(rideKeys);
    const catKeys = new Set<string>();
    rideGroups.forEach(g => {
      const rideKey = g.rideId || 'global';
      CATEGORY_CONFIG.forEach(cat => {
        if (g.items.some(i => i.category === cat.key)) {
          catKeys.add(`${rideKey}:${cat.key}`);
        }
      });
      if (g.rideId) loadRideDocs(g.rideId);
    });
    setOpenCategories(catKeys);
  }, [rideGroups]);

  const collapseAll = useCallback(() => {
    setOpenRides(new Set());
    setOpenCategories(new Set());
  }, []);

  const toggleRide = useCallback((rideKey: string, open: boolean, rideId: string | null) => {
    setOpenRides(prev => {
      const next = new Set(prev);
      if (open) { next.add(rideKey); if (rideId) loadRideDocs(rideId); }
      else next.delete(rideKey);
      return next;
    });
  }, []);

  const toggleCategory = useCallback((catKey: string, open: boolean) => {
    setOpenCategories(prev => {
      const next = new Set(prev);
      if (open) next.add(catKey);
      else next.delete(catKey);
      return next;
    });
  }, []);

  // Load ride_documents for a specific ride (lazy)
  const loadRideDocs = async (rideId: string) => {
    if (rideDocsCache[rideId]) return;
    const docs = await fetchRideDocuments(rideId, { includeArchived: true });
    setRideDocsCache(prev => ({ ...prev, [rideId]: docs }));

    // Also load from documents table as fallback
    if (!docsFallbackCache[rideId]) {
      const { data } = await supabase
        .from('documents')
        .select('id, document_name, file_path, notes, document_type, ride_id')
        .eq('ride_id', rideId)
        .eq('user_id', effectiveUserId)
        .order('uploaded_at', { ascending: false });
      if (data) {
        setDocsFallbackCache(prev => ({ ...prev, [rideId]: data }));
      }
    }
  };

  // Find CR doc for a given event - check ride_documents first, then fallback to documents table
  const findDocForEvent = (eventId: string, rideId: string | null): RideDocument | null => {
    if (!rideId) return null;
    const docs = rideDocsCache[rideId] || [];
    const rideDoc = docs.find(d => d.related_event_id === eventId && d.status === 'active');
    if (rideDoc) return rideDoc;

    // Fallback: check documents table by matching event ID in notes
    const fallbackDocs = docsFallbackCache[rideId] || [];
    const fallbackDoc = fallbackDocs.find(d => d.notes?.includes(`Event ID: ${eventId}`));
    if (fallbackDoc) {
      // Create a compatible RideDocument-like object
      return {
        id: fallbackDoc.id,
        ride_id: fallbackDoc.ride_id,
        ride_code: '',
        document_type: fallbackDoc.document_type,
        document_id: fallbackDoc.id,
        title: fallbackDoc.document_name,
        file_url: fallbackDoc.file_path,
        version: 1,
        status: 'active',
        created_by: effectiveUserId,
        created_at: '',
        related_event_id: eventId,
        metadata: null,
        archived_at: null,
        archived_by: null,
        archive_reason: null,
      } as RideDocument;
    }
    return null;
  };

  const getSignedUrl = async (doc: RideDocument): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('ride-documents')
      .createSignedUrl(doc.file_url, 3600);
    if (error || !data?.signedUrl) {
      toast({ title: 'Could not open document', variant: 'destructive' });
      return null;
    }
    return data.signedUrl;
  };

  const handleViewPdf = (doc: RideDocument) => {
    // Navigate to the full document viewer page
    navigate(`/documents/${doc.id}`);
  };

  const handleDownload = async (doc: RideDocument) => {
    const url = await getSignedUrl(doc);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.title || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShowVersions = async (doc: RideDocument) => {
    setVersionDialogDoc(doc);
    const v = await fetchDocumentVersions(doc.document_id);
    setVersions(v);
  };

  const handleArchive = async () => {
    if (!archiveDialogDoc || !user) return;
    const ok = await archiveRideDocument(archiveDialogDoc.id, user.id, archiveReason);
    if (ok) {
      toast({ title: 'Document archived' });
      setArchiveDialogDoc(null);
      setArchiveReason('');
      const rideId = archiveDialogDoc.ride_id;
      setRideDocsCache(prev => { const n = { ...prev }; delete n[rideId]; return n; });
    } else {
      toast({ title: 'Failed to archive', variant: 'destructive' });
    }
  };

  const handleRestore = async (doc: RideDocument) => {
    const ok = await restoreRideDocument(doc.id);
    if (ok) {
      toast({ title: 'Document restored' });
      setRideDocsCache(prev => { const n = { ...prev }; delete n[doc.ride_id]; return n; });
    } else {
      toast({ title: 'Failed to restore', variant: 'destructive' });
    }
  };

  const showMoreForRide = (rideKey: string) => {
    setRidePageMap(prev => ({ ...prev, [rideKey]: (prev[rideKey] || 1) + 1 }));
  };

  // ── Render ──

  return (
    <div className="space-y-2">
      {/* Row 1: Search + Type filter */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search rides, events, references…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v as CategoryFilter)}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="inspection">Inspection</SelectItem>
            <SelectItem value="ndt">NDT</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="doc_expiry">Doc Expiry</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Date chips left, Expand/Collapse right */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-0.5">
          {DAYS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setDaysFilter(opt.value); setRidePageMap({}); }}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                daysFilter === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            onClick={expandAll}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors rounded"
          >
            <ChevronsUpDown className="h-3 w-3" /> Expand
          </button>
          <button
            onClick={collapseAll}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors rounded"
          >
            <ChevronsDownUp className="h-3 w-3" /> Collapse
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="border border-border rounded-lg p-5 text-center space-y-1.5">
          <CheckCircle className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold text-foreground">
            No completed items in this period
          </p>
          <p className="text-xs text-muted-foreground">
            {searchQuery
              ? 'No results match your search'
              : `Nothing completed ${daysFilter > 0 ? `in the last ${daysFilter === 365 ? '12 months' : daysFilter + ' days'}` : ''}`}
          </p>
          {daysFilter > 0 && daysFilter < 90 && (
            <button
              className="text-xs text-primary font-medium hover:underline"
              onClick={() => setDaysFilter(90)}
            >
              Expand to 90 days
            </button>
          )}
          {daysFilter === 90 && (
            <button
              className="text-xs text-primary font-medium hover:underline"
              onClick={() => setDaysFilter(0)}
            >
              Show all time
            </button>
          )}
        </div>
      )}

      {/* Ride groups */}
      <div className="space-y-1">
        {!isLoading && rideGroups.map(group => {
          const rideKey = group.rideId || 'global';
          const currentPage = ridePageMap[rideKey] || 1;
          const isRideOpen = openRides.has(rideKey);

          const catGroups = CATEGORY_CONFIG.map(cat => ({
            ...cat,
            items: group.items.filter(i => i.category === cat.key),
          })).filter(cg => cg.items.length > 0);

          const totalItems = group.items.length;
          const maxVisible = currentPage * PAGE_SIZE;

          return (
            <Collapsible
              key={rideKey}
              open={isRideOpen}
              onOpenChange={open => toggleRide(rideKey, open, group.rideId)}
            >
              <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors text-left group">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground truncate">{group.rideName}</span>
                  <p className="text-[11px] leading-tight" style={{ color: '#64748B' }}>
                    {group.count} completed • Last completed {group.lastCompleted ? formatDateUK(group.lastCompleted) : '–'}
                  </p>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-0.5 ml-3 space-y-0">
                {catGroups.map((cg, idx) => {
                  const catKey = `${rideKey}:${cg.key}`;
                  const isCatOpen = openCategories.has(catKey);
                  const catItemsToShow = cg.items.slice(0, maxVisible);

                  return (
                    <div key={cg.key}>
                      {idx > 0 && <div className="border-t border-border/50 my-0.5 ml-1" />}
                      <Collapsible open={isCatOpen} onOpenChange={open => toggleCategory(catKey, open)}>
                        <CollapsibleTrigger className="w-full flex items-center gap-1.5 py-1 px-1.5 hover:bg-muted/20 rounded transition-colors">
                          <ChevronRight className="h-2.5 w-2.5 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90" />
                          <span className="text-xs font-medium uppercase" style={{ color: '#64748B', fontSize: '12px', letterSpacing: '0.08em' }}>{cg.label}</span>
                          <span className="text-[10px] font-medium" style={{ color: '#64748B' }}>{cg.items.length}</span>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="space-y-0.5 mt-0.5 ml-1">
                            {catItemsToShow.map(item => {
                              const doc = findDocForEvent(item.id, item.rideId);
                              return (
                                <CompletedItemRow
                                  key={item.id}
                                  item={item}
                                  doc={doc}
                                  onEdit={() => setEditingEvent(item)}
                                  onViewPdf={doc ? () => handleViewPdf(doc) : undefined}
                                  onDownload={doc ? () => handleDownload(doc) : undefined}
                                  onVersions={doc ? () => handleShowVersions(doc) : undefined}
                                  onArchive={doc && !doc.archived_at ? () => setArchiveDialogDoc(doc) : undefined}
                                  onRestore={doc?.archived_at ? () => handleRestore(doc) : undefined}
                                  onOpenInDocs={item.fullDocumentId ? () => window.open(`/documents?highlight=${item.fullDocumentId}`, '_blank') : undefined}
                                />
                              );
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  );
                })}

                {totalItems > maxVisible && (
                  <button
                    className="w-full text-[11px] text-primary font-medium py-1.5 hover:underline"
                    onClick={() => showMoreForRide(rideKey)}
                  >
                    Show more ({totalItems - maxVisible} remaining)
                  </button>
                )}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {/* Edit Sheet */}
      {editingEvent && (
        <CompletedEventEditSheet
          open={!!editingEvent}
          onOpenChange={open => { if (!open) setEditingEvent(null); }}
          event={editingEvent}
        />
      )}

      {/* Version History Dialog */}
      <Dialog open={!!versionDialogDoc} onOpenChange={() => setVersionDialogDoc(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>{versionDialogDoc?.document_id}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {versions.map(v => (
              <div
                key={v.id}
                className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 ${
                  v.status === 'active' ? 'border-primary/30 bg-primary/5' : 'border-border'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">v{v.version}</span>
                    {v.status === 'active' && <Badge className="text-[10px] bg-primary/15 text-primary border-0">Active</Badge>}
                    {v.status === 'superseded' && <Badge variant="secondary" className="text-[10px]">Superseded</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(parseISO(v.created_at), 'dd MMM yyyy HH:mm')}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleViewPdf(v)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Dialog */}
      <Dialog open={!!archiveDialogDoc} onOpenChange={() => { setArchiveDialogDoc(null); setArchiveReason(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive Document</DialogTitle>
            <DialogDescription>Hidden from default view but not deleted.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">{archiveDialogDoc?.title}</p>
            <Textarea
              placeholder="Reason for archiving (optional)"
              value={archiveReason}
              onChange={e => setArchiveReason(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setArchiveDialogDoc(null); setArchiveReason(''); }}>
              Cancel
            </Button>
            <Button onClick={handleArchive}>Archive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Compact row ──

function CompletedItemRow({
  item,
  doc,
  onEdit,
  onViewPdf,
  onDownload,
  onVersions,
  onArchive,
  onRestore,
  onOpenInDocs,
}: {
  item: CompletedItem;
  doc: RideDocument | null;
  onEdit: () => void;
  onViewPdf?: () => void;
  onDownload?: () => void;
  onVersions?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onOpenInDocs?: () => void;
}) {
  const isArchived = doc?.archived_at;

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border transition-colors ${
      isArchived
        ? 'border-border/40 bg-muted/15 opacity-60'
        : 'border-border/40 bg-background hover:border-primary/20'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-bold text-foreground truncate leading-tight">{item.eventName}</p>
          {doc && (
            <span className="text-[9px] font-mono font-medium bg-muted text-muted-foreground px-1 py-px rounded flex-shrink-0">
              v{doc.version}
            </span>
          )}
          {item.fullDocumentId && (
            <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1 rounded flex-shrink-0">
              {item.fullDocumentId}
            </span>
          )}
          {isArchived && (
            <span className="text-[9px] font-medium text-destructive bg-destructive/10 px-1 rounded flex-shrink-0">
              Archived
            </span>
          )}
        </div>
        <p className="text-[11px] mt-px" style={{ color: '#64748B' }}>
          Completed {item.completedAt ? formatDateUK(item.completedAt) : '–'}
          {item.completedByName && (
            <> · By: {item.completedByName}{item.completedByRole ? ` (${item.completedByRole})` : ''}</>
          )}
        </p>
        {item.certificateReference && (
          <p className="text-[11px] font-mono" style={{ color: '#64748B' }}>
            Ref: {item.certificateReference}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {onViewPdf && (
          <Button variant="outline" size="sm" className="h-9 px-3 gap-1.5 text-xs font-normal" onClick={onViewPdf}>
            <Eye className="h-3.5 w-3.5" />
            View PDF
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Completion
            </DropdownMenuItem>
            {onViewPdf && (
              <DropdownMenuItem onClick={onViewPdf}>
                <Eye className="h-3.5 w-3.5 mr-2" /> View PDF
              </DropdownMenuItem>
            )}
            {onDownload && (
              <DropdownMenuItem onClick={onDownload}>
                <Download className="h-3.5 w-3.5 mr-2" /> Download
              </DropdownMenuItem>
            )}
            {onVersions && (
              <DropdownMenuItem onClick={onVersions}>
                <History className="h-3.5 w-3.5 mr-2" /> View History
              </DropdownMenuItem>
            )}
            {onOpenInDocs && (
              <DropdownMenuItem onClick={onOpenInDocs}>
                <ExternalLink className="h-3.5 w-3.5 mr-2" /> Open in Documents
              </DropdownMenuItem>
            )}
            {(onArchive || onRestore) && <DropdownMenuSeparator />}
            {onArchive && (
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="h-3.5 w-3.5 mr-2" /> Archive
              </DropdownMenuItem>
            )}
            {onRestore && (
              <DropdownMenuItem onClick={onRestore}>
                <RotateCcw className="h-3.5 w-3.5 mr-2" /> Restore
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default CompletedComplianceTab;
