import { useState, useEffect, useCallback } from 'react';
import PdfJsViewer from '@/components/PdfJsViewer';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateComplianceQueries as invalidateComplianceQueriesShared, invalidateDocumentQueries } from '@/utils/queryInvalidation';
import { supabase } from '@/integrations/supabase/client';
import { getCachedPdf, cachePdf, createCachedPdfUrl } from '@/lib/pdfCache';
import { useAuth } from '@/contexts/AuthContext';
import { isDocExpired, isDocExpiringSoon, daysUntilExpiry, getExpiryLabel } from '@/utils/documentHelpers';

import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, Download, History, Archive, RotateCcw,
  FileText, Calendar, Building2, Hash, Clock, Loader2,
  MapPin, Eye, CheckCircle2, AlertTriangle, WifiOff, HardDrive,
  Image as ImageIcon, File, Trash2, Pencil,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatDateUK } from '@/utils/dateFormat';
import {
  createPdfViewerUrlFromBlob,
  getStorageFileBlob,
  revokeObjectUrl,
} from '@/utils/exportFileActions';
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
  expiresAt: string | null;
}

interface TemporaryViewerState {
  fileUrl?: string;
  fileName?: string;
  mimeType?: string | null;
  temporary?: boolean;
}

const DocumentViewerPage = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const viewerState = (location.state ?? null) as TemporaryViewerState | null;

  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfSource, setPdfSource] = useState<'network' | 'cache' | null>(null);
  const [isCachedLocally, setIsCachedLocally] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docDisplayId, setDocDisplayId] = useState('');
  const [meta, setMeta] = useState<DocumentMeta | null>(null);
  const [fileType, setFileType] = useState<'pdf' | 'image' | 'other'>('pdf');
  const [viewerError, setViewerError] = useState<string | null>(null);

  // Underlying document data
  const [rideDoc, setRideDoc] = useState<RideDocument | null>(null);
  const [fallbackDocId, setFallbackDocId] = useState<string | null>(null);
  const [fallbackDoc, setFallbackDoc] = useState<any>(null);

  // Version control state
  const [allVersions, setAllVersions] = useState<RideDocument[]>([]);
  const [latestVersion, setLatestVersion] = useState<RideDocument | null>(null);
  const [isViewingOldVersion, setIsViewingOldVersion] = useState(false);

  // Dialogs
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [editExpiryDialogOpen, setEditExpiryDialogOpen] = useState(false);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = useState(false);
  const [acknowledgeNote, setAcknowledgeNote] = useState('');
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(null);
  const [acknowledgedBy, setAcknowledgedBy] = useState<string | null>(null);

  useEffect(() => {
    if (documentId && user) {
      loadDocument(documentId);
      return;
    }

    if (viewerState?.fileUrl) {
      setLoading(false);
      setRideDoc(null);
      setFallbackDocId(null);
      setAllVersions([]);
      setLatestVersion(null);
      setIsViewingOldVersion(false);
      setMeta(null);
      setPdfUrl(viewerState.fileUrl);
      setPdfSource(null);
      setDocTitle(viewerState.fileName || 'Document');
      setDocDisplayId('');
      setIsCachedLocally(false);
      setFileType(detectFileType(viewerState.fileName || viewerState.fileUrl, viewerState.mimeType));
      setViewerError(null);
      debugViewer('temporary-viewer-mounted', {
        documentId: documentId ?? null,
        fileName: viewerState.fileName || 'Document',
        fileType: detectFileType(viewerState.fileName || viewerState.fileUrl, viewerState.mimeType),
      });
    }
  }, [documentId, user, viewerState?.fileUrl, viewerState?.fileName, viewerState?.mimeType]);

  useEffect(() => {
    return () => {
      if (viewerState?.temporary && viewerState.fileUrl) {
        revokeObjectUrl(viewerState.fileUrl);
      }
    };
  }, [viewerState?.temporary, viewerState?.fileUrl]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(pdfUrl);
    };
  }, [pdfUrl]);

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
      const blob = await getStorageFileBlob(rideDoc.file_url);
      const prepared = await createPdfViewerUrlFromBlob(blob);
      if (!prepared.validPdf) throw new Error('Stored file is not a valid PDF');
      await cachePdf(rideDoc.document_id, rideDoc.version, rideDoc.file_url, prepared.normalizedBlob, rideDoc.title);
      setIsCachedLocally(true);
      toast({ title: 'Saved for offline', description: 'This document is now available offline.' });
    } catch (err) {
      toast({ title: 'Failed to save offline', variant: 'destructive' });
    } finally {
      setSavingOffline(false);
    }
  }, [rideDoc, toast]);

  const debugViewer = useCallback((event: string, payload?: Record<string, unknown>) => {
    console.info('[DocumentViewer]', {
      event,
      ...payload,
    });
  }, []);

  const formatViewerError = useCallback((error: unknown) => {
    if (error instanceof Error && error.message) return error.message;
    return 'The file could not be resolved for viewing.';
  }, []);

  // removed: appendPdfViewerParams — no longer needed with blob URLs

  const primePdfCache = useCallback(async (filePath: string, cacheKey: string, version: number, title: string) => {
    try {
      const blob = await getStorageFileBlob(filePath);
      const prepared = await createPdfViewerUrlFromBlob(blob);
      if (!prepared.validPdf) {
        debugViewer('cache-prime-invalid-pdf', { filePath, cacheKey, version });
        return;
      }

      await cachePdf(cacheKey, version, filePath, prepared.normalizedBlob, title);
      debugViewer('cache-prime-success', { filePath, cacheKey, version });
    } catch (error) {
      debugViewer('cache-prime-failed', {
        filePath,
        cacheKey,
        version,
        error: formatViewerError(error),
      });
    }
  }, [debugViewer, formatViewerError]);

  const loadDocument = async (id: string) => {
    setLoading(true);
    setIsViewingOldVersion(false);
    setViewerError(null);
    revokeObjectUrl(pdfUrl);
    setPdfUrl(null);
    setPdfSource(null);
    debugViewer('load-start', { documentId: id });
    try {
      // Try ride_documents first
      const { data: rdDoc } = await supabase
        .from('ride_documents')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (rdDoc) {
        const rd = rdDoc as RideDocument;
        debugViewer('document-found-ride-documents', {
          documentId: id,
          filePath: rd.file_url,
          documentType: rd.document_type,
        });
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
        debugViewer('document-found-documents-table', {
          documentId: id,
          filePath: doc.file_path,
          mimeType: doc.mime_type,
          documentType: doc.document_type,
        });
        await loadFromDocumentsTable(doc);
        return;
      }

      toast({ title: 'Document not found', variant: 'destructive' });
      navigate(-1);
    } catch (err) {
      console.error('Error loading document:', err);
      setViewerError(formatViewerError(err));
      debugViewer('load-failed', {
        documentId: id,
        error: formatViewerError(err),
      });
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
    setFallbackDocId(null);
    setDocTitle(rd.title);
    setDocDisplayId(rd.document_id);
    setFileType('pdf');

    // ── Cache-first PDF loading ──
    const cached = await getCachedPdf(rd.document_id);
    const isOnline = navigator.onLine;

    if (cached && cached.version === rd.version) {
      // Cache hit — version matches, serve locally
      setPdfUrl(createCachedPdfUrl(cached));
      setPdfSource('cache');
      setViewerError(null);
      debugViewer('viewer-source-ready', {
        documentId: rd.id,
        source: 'cache',
        filePath: rd.file_url,
      });
    } else if (isOnline) {
      try {
        const resolvedViewer = await resolveStoredViewerUrl(rd.file_url, 'pdf');
        setPdfUrl(resolvedViewer.url);
        setPdfSource('network');
        setViewerError(null);
        debugViewer('viewer-source-ready', {
          documentId: rd.id,
          source: 'network',
          filePath: rd.file_url,
          resolvedUrl: resolvedViewer.url,
        });
        void primePdfCache(rd.file_url, rd.document_id, rd.version, rd.title);
      } catch (error) {
        // Signed URL failed but we may have a stale cache
        if (cached) {
          setPdfUrl(createCachedPdfUrl(cached));
          setPdfSource('cache');
          setViewerError(null);
          debugViewer('viewer-source-fallback-cache', {
            documentId: rd.id,
            filePath: rd.file_url,
            error: formatViewerError(error),
          });
        } else {
          setPdfUrl(null);
          setViewerError(formatViewerError(error));
          debugViewer('viewer-source-failed', {
            documentId: rd.id,
            filePath: rd.file_url,
            error: formatViewerError(error),
          });
        }
      }
    } else if (cached) {
      // Offline with stale cache — serve what we have
      setPdfUrl(createCachedPdfUrl(cached));
      setPdfSource('cache');
      setViewerError(null);
      debugViewer('viewer-source-ready', {
        documentId: rd.id,
        source: 'cache-offline',
        filePath: rd.file_url,
      });
    } else {
      // Offline, no cache
      setPdfUrl(null);
      setPdfSource(null);
      setViewerError('This PDF is not cached yet. Open it once while online to view it here later.');
      debugViewer('viewer-source-missing-offline', {
        documentId: rd.id,
        filePath: rd.file_url,
      });
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
      expiresAt: null,
    });
  };

  const detectFileType = (filePath: string, mimeType?: string | null): 'pdf' | 'image' | 'other' => {
    const mt = mimeType?.toLowerCase() || '';
    if (mt === 'application/pdf') return 'pdf';
    if (mt.startsWith('image/')) return 'image';
    const fp = filePath.toLowerCase();
    if (/\.pdf$/i.test(fp)) return 'pdf';
    if (/\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(fp)) return 'image';
    return 'other';
  };

  const resolveStoredViewerUrl = async (
    filePath: string,
    nextFileType: 'pdf' | 'image' | 'other',
  ): Promise<{ url: string; source: 'network' }> => {
    debugViewer('resolve-file-start', {
      documentId: documentId ?? null,
      filePath,
      fileType: nextFileType,
    });

    // Download blob directly — more reliable than signed URLs on mobile
    const blob = await getStorageFileBlob(filePath);

    debugViewer('resolve-file-blob', {
      documentId: documentId ?? null,
      filePath,
      blobSize: blob.size,
      blobType: blob.type,
    });

    if (nextFileType === 'pdf') {
      const normalizedBlob = blob.type === 'application/pdf'
        ? blob
        : new Blob([blob], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(normalizedBlob);
      return { url: blobUrl, source: 'network' };
    }

    if (nextFileType === 'image') {
      const blobUrl = URL.createObjectURL(blob);
      return { url: blobUrl, source: 'network' };
    }

    const blobUrl = URL.createObjectURL(blob);
    return { url: blobUrl, source: 'network' };
  };

  const loadFromDocumentsTable = async (doc: any) => {
    setFallbackDocId(doc.id);
    setFallbackDoc(doc);
    setAllVersions([]);
    setLatestVersion(null);
    setRideDoc(null);
    setDocTitle(doc.document_name);
    setIsAcknowledged(!!doc.expiry_acknowledged_at);
    setAcknowledgedAt(doc.expiry_acknowledged_at || null);
    setAcknowledgedBy(doc.expiry_acknowledged_by || null);

    const ft = detectFileType(doc.file_path || '', doc.mime_type);
    setFileType(ft);
    debugViewer('documents-table-file-detected', {
      documentId: doc.id,
      filePath: doc.file_path,
      fileType: ft,
      mimeType: doc.mime_type,
    });

    const idMatch = doc.document_name?.match(/^([A-Z0-9]+-[A-Z]+-\d{4}-\d{4})/);
    setDocDisplayId(idMatch?.[1] || doc.id.slice(0, 8));

    try {
      const resolvedViewer = await resolveStoredViewerUrl(doc.file_path, ft);
      setPdfUrl(resolvedViewer.url);
      setPdfSource(resolvedViewer.source);
      setViewerError(null);
      debugViewer('viewer-source-ready', {
        documentId: doc.id,
        source: resolvedViewer.source,
        filePath: doc.file_path,
        resolvedUrl: resolvedViewer.url,
      });
    } catch (error) {
      setPdfUrl(null);
      setPdfSource(null);
      setViewerError(formatViewerError(error));
      debugViewer('viewer-source-failed', {
        documentId: doc.id,
        filePath: doc.file_path,
        error: formatViewerError(error),
      });
      throw error;
    }

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
      expiresAt: doc.expires_at || null,
    });
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
    if (viewerState?.temporary && viewerState.fileUrl) {
      try {
        const response = await fetch(viewerState.fileUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = viewerState.fileName || docTitle || 'document';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch {
        toast({ title: 'Download failed', variant: 'destructive' });
      }
      return;
    }

    if (!navigator.onLine) {
      toast({ title: 'Requires connection', description: 'Downloads are unavailable while offline.' });
      return;
    }
    const currentFilePath = rideDoc?.file_url;
    if (!currentFilePath && !fallbackDocId) return;

    let resolvedFilePath: string | null = null;
    if (currentFilePath) {
      resolvedFilePath = currentFilePath;
    } else if (fallbackDocId) {
      const { data } = await supabase
        .from('documents')
        .select('file_path')
        .eq('id', fallbackDocId)
        .maybeSingle();
      if (data) resolvedFilePath = data.file_path;
    }

    if (!resolvedFilePath) {
      toast({ title: 'Download failed', variant: 'destructive' });
      return;
    }

    try {
      const blob = await getStorageFileBlob(resolvedFilePath);
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
    invalidateComplianceQueriesShared(queryClient);
    invalidateDocumentQueries(queryClient);
  };

  const handleEditExpiry = async () => {
    if (!fallbackDocId || !newExpiryDate) return;
    const { error } = await supabase
      .from('documents')
      .update({ expires_at: newExpiryDate })
      .eq('id', fallbackDocId);
    if (error) {
      toast({ title: 'Failed to update expiry', variant: 'destructive' });
      return;
    }
    toast({ title: 'Expiry date updated' });
    setEditExpiryDialogOpen(false);
    setNewExpiryDate('');
    invalidateComplianceQueries();
    // Reload to reflect new meta
    loadDocument(fallbackDocId);
  };

  const handleDeleteUploadedDoc = async () => {
    if (!fallbackDocId || !fallbackDoc) return;
    // Delete from storage first
    if (fallbackDoc.file_path) {
      await supabase.storage.from('ride-documents').remove([fallbackDoc.file_path]);
    }
    const { error } = await supabase.from('documents').delete().eq('id', fallbackDocId);
    if (error) {
      toast({ title: 'Failed to delete document', variant: 'destructive' });
      return;
    }
    toast({ title: 'Document deleted' });
    setDeleteDialogOpen(false);
    invalidateComplianceQueries();
    navigate(-1);
  };
  const handleAcknowledgeExpiry = async () => {
    if (!fallbackDocId || !user) return;
    const { error } = await supabase
      .from('documents')
      .update({
        expiry_acknowledged_at: new Date().toISOString(),
        expiry_acknowledged_by: user.id,
        expiry_acknowledgement_note: acknowledgeNote || null,
      })
      .eq('id', fallbackDocId);
    if (error) {
      toast({ title: 'Failed to acknowledge expiry', variant: 'destructive' });
      return;
    }
    toast({ title: 'Expiry acknowledged', description: 'This document has been removed from the dashboard queue.' });
    setAcknowledgeDialogOpen(false);
    setAcknowledgeNote('');
    setIsAcknowledged(true);
    setAcknowledgedAt(new Date().toISOString());
    setAcknowledgedBy(user.id);
    invalidateComplianceQueries();
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
                {viewerError || 'The PDF could not be loaded. It may have been removed or you may not have access.'}
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

      {/* ── Expiry Banner ── */}
      {meta?.expiresAt && (() => {
        const expired = isDocExpired(meta.expiresAt);
        const expiringSoon = isDocExpiringSoon(meta.expiresAt);
        if (!expired && !expiringSoon) return null;
        const label = getExpiryLabel(meta.expiresAt);

        // Already acknowledged — show neutral confirmation banner
        if (isAcknowledged) {
          return (
            <div className="border-b px-4 py-3 flex items-center gap-2.5 bg-muted/50 border-border">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {label} — Reviewed and acknowledged
                </p>
                <p className="text-xs text-muted-foreground">
                  {acknowledgedAt && <>Acknowledged {format(parseISO(acknowledgedAt), 'dd MMM yyyy')} · </>}
                  This document remains in the register but is no longer on the dashboard queue.
                </p>
              </div>
            </div>
          );
        }

        // Not yet acknowledged — show actionable banner
        return (
          <div className={`border-b px-4 py-3 flex items-center justify-between gap-3 ${
            expired
              ? 'bg-destructive/10 border-destructive/20'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertTriangle className={`h-4 w-4 shrink-0 ${expired ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`} />
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${expired ? 'text-destructive' : 'text-amber-800 dark:text-amber-300'}`}>
                  {label}
                </p>
                <p className="text-xs text-muted-foreground">
                  This document is currently listed under Expired / Expiring Documents on the dashboard.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              {/* Primary: Acknowledge */}
              {fallbackDocId && (
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setAcknowledgeDialogOpen(true)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Acknowledge expiry
                </Button>
              )}
              {/* Secondary: Edit expiry */}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => {
                  setNewExpiryDate(meta.expiresAt || '');
                  setEditExpiryDialogOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit expiry
              </Button>
            </div>
          </div>
        );
      })()}

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

      {/* ── Content: Document + Sidebar ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Viewer — routed, full-page, native-first */}
        <div className="flex-1">
          {fileType === 'pdf' && pdfUrl && (
            <PdfJsViewer
              url={pdfUrl}
              title={docTitle}
              className="h-full w-full"
              onLoad={() => {
                debugViewer('viewer-mount-success', {
                  documentId: documentId ?? fallbackDocId ?? null,
                  fileType,
                  resolvedUrl: pdfUrl,
                });
              }}
              onError={(message) => {
                setViewerError(message);
                debugViewer('viewer-mount-failed', {
                  documentId: documentId ?? fallbackDocId ?? null,
                  fileType,
                  resolvedUrl: pdfUrl,
                  error: message,
                });
              }}
            />
          )}
          {fileType === 'image' && pdfUrl && (
            <div className="w-full h-full overflow-auto bg-background">
              <img
                src={pdfUrl}
                alt={docTitle}
                className="block mx-auto max-w-full min-h-full object-contain"
              />
            </div>
          )}
          {fileType === 'other' && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center space-y-3 max-w-xs px-4">
                <File className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Preview not available</p>
                <p className="text-xs text-muted-foreground">
                  This file type cannot be previewed in the app. Use the download button to open it on your device.
                </p>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download
                </Button>
              </div>
            </div>
          )}
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
                {meta.expiresAt && (
                  <MetaRow
                    icon={Calendar}
                    label="Expires"
                    value={getExpiryLabel(meta.expiresAt)}
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

      {/* Edit Expiry Dialog */}
      <Dialog open={editExpiryDialogOpen} onOpenChange={setEditExpiryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Expiry Date</DialogTitle>
            <DialogDescription>
              Update the expiry date to remove this document from the dashboard warning.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">{docTitle}</p>
            <div className="space-y-1.5">
              <Label htmlFor="expiry-date">New expiry date</Label>
              <Input
                id="expiry-date"
                type="date"
                value={newExpiryDate?.split('T')[0] || ''}
                onChange={(e) => setNewExpiryDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExpiryDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditExpiry} disabled={!newExpiryDate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              This will permanently delete the document and remove it from the dashboard.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium">{docTitle}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUploadedDoc}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Acknowledge Expiry Dialog */}
      <Dialog open={acknowledgeDialogOpen} onOpenChange={() => { setAcknowledgeDialogOpen(false); setAcknowledgeNote(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Acknowledge Expiry</DialogTitle>
            <DialogDescription>
              This will remove the document from the dashboard "Expired / Expiring Documents" queue. The document will remain in the register with its expired status visible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">{docTitle}</p>
            <Textarea
              placeholder="Optional note (e.g. replacement ordered, awaiting renewal)"
              value={acknowledgeNote}
              onChange={e => setAcknowledgeNote(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAcknowledgeDialogOpen(false); setAcknowledgeNote(''); }}>
              Cancel
            </Button>
            <Button onClick={handleAcknowledgeExpiry}>Acknowledge</Button>
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
