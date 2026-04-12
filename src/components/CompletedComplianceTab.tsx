import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateComplianceQueries } from '@/utils/queryInvalidation';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
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
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search, ChevronRight, CheckCircle, ClipboardCheck, Zap, Wrench,
  FileText, Eye, History, Archive, RotateCcw, MoreVertical, Pencil,
  ChevronsUpDown, ChevronsDownUp, Download, ExternalLink, Loader2,
  CloudOff, RefreshCw,
} from 'lucide-react';
import { formatDateUK } from '@/utils/dateFormat';
import { format, parseISO } from 'date-fns';
import {
  fetchRideDocuments, fetchDocumentVersions, archiveRideDocument,
  restoreRideDocument, RideDocument,
} from '@/utils/rideDocumentService';
import { openDocumentById } from '@/utils/documentOpen';
import CompletedEventEditSheet from '@/components/CompletedEventEditSheet';
import { getAllOfflineComplianceCompletions, offlineDb, type OfflineComplianceCompletion } from '@/lib/offlineDb';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineSync } from '@/hooks/useOfflineSync';

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
  nextDueDate: string | null;
  isDocArchived?: boolean;
  isPendingSync?: boolean;
  syncFailed?: boolean;
  syncError?: string;
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
    .select('id, event_name, event_type, category, ride_id, due_date, completed_at, inspector_company, certificate_reference, completion_notes, evidence_urls, full_document_id, completed_by_name, completed_by_role, next_event_id')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (days > 0) {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    query.gte('completed_at', cutoff);
  }

  // Fetch events, rides, and archived ride_document event IDs in parallel
  const [ridesRes, eventsRes, archivedDocsRes] = await Promise.all([
    supabase.from('rides').select('id, ride_name').eq('user_id', userId),
    query,
    supabase
      .from('ride_documents')
      .select('related_event_id')
      .eq('created_by', userId)
      .or('archived_at.not.is.null,status.neq.active'),
  ]);

  const rideMap = new Map<string, string>();
  ridesRes.data?.forEach(r => rideMap.set(r.id, r.ride_name));

  const rideList = Array.from(rideMap.entries()).map(([id, name]) => ({ id, name }));

  const archivedEventIds = new Set(
    (archivedDocsRes.data || [])
      .map(d => d.related_event_id)
      .filter(Boolean) as string[]
  );

  // Fetch next due dates for recurring events
  const nextEventIds = (eventsRes.data || [])
    .map(e => (e as any).next_event_id)
    .filter(Boolean) as string[];
  
  let nextDueDateMap = new Map<string, string>();
  if (nextEventIds.length > 0) {
    const { data: nextEvents } = await supabase
      .from('compliance_events')
      .select('id, due_date')
      .in('id', nextEventIds);
    (nextEvents || []).forEach(ne => nextDueDateMap.set(ne.id, ne.due_date));
  }

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
    nextDueDate: (e as any).next_event_id ? nextDueDateMap.get((e as any).next_event_id) || null : null,
    isDocArchived: archivedEventIds.has(e.id),
  }));

  return { items, rideList };
}

// ── Component ──

const CompletedComplianceTab = ({ effectiveUserId }: CompletedComplianceTabProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isOnline } = useOnlineStatus();
  const { syncAll } = useOfflineSync();

  // Offline completions
  const [offlineItems, setOfflineItems] = useState<CompletedItem[]>([]);

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

  // Completion record drawer
  const [detailItem, setDetailItem] = useState<CompletedItem | null>(null);
  const [detailDoc, setDetailDoc] = useState<RideDocument | null>(null);

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

  // Load offline completions from IndexedDB
  const refreshOfflineItems = useCallback(async () => {
    const completions = await getAllOfflineComplianceCompletions();
    const pending = completions.filter(c => c.syncStatus !== 'synced');
    setOfflineItems(pending.map(c => ({
      id: c.eventId,
      eventName: c.eventName,
      eventType: c.eventType || '',
      category: c.eventCategory,
      rideName: c.rideName,
      rideId: c.rideId,
      dueDate: c.dueDate,
      completedAt: c.completionDate || c.createdAt,
      inspectorCompany: c.inspectorCompany || null,
      certificateReference: c.certificateReference || null,
      completionNotes: c.notes || null,
      evidenceUrls: [],
      documentId: null,
      fullDocumentId: null,
      completedByName: null,
      completedByRole: null,
      nextDueDate: null,
      isPendingSync: c.syncStatus === 'pending' || c.syncStatus === 'syncing',
      syncFailed: c.syncStatus === 'failed',
      syncError: c.syncError,
    })));
  }, []);

  useEffect(() => {
    refreshOfflineItems();
  }, [refreshOfflineItems]);

  // Re-check offline items when coming back online (sync may have cleared them)
  useEffect(() => {
    if (isOnline) {
      const timer = setTimeout(refreshOfflineItems, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, refreshOfflineItems]);

  const { data, isLoading, refetch } = useOfflineQuery({
    queryKey: ['compliance-completed', effectiveUserId, daysFilter],
    queryFn: () => fetchCompletedEvents(effectiveUserId, daysFilter),
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
    retry: isOnline ? 3 : false,
    offlineCacheKey: `compliance_completed:${effectiveUserId}:${daysFilter}`,
  });

  // Merge server items with offline-pending items (deduplicate by eventId)
  const serverItems = data?.items ?? [];
  const offlineEventIds = new Set(offlineItems.map(i => i.id));
  const allItems = [...offlineItems, ...serverItems.filter(i => !offlineEventIds.has(i.id))];
  const rideList = data?.rideList ?? [];

  // Unified search + exclude archived ride_documents from counts
  const filtered = useMemo(() => {
    return allItems.filter(item => {
      // Exclude items whose ride_document is archived or superseded
      if (item.isDocArchived) return false;
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
    void openDocumentById({
      documentId: doc.id,
      navigate,
      sourceComponent: 'CompletedComplianceTab',
      toast,
    });
  };

  const handleDownload = async (doc: RideDocument) => {
    if (!navigator.onLine) {
      toast({ title: 'Requires connection', description: 'Downloads are unavailable while offline.' });
      return;
    }
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

  const invalidateAll = () => {
    invalidateComplianceQueries(queryClient);
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
      invalidateAll();
    } else {
      toast({ title: 'Failed to archive', variant: 'destructive' });
    }
  };

  const handleRestore = async (doc: RideDocument) => {
    const ok = await restoreRideDocument(doc.id);
    if (ok) {
      toast({ title: 'Document restored' });
      setRideDocsCache(prev => { const n = { ...prev }; delete n[doc.ride_id]; return n; });
      invalidateAll();
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

      {isLoading && offlineItems.length === 0 && (
        <div className="space-y-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Offline banner when we have local items but no server data */}
      {!isOnline && offlineItems.length > 0 && !data && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30 text-sm">
          <CloudOff className="h-4 w-4 text-warning shrink-0" />
          <span className="text-warning text-xs">
            Showing offline data. Full history will load when back online.
          </span>
        </div>
      )}

      {/* Empty state - only when truly empty (no server data AND no offline items) */}
      {(!isLoading || !isOnline) && filtered.length === 0 && (
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
        {(!isLoading || offlineItems.length > 0 || !isOnline) && rideGroups.map(group => {
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
                                  isOnline={isOnline}
                                  onEdit={doc?.archived_at ? undefined : () => setEditingEvent(item)}
                                  onViewPdf={doc ? () => handleViewPdf(doc) : undefined}
                                  onDownload={doc ? () => handleDownload(doc) : undefined}
                                  onVersions={doc ? () => handleShowVersions(doc) : undefined}
                                  onArchive={doc && !doc.archived_at ? () => setArchiveDialogDoc(doc) : undefined}
                                  onRestore={doc?.archived_at ? () => handleRestore(doc) : undefined}
                                  onOpenInDocs={item.fullDocumentId ? () => window.open(`/documents?highlight=${item.fullDocumentId}`, '_blank') : undefined}
                                  onShowDetails={() => setDetailItem(item)}
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

      {/* Local Details Drawer for pending/offline items */}
      <Sheet open={!!detailItem} onOpenChange={open => { if (!open) setDetailItem(null); }}>
        <SheetContent side="bottom" className="max-h-[70vh] rounded-t-2xl">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">{detailItem?.eventName}</SheetTitle>
            <SheetDescription className="sr-only">Completion details</SheetDescription>
          </SheetHeader>
          {detailItem && (
            <div className="space-y-3 px-1 pb-4">
              {(detailItem.isPendingSync || detailItem.syncFailed) && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                  detailItem.syncFailed
                    ? 'bg-destructive/10 border border-destructive/30 text-destructive'
                    : 'bg-warning/10 border border-warning/30 text-warning'
                }`}>
                  <CloudOff className="h-3.5 w-3.5 shrink-0" />
                  {detailItem.syncFailed
                    ? 'Sync failed. Will retry when online.'
                    : 'Pending sync – PDF will be generated when online.'}
                </div>
              )}
              {!detailItem.isPendingSync && !detailItem.syncFailed && !isOnline && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border text-xs text-muted-foreground">
                  <CloudOff className="h-3.5 w-3.5 shrink-0" />
                  PDF not available offline. Connect to download.
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Equipment</p>
                  <p className="font-medium">{detailItem.rideName}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Completed</p>
                  <p className="font-medium">{detailItem.completedAt ? formatDateUK(detailItem.completedAt) : '–'}</p>
                </div>
                {detailItem.certificateReference && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Reference</p>
                    <p className="font-medium font-mono text-xs">{detailItem.certificateReference}</p>
                  </div>
                )}
                {detailItem.inspectorCompany && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Inspector</p>
                    <p className="font-medium">{detailItem.inspectorCompany}</p>
                  </div>
                )}
              </div>
              {detailItem.completionNotes && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-sm bg-muted/50 rounded-md p-2">{detailItem.completionNotes}</p>
                </div>
              )}
              {detailItem.syncFailed && detailItem.syncError && (
                <div>
                  <p className="text-[11px] text-destructive uppercase tracking-wider mb-1">Error</p>
                  <p className="text-xs text-destructive bg-destructive/5 rounded-md p-2">{detailItem.syncError}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

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
  isOnline,
  onEdit,
  onViewPdf,
  onDownload,
  onVersions,
  onArchive,
  onRestore,
  onOpenInDocs,
  onShowDetails,
}: {
  item: CompletedItem;
  doc: RideDocument | null;
  isOnline: boolean;
  onEdit?: () => void;
  onViewPdf?: () => void;
  onDownload?: () => void;
  onVersions?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onOpenInDocs?: () => void;
  onShowDetails: () => void;
}) {
  const isArchived = doc?.archived_at;
  const isPending = item.isPendingSync;
  const isFailed = item.syncFailed;
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCardClick = () => {
    // Always open the read-only detail sheet first
    onShowDetails();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } }}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border ${
        isPending
          ? 'border-warning/40 bg-warning/5'
          : isFailed
            ? 'border-destructive/40 bg-destructive/5'
            : loading
              ? 'border-primary/30 bg-muted/50 pointer-events-none'
              : isArchived
                ? 'border-border/40 bg-muted/15 opacity-60'
                : 'border-border/40 bg-background hover:bg-muted/40 active:bg-muted/60'
      } cursor-pointer`}
    >
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
          {isPending && (
            <Badge variant="secondary" className="text-[9px] bg-warning/15 text-warning border-warning/30 flex-shrink-0 gap-0.5">
              <CloudOff className="h-2.5 w-2.5" /> Pending sync
            </Badge>
          )}
          {isFailed && (
            <Badge variant="destructive" className="text-[9px] flex-shrink-0 gap-0.5">
              <RefreshCw className="h-2.5 w-2.5" /> Sync failed
            </Badge>
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
        {isFailed && item.syncError && (
          <p className="text-[10px] text-destructive mt-0.5 truncate">{item.syncError}</p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {isPending && (
          <span className="text-[10px] text-muted-foreground select-none">Waiting for connection</span>
        )}
        {!isPending && !isFailed && onViewPdf && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 select-none">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
            {loading ? 'Loading…' : 'PDF'}
          </span>
        )}
        {loading && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground sm:hidden" />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit ? (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Completion
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled className="opacity-50">
                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit (Restore first)
              </DropdownMenuItem>
            )}
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
