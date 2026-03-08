import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCachedPdf, cachePdf, createCachedPdfUrl, fetchPdfBlob } from '@/lib/pdfCache';
import { useAuth } from '@/contexts/AuthContext';
import PdfCanvasViewer from '@/components/PdfCanvasViewer';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Download, History, Archive, RotateCcw,
  FileText, Calendar, Building2, Hash, Clock, Loader2,
  MapPin, Eye, CheckCircle2, AlertTriangle, WifiOff, HardDrive,
  Image as ImageIcon, File,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatDateUK } from '@/utils/dateFormat';
import {
  fetchDocumentVersions, archiveRideDocument,
  restoreRideDocument, RideDocument, RIDE_DOC_TYPE_LABELS,
} from '@/utils/rideDocumentService';

interface DocumentMeta {
  rideName: string;
  rideId: string | null;
  category: string;
  dueDate: string | null;
  completedAt: string | null;
  inspector: string | null;
  certificateRef: string | null;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
  updatedBy: string | null;
  documentType: string;
  status: string;
  isArchived: boolean;
  evidenceCount: number;
}

const DocumentViewerPage = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfSource, setPdfSource] = useState<'network' | 'cache' | null>(null);
  const [isCachedLocally, setIsCachedLocally] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docDisplayId, setDocDisplayId] = useState('');
  const [meta, setMeta] = useState<DocumentMeta | null>(null);
  const [fileType, setFileType] = useState<'pdf' | 'image' | 'other'>('pdf');

  // Underlying document data
  const [rideDoc, setRideDoc] = useState<RideDocument | null>(null);
  const [fallbackDocId, setFallbackDocId] = useState<string | null>(null);

  // Version control state
  const [allVersions, setAllVersions] = useState<RideDocument[]>([]);
  const [latestVersion, setLatestVersion] = useState<RideDocument | null>(null);
  const [isViewingOldVersion, setIsViewingOldVersion] = useState(false);

  // Dialogs
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');

  useEffect(() => {
    if (!documentId || !user) return;
    loadDocument(documentId);
  }, [documentId, user]);

  // Check if this document is already cached locally
  useEffect(() => {
    if (!documentId) return;
    getCachedPdf(documentId).then(cached => {
      setIsCachedLocally(!!cached);
    });
  }, [documentId, pdfSource]);

  const handleSaveOffline = useCallback(async () => {
    if (!rideDoc || !navigator.onLine) return;
    setSavingOffline(true);
    try {
      const signedUrl = await getSignedUrl(rideDoc.file_url);
      if (!signedUrl) throw new Error('Failed to get URL');
      const blob = await fetchPdfBlob(signedUrl);
      if (!blob) throw new Error('Failed to download');
      await cachePdf(rideDoc.document_id, rideDoc.version, rideDoc.file_url, blob, rideDoc.title);
      setIsCachedLocally(true);
      toast({ title: 'Saved for offline', description: 'This document is now available offline.' });
    } catch (err) {
      toast({ title: 'Failed to save offline', variant: 'destructive' });
    } finally {
      setSavingOffline(false);
    }
  }, [rideDoc, toast]);

  const loadDocument = async (id: string) => {
    setLoading(true);
    setIsViewingOldVersion(false);
    try {
      // Try ride_documents first
      const { data: rdDoc } = await supabase
        .from('ride_documents')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (rdDoc) {
        const rd = rdDoc as RideDocument;
        // Fetch all versions for this document_id
        const versions = await fetchDocumentVersions(rd.document_id);
        setAllVersions(versions);
        const latest = versions.find(v => v.status === 'active') || versions[0];
        setLatestVersion(latest || null);

        // Always load the latest active version by default
        if (latest && latest.id !== rd.id) {
          await loadFromRideDocument(latest, false);
        } else {
          await loadFromRideDocument(rd, false);
        }
        return;
      }

      // Fallback: try documents table
      const { data: doc } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (doc) {
        await loadFromDocumentsTable(doc);
        return;
      }

      toast({ title: 'Document not found', variant: 'destructive' });
      navigate(-1);
    } catch (err) {
      console.error('Error loading document:', err);
      toast({ title: 'Failed to load document', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  /** Switch to viewing a specific version in-page (no navigation) */
  const switchToVersion = async (v: RideDocument) => {
    setLoading(true);
    try {
      const isOld = latestVersion ? v.id !== latestVersion.id : false;
      setIsViewingOldVersion(isOld);
      await loadFromRideDocument(v, isOld);
    } finally {
      setLoading(false);
      setVersionDialogOpen(false);
    }
  };

  const returnToLatest = async () => {
    if (!latestVersion) return;
    setLoading(true);
    try {
      setIsViewingOldVersion(false);
      await loadFromRideDocument(latestVersion, false);
    } finally {
      setLoading(false);
    }
  };

  const loadFromRideDocument = async (rd: RideDocument, isOld: boolean) => {
    setRideDoc(rd);
    setDocTitle(rd.title);
    setDocDisplayId(rd.document_id);

    // ── Cache-first PDF loading ──
    const cached = await getCachedPdf(rd.document_id);
    const isOnline = navigator.onLine;

    if (cached && cached.version === rd.version) {
      // Cache hit — version matches, serve locally
      setPdfUrl(createCachedPdfUrl(cached));
      setPdfSource('cache');
    } else if (isOnline) {
      // Online: fetch fresh, cache it
      const signedUrl = await getSignedUrl(rd.file_url);
      if (signedUrl) {
        setPdfUrl(signedUrl);
        setPdfSource('network');
        // Cache in background
        fetchPdfBlob(signedUrl).then(blob => {
          if (blob) cachePdf(rd.document_id, rd.version, rd.file_url, blob, rd.title);
        });
      } else {
        // Signed URL failed but we may have a stale cache
        if (cached) {
          setPdfUrl(createCachedPdfUrl(cached));
          setPdfSource('cache');
        } else {
          setPdfUrl(null);
        }
      }
    } else if (cached) {
      // Offline with stale cache — serve what we have
      setPdfUrl(createCachedPdfUrl(cached));
      setPdfSource('cache');
    } else {
      // Offline, no cache
      setPdfUrl(null);
      setPdfSource(null);
    }

    const rideName = await getRideName(rd.ride_id);

    let eventMeta: Partial<DocumentMeta> = {};
    if (rd.related_event_id) {
      const { data: evt } = await supabase
        .from('compliance_events')
        .select('category, due_date, completed_at, inspector_company, certificate_reference, evidence_urls')
        .eq('id', rd.related_event_id)
        .maybeSingle();

      if (evt) {
        eventMeta = {
          category: evt.category || rd.document_type,
          dueDate: evt.due_date,
          completedAt: evt.completed_at,
          inspector: evt.inspector_company,
          certificateRef: evt.certificate_reference,
          evidenceCount: (evt.evidence_urls as string[] || []).length,
        };
      }
    }

    setMeta({
      rideName,
      rideId: rd.ride_id,
      category: eventMeta.category || rd.document_type,
      dueDate: eventMeta.dueDate || null,
      completedAt: eventMeta.completedAt || null,
      inspector: eventMeta.inspector || (rd.metadata as any)?.inspectorCompany || null,
      certificateRef: eventMeta.certificateRef || (rd.metadata as any)?.certificateReference || null,
      version: rd.version,
      createdBy: rd.created_by,
      createdAt: rd.created_at,
      updatedAt: rd.updated_at || null,
      updatedBy: rd.updated_by || null,
      documentType: RIDE_DOC_TYPE_LABELS[rd.document_type as keyof typeof RIDE_DOC_TYPE_LABELS] || rd.document_type,
      status: rd.status,
      isArchived: !!rd.archived_at,
      evidenceCount: eventMeta.evidenceCount || 0,
    });
  };

  const detectFileType = (filePath: string): 'pdf' | 'image' | 'other' => {
    const fp = filePath.toLowerCase();
    if (/\.pdf$/i.test(fp)) return 'pdf';
    if (/\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(fp)) return 'image';
    return 'other';
  };

  const loadFromDocumentsTable = async (doc: any) => {
    setFallbackDocId(doc.id);
    setAllVersions([]);
    setLatestVersion(null);
    setDocTitle(doc.document_name);

    const ft = detectFileType(doc.file_path || '');
    setFileType(ft);

    const rideName = doc.ride_id ? await getRideName(doc.ride_id) : 'Global';

    const notes = doc.notes || '';
    const eventIdMatch = notes.match(/Event ID: ([a-f0-9-]+)/);
    let eventMeta: Partial<DocumentMeta> = {};

    if (eventIdMatch) {
      const { data: evt } = await supabase
        .from('compliance_events')
        .select('category, due_date, completed_at, inspector_company, certificate_reference, evidence_urls')
        .eq('id', eventIdMatch[1])
        .maybeSingle();

      if (evt) {
        eventMeta = {
          category: evt.category,
          dueDate: evt.due_date,
          completedAt: evt.completed_at,
          inspector: evt.inspector_company,
          certificateRef: evt.certificate_reference,
          evidenceCount: (evt.evidence_urls as string[] || []).length,
        };
      }
    }

    const inspectorMatch = notes.match(/Inspector: (.+)/);
    const refMatch = notes.match(/Ref: (.+)/);

    setMeta({
      rideName,
      rideId: doc.ride_id,
      category: eventMeta.category || doc.document_type,
      dueDate: eventMeta.dueDate || null,
      completedAt: eventMeta.completedAt || doc.uploaded_at,
      inspector: eventMeta.inspector || inspectorMatch?.[1] || null,
      certificateRef: eventMeta.certificateRef || refMatch?.[1] || null,
      version: parseInt(doc.version_number || '1', 10),
      createdBy: doc.user_id,
      createdAt: doc.uploaded_at,
      updatedAt: null,
      updatedBy: null,
      documentType: doc.document_type,
      status: 'active',
      isArchived: false,
      evidenceCount: eventMeta.evidenceCount || 0,
    });
  };

  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('ride-documents')
      .createSignedUrl(filePath, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  };

  const getRideName = async (rideId: string): Promise<string> => {
    const { data } = await supabase
      .from('rides')
      .select('ride_name')
      .eq('id', rideId)
      .maybeSingle();
    return data?.ride_name || 'Unknown';
  };

  const handleDownload = async () => {
    if (!navigator.onLine) {
      toast({ title: 'Requires connection', description: 'Downloads are unavailable while offline.' });
      return;
    }
    const filePath = rideDoc?.file_url;
    if (!filePath && !fallbackDocId) return;

    let url: string | null = null;
    if (filePath) {
      url = await getSignedUrl(filePath);
    } else if (fallbackDocId) {
      const { data } = await supabase
        .from('documents')
        .select('file_path')
        .eq('id', fallbackDocId)
        .maybeSingle();
      if (data) url = await getSignedUrl(data.file_path);
    }

    if (!url) {
      toast({ title: 'Download failed', variant: 'destructive' });
      return;
    }

    try {
      // Fetch as blob to avoid Chrome blocking cross-origin navigations
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = docTitle || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  const handleArchive = async () => {
    if (!rideDoc || !user) return;
    const ok = await archiveRideDocument(rideDoc.id, user.id, archiveReason);
    if (ok) {
      toast({ title: 'Document archived' });
      setArchiveDialogOpen(false);
      setArchiveReason('');
      invalidateComplianceQueries();
      navigate(-1);
    } else {
      toast({ title: 'Failed to archive', variant: 'destructive' });
    }
  };



  const invalidateComplianceQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['compliance-completed'] });
    queryClient.invalidateQueries({ queryKey: ['compliance'] });
    queryClient.invalidateQueries({ queryKey: ['overview'] });
  };

  const handleRestore = async () => {
    if (!rideDoc) return;
    const ok = await restoreRideDocument(rideDoc.id);
    if (ok) {
      toast({ title: 'Document restored' });
      loadDocument(rideDoc.id);
      invalidateComplianceQueries();
    } else {
      toast({ title: 'Failed to restore', variant: 'destructive' });
    }
  };

  const friendlyCategory = (cat: string) => {
    const map: Record<string, string> = {
      inspection: 'Inspection',
      ndt: 'NDT',
      maintenance: 'Maintenance',
      doc_expiry: 'Document Expiry',
      CR: 'Compliance Records',
      MR: 'Maintenance Reports',
      TL: 'Equipment Timeline',
      CH: 'Check Records',
      IC: 'Inspection Checklists',
      RA: 'Risk Assessments',
    };
    return map[cat] || cat;
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <FileText className="mx-auto h-10 w-10 text-primary" />
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading document…</p>
        </div>
      </div>
    );
  }

  // ── Offline / no PDF available ──
  if (!pdfUrl && !loading) {
    const isOffline = !navigator.onLine;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3 max-w-xs px-4">
          {isOffline ? (
            <>
              <WifiOff className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">PDF available when online</p>
              <p className="text-xs text-muted-foreground">
                This document hasn't been cached locally. It will be available once you're back online, or open it while connected to cache it for offline use.
              </p>
            </>
          ) : (
            <>
              <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Document unavailable</p>
              <p className="text-xs text-muted-foreground">
                The PDF could not be loaded. It may have been removed or you may not have access.
              </p>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> OK
          </Button>
        </div>
      </div>
    );
  }

  const isLatest = !isViewingOldVersion;

  // ── Main ──
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Archived Banner ── */}
      {meta?.isArchived && rideDoc && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Archive className="h-4 w-4 text-destructive shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-destructive">This document is archived</p>
              <p className="text-xs text-muted-foreground">
                Archived {rideDoc.archived_at ? format(parseISO(rideDoc.archived_at), 'dd MMM yyyy HH:mm') : ''}
                {rideDoc.archived_by && <> · By: {rideDoc.archived_by}</>}
                {rideDoc.archive_reason && <> · Reason: {rideDoc.archive_reason}</>}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0"
            onClick={handleRestore}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore
          </Button>
        </div>
      )}

      {/* ── Superseded Version Banner ── */}
      {isViewingOldVersion && meta && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">
              You are viewing a superseded version (v{meta.version})
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            onClick={returnToLatest}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Return to latest version
          </Button>
        </div>
      )}

      {/* ── Header Bar ── */}
      <header className="sticky top-0 z-30 bg-card border-b border-border px-4 py-2.5 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Separator orientation="vertical" className="h-5" />

        {/* Document ID + Version badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {docDisplayId && (
              <span className="font-mono font-bold text-primary text-sm bg-primary/10 px-2 py-0.5 rounded shrink-0">
                {docDisplayId}
              </span>
            )}
            {meta && (
              <Badge className={`text-[10px] font-semibold border-0 shrink-0 ${
                meta.status === 'active'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              }`}>
                Version v{meta.version} ({meta.status === 'active' ? 'Active' : 'Superseded'})
              </Badge>
            )}
            {pdfSource === 'cache' && (
              <span className="text-[9px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                Cached
              </span>
            )}
            <h1 className="text-sm font-semibold text-foreground truncate">{docTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Save for offline */}
          {rideDoc && navigator.onLine && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleSaveOffline}
              disabled={savingOffline || isCachedLocally}
            >
              {savingOffline ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isCachedLocally ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              ) : (
                <HardDrive className="h-3.5 w-3.5" />
              )}
              {isCachedLocally ? 'Saved offline' : 'Save offline'}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
          {allVersions.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setVersionDialogOpen(true)}>
              <History className="h-3.5 w-3.5" />
              History
              {allVersions.length > 1 && (
                <span className="ml-0.5 bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                  {allVersions.length}
                </span>
              )}
            </Button>
          )}
          {isLatest && rideDoc && !meta?.isArchived && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setArchiveDialogOpen(true)}>
              <Archive className="h-3.5 w-3.5" />
              Archive
            </Button>
          )}
          {isLatest && meta?.isArchived && rideDoc && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleRestore}>
              <RotateCcw className="h-3.5 w-3.5" />
              Restore
            </Button>
          )}
        </div>
      </header>

      {/* ── Content: PDF + Sidebar ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* PDF Viewer */}
        <div className="flex-1">
          <PdfCanvasViewer
            src={pdfUrl}
            onDownload={handleDownload}
          />
        </div>

        {/* Metadata Sidebar */}
        {meta && (
          <aside className="w-72 border-l border-border bg-card overflow-y-auto shrink-0 hidden md:block">
            <div className="p-4 space-y-4">
              <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Document Details
              </h2>

              {/* Status badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge className={`text-[10px] font-semibold border-0 ${
                  meta.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {meta.status === 'active' ? 'Active' : 'Superseded'}
                </Badge>
                {meta.isArchived && (
                  <Badge className="text-[10px] font-semibold bg-destructive/10 text-destructive border-0">
                    Archived
                  </Badge>
                )}
              </div>

              <Separator />

              {/* Metadata rows */}
              <div className="space-y-3">
                <MetaRow icon={MapPin} label="Ride / Equipment" value={meta.rideName} />
                <MetaRow icon={FileText} label="Category" value={friendlyCategory(meta.category)} />
                <MetaRow icon={FileText} label="Document Type" value={meta.documentType} />
                {meta.dueDate && (
                  <MetaRow icon={Calendar} label="Due Date" value={formatDateUK(meta.dueDate)} />
                )}
                {meta.completedAt && (
                  <MetaRow
                    icon={CheckCircle2}
                    label="Completed"
                    value={formatDateUK(meta.completedAt)}
                  />
                )}
                {meta.inspector && (
                  <MetaRow icon={Building2} label="Inspector / Company" value={meta.inspector} />
                )}
                {meta.certificateRef && (
                  <MetaRow icon={Hash} label="Certificate / Ref" value={meta.certificateRef} />
                )}
                <MetaRow icon={History} label="Version" value={`v${meta.version}`} />
                <MetaRow
                  icon={Clock}
                  label="Created"
                  value={meta.createdAt ? format(parseISO(meta.createdAt), 'dd MMM yyyy HH:mm') : '–'}
                />
                {meta.evidenceCount > 0 && (
                  <MetaRow
                    icon={FileText}
                    label="Evidence"
                    value={`${meta.evidenceCount} attachment${meta.evidenceCount !== 1 ? 's' : ''}`}
                  />
                )}
              </div>

              {/* Inline version list in sidebar */}
              {allVersions.length > 1 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-2">
                      Version History
                    </h3>
                    <div className="space-y-1.5">
                      {allVersions.map(v => {
                        const isCurrent = rideDoc?.id === v.id;
                        return (
                          <button
                            key={v.id}
                            onClick={() => !isCurrent && switchToVersion(v)}
                            className={`w-full text-left rounded-md border px-2.5 py-2 transition-colors ${
                              isCurrent
                                ? 'border-primary/40 bg-primary/5 cursor-default'
                                : 'border-border hover:bg-accent cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold">v{v.version}</span>
                              <Badge className={`text-[9px] border-0 ${
                                v.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {v.status === 'active' ? 'Active' : 'Superseded'}
                              </Badge>
                              {isCurrent && (
                                <Eye className="h-3 w-3 text-primary ml-auto" />
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Generated {format(parseISO(v.created_at), 'dd MMM yyyy')}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Version History Dialog (for mobile / full list) */}
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>{docDisplayId}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {allVersions.map(v => {
              const isCurrent = rideDoc?.id === v.id;
              return (
                <div
                  key={v.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 ${
                    v.status === 'active' ? 'border-primary/30 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">v{v.version}</span>
                      {v.status === 'active' && (
                        <Badge className="text-[10px] bg-primary/15 text-primary border-0">Active</Badge>
                      )}
                      {v.status === 'superseded' && (
                        <Badge variant="secondary" className="text-[10px]">Superseded</Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="outline" className="text-[10px]">Viewing</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Generated {format(parseISO(v.created_at), 'dd MMM yyyy HH:mm')}
                    </p>
                  </div>
                  {!isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => switchToVersion(v)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                  )}
                </div>
              );
            })}
            {allVersions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No version history available</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Dialog - only accessible from latest version */}
      <Dialog open={archiveDialogOpen} onOpenChange={() => { setArchiveDialogOpen(false); setArchiveReason(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive Document</DialogTitle>
            <DialogDescription>Hidden from default view but not deleted.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">{docTitle}</p>
            <Textarea
              placeholder="Reason for archiving (optional)"
              value={archiveReason}
              onChange={e => setArchiveReason(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setArchiveDialogOpen(false); setArchiveReason(''); }}>
              Cancel
            </Button>
            <Button onClick={handleArchive}>Archive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Metadata Row Component ──

function MetaRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm text-foreground leading-tight break-words">{value}</p>
      </div>
    </div>
  );
}

export default DocumentViewerPage;
