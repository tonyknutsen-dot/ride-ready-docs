import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, Download, Trash2, Calendar, AlertTriangle, Link2, History, ChevronDown, Globe, Send, Filter, Eye } from 'lucide-react';
import DocumentRowActions from '@/components/documents/DocumentRowActions';
import DocumentRow from '@/components/documents/DocumentRow';
import VersionCleanupDialog from '@/components/documents/VersionCleanupDialog';
import {
  groupDocumentsByName, groupByType, getAllOlderVersions,
  getOlderVersionsStorageSize, CATEGORY_STYLES, type DocumentGroup,
} from '@/components/documents/documentGrouping';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { formatDateUK } from '@/utils/dateFormat';
import { openDocumentById } from '@/utils/documentOpen';
import DocumentRideAssignmentDialog from './DocumentRideAssignmentDialog';
import { SendCheckRecordsDialog } from './SendCheckRecordsDialog';
import { CheckRecordFilters, CheckRecordFiltersState, defaultCheckRecordFilters, isCheckRecord, filterCheckRecords } from './CheckRecordFilters';
import { getSignedStorageUrl } from '@/utils/exportFileActions';
import { canRetryPreview, retryDocumentPreview, previewStatusLabel, PREVIEW_RETRY_FRIENDLY_ERROR } from '@/utils/documentPreview';
import {
  isDocExpired, isDocExpiringSoon, formatFileSize as sharedFormatFileSize,
  getDocTypeLabel, getDocGroupCategory, isImageFile, isPDFFile, isPreviewableFile,
} from '@/utils/documentHelpers';
import { useDocumentTypes } from '@/hooks/useDocumentTypes';

type Document = Tables<'documents'>;

interface DocumentAssignment {
  documentId: string;
  rideNames: string[];
}

interface DocumentListProps {
  rideId?: string;
  rideName?: string;
  isGlobal?: boolean;
  grouped?: boolean;
  showAllDocuments?: boolean;
  excludeGlobal?: boolean; // When true, don't include global docs in ride document lists
  onDocumentDeleted: () => void;
}

const DocumentList = ({ rideId, rideName, isGlobal = false, grouped = false, showAllDocuments = false, excludeGlobal = false, onDocumentDeleted }: DocumentListProps) => {
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { labelMap, categoryMap } = useDocumentTypes();
  // ── Cached document fetch via React Query ─────────────────────────────
  // Cached per scope (ride/global/all) and per user so collapsing and re-opening
  // an equipment folder serves instantly from cache (no refetch within session).
  const queryKey = useMemo(
    () => [
      'documents',
      'list',
      {
        userId: isStaff ? null : effectiveUserId,
        isStaff,
        rideId: rideId ?? null,
        isGlobal: !!isGlobal,
        showAll: !!showAllDocuments,
        excludeGlobal: !!excludeGlobal,
      },
    ],
    [effectiveUserId, isStaff, rideId, isGlobal, showAllDocuments, excludeGlobal],
  );

  const fetchDocuments = useCallback(async (): Promise<Document[]> => {
    let query = supabase
      .from('documents')
      .select('*')
      .neq('document_type', 'maintenance')
      .neq('document_type', 'photo')
      .order('uploaded_at', { ascending: false });

    if (!isStaff) {
      query = query.eq('user_id', effectiveUserId as string);
    }

    if (showAllDocuments) {
      // No additional filter
    } else if (rideId) {
      if (excludeGlobal) {
        query = query.eq('ride_id', rideId);
      } else {
        query = query.or(`ride_id.eq.${rideId},is_global.eq.true`);
      }
    } else if (isGlobal) {
      query = query.eq('is_global', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Document[];
  }, [effectiveUserId, isStaff, rideId, isGlobal, showAllDocuments, excludeGlobal]);

  const {
    data: documents = [] as Document[],
    isLoading: queryLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: fetchDocuments,
    enabled: !!effectiveUserId,
    staleTime: 60_000, // fresh for 60s
    gcTime: 5 * 60_000, // keep in memory 5min
    retry: 1,
  });

  const loading = queryLoading && !!effectiveUserId;
  const loadError = queryError ? ((queryError as Error).message || 'Failed to load documents.') : null;
  // Back-compat shim for handlers that previously called loadDocuments() to refresh.
  const loadDocuments = useCallback(() => { void refetch(); }, [refetch]);

  // Track in-flight "Generate preview" requests per document
  const [previewRetrying, setPreviewRetrying] = useState<Record<string, boolean>>({});
  const handleRetryPreview = useCallback(async (doc: Document) => {
    setPreviewRetrying((m) => ({ ...m, [doc.id]: true }));
    const res = await retryDocumentPreview(doc.id);
    setPreviewRetrying((m) => ({ ...m, [doc.id]: false }));
    if (res.ok && res.status === 'ready') {
      toast({ title: 'Preview ready' });
    } else if (res.status === 'not_required') {
      toast({ title: 'No preview needed' });
    } else {
      toast({ title: 'Preview unavailable', description: PREVIEW_RETRY_FRIENDLY_ERROR, variant: 'destructive' });
    }
    void refetch();
  }, [refetch, toast]);

  // Slow-network hint: after 4s of loading, switch from spinner to a clearer message
  const [showSlowHint, setShowSlowHint] = useState(false);
  useEffect(() => {
    if (!loading) {
      setShowSlowHint(false);
      return;
    }
    setShowSlowHint(false);
    const t = window.setTimeout(() => setShowSlowHint(true), 4000);
    return () => window.clearTimeout(t);
  }, [loading, queryKey]);

  // Auto-poll while any document preview is still being generated.
  // Stops when no rows are 'pending' or after ~90s as a safety cap.
  useEffect(() => {
    const hasPending = documents.some((d: any) => d?.preview_status === 'pending');
    if (!hasPending) return;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      if (Date.now() - startedAt > 90_000) {
        window.clearInterval(interval);
        return;
      }
      void refetch();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [documents, refetch]);

  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [assignmentDialogDoc, setAssignmentDialogDoc] = useState<Document | null>(null);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  
  // Check record filters and send dialog
  const [checkRecordFilters, setCheckRecordFilters] = useState<CheckRecordFiltersState>(defaultCheckRecordFilters);
  const [showCheckRecordFilters, setShowCheckRecordFilters] = useState(false);
  const [sendCheckRecordsOpen, setSendCheckRecordsOpen] = useState(false);
  
  // Pagination for large sections (safety check records)
  const [checkRecordDisplayLimit, setCheckRecordDisplayLimit] = useState(20);
  const CHECK_RECORD_PAGE_SIZE = 20;

  const handleViewDoc = (doc: Document) => {
    void openDocumentById({
      documentId: doc.id,
      navigate,
      sourceComponent: 'DocumentList',
      toast,
    });
  };

  // Use shared file-type detection from documentHelpers.ts
  const isImageDoc = (doc: Document) => isImageFile(doc.file_path || doc.document_name || '');
  const isPDFDoc = (doc: Document) => isPDFFile(doc.file_path || doc.document_name || '');


  // Some legacy Safety Check Record PDFs were saved with US date strings in the document_name,
  // e.g. "Preopening Check - 1/27/2026". We can't change the already-generated PDF content,
  // but we can render a UK-friendly display name in the list (and for download/view titles).
  const normalizeLegacyCheckRecordTitle = (name: string): string => {
    // Find a single US-style date fragment anywhere in the title.
    const m = name.match(/^(.*?)(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/);
    if (!m) return name;

    const prefix = m[1];
    const a = Number(m[2]);
    const b = Number(m[3]);
    const year = Number(m[4]);
    const suffix = m[5];

    // Heuristic:
    // - if the "day" part is > 12, it's definitely MM/DD (US)
    // - if the "month" part is > 12, it's definitely DD/MM (already UK)
    if (b > 12 && a >= 1 && a <= 12) {
      const d = new Date(year, a - 1, b);
      return `${prefix}${formatDateUK(d)}${suffix}`;
    }

    if (a > 12 && b >= 1 && b <= 12) {
      const d = new Date(year, b - 1, a);
      return `${prefix}${formatDateUK(d)}${suffix}`;
    }

    // Ambiguous (e.g. 2/11/2026) – don't guess.
    return name;
  };

  const getDocumentDisplayName = (doc: Document) => {
    const raw = doc.document_name || '';
    const isSafetyCheckRecord = isCheckRecord(doc.document_type, doc.file_path);
    if (!isSafetyCheckRecord) return raw;
    return normalizeLegacyCheckRecordTitle(raw);
  };

  // Load assignments only when needed (global view). Document list itself
  // is loaded by the React Query hook declared above.
  useEffect(() => {
    if (effectiveUserId && isGlobal) {
      loadAssignments();
    }
  }, [effectiveUserId, isGlobal]);

  const loadAssignments = async () => {
    if (!effectiveUserId) return;
    try {
      let query = supabase
        .from('document_ride_assignments')
        .select('document_id, rides(ride_name)');
      
      if (!isStaff) {
        query = query.eq('user_id', effectiveUserId);
      }
      
      const { data, error } = await query;

      if (error) throw error;

      const assignmentMap: Record<string, string[]> = {};
      (data || []).forEach((row: any) => {
        const docId = row.document_id;
        const rideName = row.rides?.ride_name;
        if (rideName) {
          if (!assignmentMap[docId]) assignmentMap[docId] = [];
          assignmentMap[docId].push(rideName);
        }
      });

      setAssignments(assignmentMap);
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
  };

  // Lazy thumbnail generation — runs after documents resolve, never blocks the list.
  useEffect(() => {
    if (!documents || documents.length === 0) {
      setThumbs({});
      return;
    }
    const imageDocs = documents.filter(isImageDoc);
    if (imageDocs.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const next: Record<string, string> = {};
        await Promise.all(
          imageDocs.map(async (doc) => {
            const { data: signedData, error } = await supabase
              .storage
              .from('ride-documents')
              .createSignedUrl(doc.file_path, 3600);
            if (!error && signedData?.signedUrl) {
              next[doc.id] = signedData.signedUrl;
            }
          }),
        );
        if (!cancelled) setThumbs(prev => ({ ...prev, ...next }));
      } catch (e) {
        console.warn('Thumbnail fetch skipped:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [documents]);

  // Surface fetch errors as a toast (once per error).
  useEffect(() => {
    if (loadError) {
      toast({
        title: 'Error loading documents',
        description: loadError,
        variant: 'destructive',
      });
    }
  }, [loadError, toast]);


  const handleCopyLink = async (document: Document) => {
    try {
      const signedUrl = await getSignedStorageUrl(document.file_path);
      if (!signedUrl) throw new Error('No signed URL');
      await navigator.clipboard.writeText(signedUrl);
      toast({ title: 'Link copied', description: 'Signed link valid for 1 hour.' });
    } catch {
      toast({ title: 'Copy link failed', description: 'Could not copy link.', variant: 'destructive' });
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const displayName = getDocumentDisplayName(document);
      const { data, error } = await supabase.storage
        .from('ride-documents')
        .download(document.file_path);

      if (error) {
        throw error;
      }

      // Create download link with proper MIME type
      const blob = new Blob([data], { 
        type: document.mime_type || 'application/octet-stream' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = displayName;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: `Downloading ${displayName}`,
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (document: Document) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('ride-documents')
        .remove([document.file_path]);

      if (storageError) {
        throw storageError;
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (dbError) {
        throw dbError;
      }

      toast({
        title: "Document deleted",
        description: `${document.document_name} has been deleted`,
      });

      onDocumentDeleted();
      loadDocuments();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleGlobal = async (document: Document) => {
    try {
      // Only insurance documents can be toggled to global
      if (document.document_type !== 'insurance') {
        toast({
          title: "Not allowed",
          description: "Only insurance documents can be shared across all equipment.",
          variant: "destructive",
        });
        return;
      }

      const newGlobalStatus = !document.is_global;
      
      const { error } = await supabase
        .from('documents')
        .update({ 
          is_global: newGlobalStatus,
          ride_id: newGlobalStatus ? null : (document.ride_id || rideId)
        })
        .eq('id', document.id);

      if (error) throw error;

      toast({
        title: newGlobalStatus ? "Insurance shared" : "Insurance restricted",
        description: newGlobalStatus 
          ? "This insurance document now applies to all equipment" 
          : "This insurance document is now specific to this equipment only",
      });

      loadDocuments();
    } catch (error: any) {
      console.error('Toggle global error:', error);
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Use shared helpers from documentHelpers.ts (eliminates inline duplicates)
  const isExpiringSoon = isDocExpiringSoon;
  const isExpired = isDocExpired;
  const formatFileSize = sharedFormatFileSize;
  const getDocumentTypeDisplay = (type: string) => getDocTypeLabel(type, labelMap);
  const prettyType = (type: string) => getDocGroupCategory(type, categoryMap);

  // Grouping, versions, and cleanup now use shared extracted modules
  // (groupDocumentsByName, groupByType, getAllOlderVersions, getOlderVersionsStorageSize
  //  are imported from documents/documentGrouping)

  const handleCleanupOldVersions = async () => {
    const olderVersions = getAllOlderVersions(documents);
    if (olderVersions.length === 0) return;

    setCleaningUp(true);
    try {
      const filePaths = olderVersions.map(doc => doc.file_path);
      const { error: storageError } = await supabase.storage
        .from('ride-documents')
        .remove(filePaths);
      if (storageError) throw storageError;

      const docIds = olderVersions.map(doc => doc.id);
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .in('id', docIds);
      if (dbError) throw dbError;

      const freedSpace = formatFileSize(getOlderVersionsStorageSize(documents));
      toast({
        title: "Old versions cleaned up",
        description: `Removed ${olderVersions.length} older version${olderVersions.length !== 1 ? 's' : ''}, freeing ${freedSpace}`,
      });

      setCleanupDialogOpen(false);
      onDocumentDeleted();
      loadDocuments();
    } catch (error: any) {
      console.error('Cleanup error:', error);
      toast({ title: "Cleanup failed", description: error.message, variant: "destructive" });
    } finally {
      setCleaningUp(false);
    }
  };

  if (loading) {
    // Compact row-level skeleton — sits inside the equipment folder, not over the whole page.
    return (
      <div className="py-2 px-1 space-y-1.5" aria-busy="true" aria-live="polite">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-3 rounded-md border border-border/40 bg-muted/30 animate-pulse"
          >
            <div className="w-9 h-9 rounded-lg bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-2/3 rounded bg-muted" />
              <div className="h-2.5 w-1/3 rounded bg-muted/80" />
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground text-center pt-1.5">
          {showSlowHint ? 'Still loading documents…' : 'Loading documents…'}
        </p>
        {showSlowHint && (
          <div className="text-center">
            <Button size="sm" variant="ghost" onClick={() => loadDocuments()} className="h-7 text-xs">
              Retry
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="py-6">
        <div className="text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 mx-auto flex items-center justify-center mb-3">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h3 className="text-base font-semibold mt-2">Couldn't load documents</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-3">{loadError}</p>
          <Button size="sm" variant="outline" onClick={() => loadDocuments()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="py-12">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-info/20 mx-auto flex items-center justify-center mb-4">
            <FileText className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mt-4">No files yet</h3>
          <p className="text-muted-foreground">
            Press Add a document to upload files{rideName ? ` for ${rideName}` : ''}
          </p>
        </div>
      </div>
    );
  }

  // DocumentRow now uses the extracted component from documents/DocumentRow.tsx
  const renderDocRow = (doc: Document, isOlderVersion = false, hasMultipleVersions = false) => (
    <DocumentRow
      key={doc.id}
      doc={doc}
      isOlderVersion={isOlderVersion}
      hasMultipleVersions={hasMultipleVersions}
      thumbUrl={thumbs[doc.id]}
      rideName={rideName}
      rideId={rideId}
      isStaff={isStaff}
      getDocumentDisplayName={getDocumentDisplayName}
      onView={handleViewDoc}
      onDownload={handleDownload}
      onCopyLink={handleCopyLink}
      onDelete={!isOlderVersion ? handleDelete : undefined}
      onToggleGlobal={!isStaff && doc.document_type === 'insurance' ? handleToggleGlobal : undefined}
    />
  );

  if (grouped) {
    const groupedDocs = groupByType(documents, isGlobal, categoryMap);
    const olderVersionsCount = getAllOlderVersions(documents).length;
    const olderVersionsSize = getOlderVersionsStorageSize(documents);
    
    return (
      <>
        
        {/* Send Check Records Dialog */}
        <SendCheckRecordsDialog
          isOpen={sendCheckRecordsOpen}
          onClose={() => setSendCheckRecordsOpen(false)}
          rideId={rideId}
          rideName={rideName}
        />
        
        <VersionCleanupDialog
          open={cleanupDialogOpen}
          onOpenChange={setCleanupDialogOpen}
          olderVersionsCount={olderVersionsCount}
          olderVersionsSize={olderVersionsSize}
          cleaningUp={cleaningUp}
          onCleanup={handleCleanupOldVersions}
        />
        
        <div className="space-y-6 pb-24 md:pb-0">
        {/* Cleanup button - only show if there are old versions */}
        {olderVersionsCount > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border/60">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <History className="h-4 w-4" />
              <span>{olderVersionsCount} older version{olderVersionsCount !== 1 ? 's' : ''} ({formatFileSize(olderVersionsSize)})</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCleanupDialogOpen(true)}
              className="gap-1.5 text-xs h-8"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clean up
            </Button>
          </div>
        )}
        {groupedDocs.map((g, groupIdx) => {
          // Use consistent color for all document type groups
          const isGlobalSection = g.type === "🛡️ Shared Insurance";
          const isCheckRecordSection = g.type === "✅ Safety Check Records";
          
          // Apply filters to check record sections
          let displayItems = g.items;
          if (isCheckRecordSection && (checkRecordFilters.dateFrom || checkRecordFilters.dateTo || checkRecordFilters.checkType !== 'all' || checkRecordFilters.searchQuery)) {
            // Flatten, filter, then re-group
            const allDocs = g.items.flatMap(docGroup => [docGroup.latestDoc, ...docGroup.olderVersions]);
            const filteredDocs = filterCheckRecords(allDocs, checkRecordFilters);
            displayItems = groupDocumentsByName(filteredDocs);
          }
          
          // Count total documents including versions (for original or filtered)
          const totalDocs = displayItems.reduce((sum, docGroup) => sum + 1 + docGroup.olderVersions.length, 0);
          const originalTotal = g.items.reduce((sum, docGroup) => sum + 1 + docGroup.olderVersions.length, 0);
          const isFiltered = isCheckRecordSection && totalDocs !== originalTotal;
          
          const catStyle = CATEGORY_STYLES[g.type] || CATEGORY_STYLES["📁 Other"];
          return (
            <section key={g.type} className="space-y-0">
              {/* Category card */}
              <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden`}>
                {/* Category header */}
                <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-100`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 ${catStyle.iconBg} rounded-lg flex items-center justify-center shrink-0 border ${catStyle.borderColor}`}>
                      <FileText className={`w-5 h-5 ${catStyle.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-slate-900 font-semibold text-sm">{g.type}</h3>
                      <p className="text-xs text-slate-500">{isFiltered ? `${totalDocs} of ${originalTotal}` : `${totalDocs} file${totalDocs !== 1 ? 's' : ''}`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isCheckRecordSection && originalTotal >= 5 && (
                      <>
                        <button
                          className="text-slate-500 text-xs font-medium hover:text-slate-900 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100"
                          onClick={() => setShowCheckRecordFilters(!showCheckRecordFilters)}
                        >
                          <Filter className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Filter</span>
                        </button>
                        <button
                          className="text-slate-500 text-xs font-medium hover:text-slate-900 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100"
                          onClick={() => setSendCheckRecordsOpen(true)}
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Send</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Check record filters (inside card) */}
                {isCheckRecordSection && showCheckRecordFilters && (
                  <div className="px-4 py-3 border-b border-slate-100">
                    <CheckRecordFilters
                      filters={checkRecordFilters}
                      onFiltersChange={(newFilters) => {
                        setCheckRecordFilters(newFilters);
                        setCheckRecordDisplayLimit(CHECK_RECORD_PAGE_SIZE);
                      }}
                      onClear={() => {
                        setCheckRecordFilters(defaultCheckRecordFilters);
                        setCheckRecordDisplayLimit(CHECK_RECORD_PAGE_SIZE);
                      }}
                      documentCount={originalTotal}
                      filteredCount={totalDocs}
                    />
                  </div>
                )}

                {/* File rows */}
                {displayItems.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    No records match your filters
                  </div>
                ) : (
                  <>
                    {(() => {
                      const itemsToShow = isCheckRecordSection
                        ? displayItems.slice(0, checkRecordDisplayLimit)
                        : displayItems;
                      const hasMore = isCheckRecordSection && displayItems.length > checkRecordDisplayLimit;
                      const remainingCount = displayItems.length - checkRecordDisplayLimit;

                      return (
                        <>
                          <div className="divide-y divide-slate-100">
                            {itemsToShow.map(docGroup => (
                              <div key={docGroup.latestDoc.id}>
                                {renderDocRow(docGroup.latestDoc, false, docGroup.olderVersions.length > 0)}
                                {docGroup.olderVersions.length > 0 && (
                                  <Collapsible>
                                    <CollapsibleTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start gap-2 h-8 text-xs text-slate-500 hover:text-slate-900 ml-14 pl-0"
                                      >
                                        <History className="h-3.5 w-3.5" />
                                        <span>{docGroup.olderVersions.length} older version{docGroup.olderVersions.length !== 1 ? 's' : ''}</span>
                                        <ChevronDown className="h-3.5 w-3.5 ml-auto transition-transform group-data-[state=open]:rotate-180" />
                                      </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="border-l-2 border-slate-100 ml-14">
                                      {docGroup.olderVersions.map(olderDoc =>
                                        renderDocRow(olderDoc, true)
                                      )}
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}
                              </div>
                            ))}
                          </div>

                          {hasMore && (
                            <div className="flex justify-center py-4 border-t border-slate-100">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCheckRecordDisplayLimit(prev => prev + CHECK_RECORD_PAGE_SIZE)}
                                className="gap-2 text-slate-700"
                              >
                                <ChevronDown className="h-4 w-4" />
                                Load {Math.min(remainingCount, CHECK_RECORD_PAGE_SIZE)} more
                                <span className="text-slate-400">({remainingCount} remaining)</span>
                              </Button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </div>{/* end card */}
            </section>
          );
        })}
        </div>

    </>
  );
  }

  // Flat list (default)
  return (
    <>
      <DocumentRideAssignmentDialog
        document={assignmentDialogDoc}
        isOpen={!!assignmentDialogDoc}
        onClose={() => setAssignmentDialogDoc(null)}
        onAssignmentsChanged={loadAssignments}
      />
      <div className="space-y-4 pb-24 md:pb-0">
        <Card className="border-2 border-primary/20 shadow-card">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-info/5 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>
                {isGlobal ? 'Global Documents' : 'Ride Documents'} ({documents.length})
              </CardTitle>
              <CardDescription>
                {isGlobal 
                  ? 'Documents that apply to all your rides'
                  : 'Documents specific to this ride'
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            {documents.map((doc) => (
              <div 
                key={doc.id} 
                className="flex flex-col gap-2 p-3 border-2 border-border/60 rounded-xl hover:border-primary/30 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent active:scale-[0.99] transition-all min-w-0 bg-card"
              >
                {/* Row 1: Thumbnail + Name + Type badge */}
                <div className="flex items-start gap-3 min-w-0">
                  {/* Thumbnail */}
                  <div 
                    className="shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-info/10 border border-primary/20 flex items-center justify-center"
                  >
                    {thumbs[doc.id] ? (
                      <img
                        src={thumbs[doc.id]}
                        alt={doc.document_name}
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                    ) : (
                      <FileText className="h-5 w-5 text-primary" />
                    )}
                  </div>

                  {/* Content - takes remaining space */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <h4 className="text-sm font-medium break-words line-clamp-2" title={doc.document_name}>
                      {doc.document_name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-muted-foreground">
                      <span>{getDocumentTypeDisplay(doc.document_type)}</span>
                      <span className="opacity-50">•</span>
                      <span>{formatFileSize(doc.file_size || 0)}</span>
                      {doc.expires_at && (
                        <>
                          <span className="opacity-50">•</span>
                          <span className={`flex items-center gap-0.5 ${
                            isExpired(doc.expires_at) ? 'text-destructive' :
                            isExpiringSoon(doc.expires_at) ? 'text-yellow-600' :
                            ''
                          }`}>
                            {isExpired(doc.expires_at) && <AlertTriangle className="h-3 w-3" />}
                            {new Date(doc.expires_at).toLocaleDateString('en-GB')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: Actions — canonical pattern */}
                <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40">
                  <DocumentRowActions
                    previewable={isPreviewableFile(doc.file_path, doc.mime_type) || (doc.preview_status === 'ready' && !!doc.preview_file_path)}
                    onView={() => handleViewDoc(doc)}
                    onDownload={() => handleDownload(doc)}
                    onCopyLink={() => handleCopyLink(doc)}
                    onDelete={() => handleDelete(doc)}
                    onRetryPreview={canRetryPreview({
                      upload_status: doc.upload_status,
                      preview_status: doc.preview_status as any,
                      file_path: doc.file_path,
                      original_filename: doc.original_filename,
                    }) ? () => handleRetryPreview(doc) : undefined}
                    previewRetryState={previewRetrying[doc.id] || doc.preview_status === 'pending' ? 'pending' : 'idle'}
                  />
                </div>
                
                {/* Show assigned items for global documents */}
                {isGlobal && assignments[doc.id] && assignments[doc.id].length > 0 && (
                  <div className="flex items-center gap-2 pl-15 ml-12">
                    <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[11px] text-muted-foreground">
                      Covers: {assignments[doc.id].slice(0, 3).join(', ')}
                      {assignments[doc.id].length > 3 && ` +${assignments[doc.id].length - 3} more`}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
    </>
  );
};

export default DocumentList;