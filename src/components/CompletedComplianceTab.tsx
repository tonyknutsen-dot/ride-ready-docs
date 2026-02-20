import { useState, useMemo, useCallback } from 'react';
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
  ChevronsUpDown, ChevronsDownUp, MapPin,
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
  { key: 'inspection', label: 'Inspections', icon: ClipboardCheck },
  { key: 'ndt', label: 'NDT', icon: Zap },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench },
  { key: 'doc_expiry', label: 'Document Expiry', icon: FileText },
];

const PAGE_SIZE = 25;

// ── Data fetch ──

async function fetchCompletedEvents(userId: string, days: DaysFilter) {
  const query = supabase
    .from('compliance_events')
    .select('id, event_name, event_type, category, ride_id, due_date, completed_at, inspector_company, certificate_reference, completion_notes, evidence_urls, full_document_id')
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
  }));

  return { items, rideList };
}

// ── Component ──

const CompletedComplianceTab = ({ effectiveUserId }: CompletedComplianceTabProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Filters
  const [daysFilter, setDaysFilter] = useState<DaysFilter>(30);
  const [searchQuery, setSearchQuery] = useState('');
  const [rideSearchQuery, setRideSearchQuery] = useState('');
  const [rideFilter, setRideFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  // Pagination per ride group
  const [ridePageMap, setRidePageMap] = useState<Record<string, number>>({});

  // Expand/collapse state: ride keys and category keys (rideKey:catKey)
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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['compliance-completed', effectiveUserId, daysFilter],
    queryFn: () => fetchCompletedEvents(effectiveUserId, daysFilter),
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
  });

  const allItems = data?.items ?? [];
  const rideList = data?.rideList ?? [];

  // Apply filters
  const filtered = useMemo(() => {
    return allItems.filter(item => {
      if (rideFilter !== 'all' && item.rideId !== rideFilter) return false;
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
  }, [allItems, rideFilter, categoryFilter, searchQuery]);

  // Group: Ride → Category → items
  const rideGroups = useMemo(() => {
    const groups = new Map<string, {
      rideName: string;
      rideId: string | null;
      items: CompletedItem[];
      count: number;
    }>();

    filtered.forEach(item => {
      const key = item.rideId || 'global';
      if (!groups.has(key)) {
        groups.set(key, { rideName: item.rideName, rideId: item.rideId, items: [], count: 0 });
      }
      const g = groups.get(key)!;
      g.items.push(item);
      g.count++;
    });

    return Array.from(groups.values()).sort((a, b) => {
      const aLast = a.items[0]?.completedAt || '';
      const bLast = b.items[0]?.completedAt || '';
      return bLast.localeCompare(aLast);
    });
  }, [filtered]);

  // Apply ride search filter (separate from global search)
  const visibleRideGroups = useMemo(() => {
    if (!rideSearchQuery) return rideGroups;
    const q = rideSearchQuery.toLowerCase();
    return rideGroups.filter(g => g.rideName.toLowerCase().includes(q));
  }, [rideGroups, rideSearchQuery]);

  // Expand/collapse all helpers
  const expandAll = useCallback(() => {
    const rideKeys = new Set(visibleRideGroups.map(g => g.rideId || 'global'));
    setOpenRides(rideKeys);
    const catKeys = new Set<string>();
    visibleRideGroups.forEach(g => {
      const rideKey = g.rideId || 'global';
      CATEGORY_CONFIG.forEach(cat => {
        if (g.items.some(i => i.category === cat.key)) {
          catKeys.add(`${rideKey}:${cat.key}`);
        }
      });
      // Load docs for all rides being expanded
      if (g.rideId) loadRideDocs(g.rideId);
    });
    setOpenCategories(catKeys);
  }, [visibleRideGroups]);

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
  };

  // Find CR doc for a given event
  const findDocForEvent = (eventId: string, rideId: string | null): RideDocument | null => {
    if (!rideId) return null;
    const docs = rideDocsCache[rideId] || [];
    return docs.find(d => d.related_event_id === eventId && d.status === 'active') || null;
  };

  const handleViewPdf = async (doc: RideDocument) => {
    const { data, error } = await supabase.storage
      .from('ride-documents')
      .createSignedUrl(doc.file_url, 3600);
    if (error || !data?.signedUrl) {
      toast({ title: 'Could not open document', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank');
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
      // Clear cache for that ride
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
    <div className="space-y-3">
      {/* Filters row */}
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[140px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search ride, event, reference…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v as CategoryFilter)}>
          <SelectTrigger className="w-[120px] h-9 text-sm">
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
        {rideList.length > 1 && (
          <Select value={rideFilter} onValueChange={setRideFilter}>
            <SelectTrigger className="w-[120px] h-9 text-sm">
              <SelectValue placeholder="All Rides" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rides</SelectItem>
              {rideList.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Date range pills */}
      <div className="flex gap-1">
        {DAYS_OPTIONS.map(opt => (
          <Button
            key={opt.value}
            size="sm"
            variant={daysFilter === opt.value ? 'default' : 'outline'}
            className="h-8 text-xs px-3"
            onClick={() => { setDaysFilter(opt.value); setRidePageMap({}); }}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Ride search + Expand/Collapse controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[120px] relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search rides…"
            value={rideSearchQuery}
            onChange={e => setRideSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={expandAll}
        >
          <ChevronsUpDown className="h-3.5 w-3.5" /> Expand all
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={collapseAll}
        >
          <ChevronsDownUp className="h-3.5 w-3.5" /> Collapse all
        </Button>
      </div>
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-2">
          <CheckCircle className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">
            No completed items in this period
          </p>
          <p className="text-xs text-muted-foreground">
            {searchQuery
              ? 'No results match your search'
              : `Nothing completed ${daysFilter > 0 ? `in the last ${daysFilter === 365 ? '12 months' : daysFilter + ' days'}` : ''}`}
          </p>
          {daysFilter > 0 && daysFilter < 90 && (
            <Button
              variant="link"
              size="sm"
              className="text-xs"
              onClick={() => setDaysFilter(90)}
            >
              Expand to 90 days
            </Button>
          )}
          {daysFilter === 90 && (
            <Button
              variant="link"
              size="sm"
              className="text-xs"
              onClick={() => setDaysFilter(0)}
            >
              Show all time
            </Button>
          )}
        </div>
      )}

      {/* No rides match ride search */}
      {!isLoading && filtered.length > 0 && visibleRideGroups.length === 0 && rideSearchQuery && (
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-sm text-muted-foreground">No rides matching "{rideSearchQuery}"</p>
        </div>
      )}

      {/* Ride groups */}
      {!isLoading && visibleRideGroups.map(group => {
        const rideKey = group.rideId || 'global';
        const currentPage = ridePageMap[rideKey] || 1;
        const isRideOpen = openRides.has(rideKey);

        // Group items by category
        const catGroups = CATEGORY_CONFIG.map(cat => ({
          ...cat,
          items: group.items.filter(i => i.category === cat.key),
        })).filter(cg => cg.items.length > 0);

        // Total visible items for pagination
        const totalItems = group.items.length;
        const maxVisible = currentPage * PAGE_SIZE;

        return (
          <Collapsible
            key={rideKey}
            open={isRideOpen}
            onOpenChange={open => toggleRide(rideKey, open, group.rideId)}
          >
            <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors text-left">
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90 shrink-0" />
              <h3 className="text-sm font-bold text-foreground truncate">{group.rideName}</h3>
              <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                {group.count} completed
              </Badge>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-1 ml-2 space-y-2">
              {catGroups.map(cg => {
                const CatIcon = cg.icon;
                const catKey = `${rideKey}:${cg.key}`;
                const isCatOpen = openCategories.has(catKey);
                const catItemsToShow = cg.items.slice(0, maxVisible);

                return (
                  <Collapsible key={cg.key} open={isCatOpen} onOpenChange={open => toggleCategory(catKey, open)}>
                    <CollapsibleTrigger className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-muted/20 rounded-lg transition-colors">
                      <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90" />
                      <CatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">{cg.label}</span>
                      <Badge variant="outline" className="text-[9px] h-4">{cg.items.length}</Badge>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-1 mt-1 ml-1">
                        {catItemsToShow.map(item => {
                          const doc = findDocForEvent(item.id, item.rideId);
                          return (
                            <CompletedItemRow
                              key={item.id}
                              item={item}
                              doc={doc}
                              onEdit={() => setEditingEvent(item)}
                              onViewPdf={doc ? () => handleViewPdf(doc) : undefined}
                              onVersions={doc ? () => handleShowVersions(doc) : undefined}
                              onArchive={doc && !doc.archived_at ? () => setArchiveDialogDoc(doc) : undefined}
                              onRestore={doc?.archived_at ? () => handleRestore(doc) : undefined}
                            />
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}

              {/* Pagination within ride group */}
              {totalItems > maxVisible && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-primary"
                  onClick={() => showMoreForRide(rideKey)}
                >
                  Show more ({totalItems - maxVisible} remaining)
                </Button>
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}

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
                className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                  v.status === 'active' ? 'border-primary/30 bg-primary/5' : 'border-border'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">v{v.version}</span>
                    {v.status === 'active' && <Badge variant="default" className="text-[10px]">Active</Badge>}
                    {v.status === 'superseded' && <Badge variant="secondary" className="text-[10px]">Superseded</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(parseISO(v.created_at), 'dd MMM yyyy HH:mm')}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleViewPdf(v)}>
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

// ── Compact row for each completed item ──

function CompletedItemRow({
  item,
  doc,
  onEdit,
  onViewPdf,
  onVersions,
  onArchive,
  onRestore,
}: {
  item: CompletedItem;
  doc: RideDocument | null;
  onEdit: () => void;
  onViewPdf?: () => void;
  onVersions?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
}) {
  const isArchived = doc?.archived_at;

  return (
    <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors ${
      isArchived
        ? 'border-border/50 bg-muted/20 opacity-70'
        : 'border-border/50 bg-background hover:border-primary/30'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{item.eventName}</p>
          {item.fullDocumentId && (
            <Badge variant="outline" className="text-[9px] font-mono flex-shrink-0 h-4">
              {item.fullDocumentId}
            </Badge>
          )}
          {isArchived && (
            <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive flex-shrink-0 h-4">
              Archived
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {item.dueDate && (
            <span className="text-[10px] text-muted-foreground">
              Due {formatDateUK(item.dueDate)}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/50">→</span>
          <span className="text-[10px] text-muted-foreground">
            {item.completedAt ? formatDateUK(item.completedAt) : '–'}
          </span>
          {item.certificateReference && (
            <>
              <span className="text-[10px] text-muted-foreground/50">·</span>
              <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[100px]">
                {item.certificateReference}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* View PDF quick action */}
        {onViewPdf && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onViewPdf} title="View PDF">
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* More actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
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
            {onVersions && (
              <DropdownMenuItem onClick={onVersions}>
                <History className="h-3.5 w-3.5 mr-2" /> Version History
              </DropdownMenuItem>
            )}
            {(onArchive || onRestore) && <DropdownMenuSeparator />}
            {onArchive && (
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="h-3.5 w-3.5 mr-2" /> Archive Document
              </DropdownMenuItem>
            )}
            {onRestore && (
              <DropdownMenuItem onClick={onRestore}>
                <RotateCcw className="h-3.5 w-3.5 mr-2" /> Restore Document
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default CompletedComplianceTab;
