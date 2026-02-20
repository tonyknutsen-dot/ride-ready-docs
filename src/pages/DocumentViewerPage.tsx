import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  FileText, Calendar, Building2, Hash, User, Clock, Loader2,
  MapPin, Eye, CheckCircle2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatDateUK } from '@/utils/dateFormat';
import {
  fetchRideDocuments, fetchDocumentVersions, archiveRideDocument,
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

  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docDisplayId, setDocDisplayId] = useState('');
  const [meta, setMeta] = useState<DocumentMeta | null>(null);

  // Underlying document data for actions
  const [rideDoc, setRideDoc] = useState<RideDocument | null>(null);
  const [fallbackDocId, setFallbackDocId] = useState<string | null>(null);

  // Dialogs
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [versions, setVersions] = useState<RideDocument[]>([]);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');

  useEffect(() => {
    if (!documentId || !user) return;
    loadDocument(documentId);
  }, [documentId, user]);

  const loadDocument = async (id: string) => {
    setLoading(true);
    try {
      // Try ride_documents first
      const { data: rdDoc, error: rdErr } = await supabase
        .from('ride_documents')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (rdDoc) {
        await loadFromRideDocument(rdDoc as RideDocument);
        return;
      }

      // Fallback: try documents table
      const { data: doc, error: docErr } = await supabase
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

  const loadFromRideDocument = async (rd: RideDocument) => {
    setRideDoc(rd);
    setDocTitle(rd.title);
    setDocDisplayId(rd.document_id);

    const url = await getSignedUrl(rd.file_url);
    setPdfUrl(url);

    // Get ride name
    const rideName = await getRideName(rd.ride_id);

    // Get linked compliance event for metadata
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
      documentType: RIDE_DOC_TYPE_LABELS[rd.document_type as keyof typeof RIDE_DOC_TYPE_LABELS] || rd.document_type,
      status: rd.status,
      isArchived: !!rd.archived_at,
      evidenceCount: eventMeta.evidenceCount || 0,
    });
  };

  const loadFromDocumentsTable = async (doc: any) => {
    setFallbackDocId(doc.id);
    setDocTitle(doc.document_name);

    // Extract document ID from name if present
    const idMatch = doc.document_name?.match(/^([A-Z0-9]+-[A-Z]+-\d{4}-\d{4})/);
    setDocDisplayId(idMatch?.[1] || doc.id.slice(0, 8));

    const url = await getSignedUrl(doc.file_path);
    setPdfUrl(url);

    const rideName = doc.ride_id ? await getRideName(doc.ride_id) : 'Global';

    // Parse notes for event metadata
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

    // Parse inspector from notes fallback
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
    const a = document.createElement('a');
    a.href = url;
    a.download = docTitle || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShowVersions = async () => {
    if (!rideDoc) {
      toast({ title: 'Version history not available for this document' });
      return;
    }
    const v = await fetchDocumentVersions(rideDoc.document_id);
    setVersions(v);
    setVersionDialogOpen(true);
  };

  const handleArchive = async () => {
    if (!rideDoc || !user) return;
    const ok = await archiveRideDocument(rideDoc.id, user.id, archiveReason);
    if (ok) {
      toast({ title: 'Document archived' });
      setArchiveDialogOpen(false);
      setArchiveReason('');
      navigate(-1);
    } else {
      toast({ title: 'Failed to archive', variant: 'destructive' });
    }
  };

  const handleRestore = async () => {
    if (!rideDoc) return;
    const ok = await restoreRideDocument(rideDoc.id);
    if (ok) {
      toast({ title: 'Document restored' });
      loadDocument(rideDoc.id);
    } else {
      toast({ title: 'Failed to restore', variant: 'destructive' });
    }
  };

  const handleViewVersion = async (v: RideDocument) => {
    const url = await getSignedUrl(v.file_url);
    if (url) window.open(url, '_blank');
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

  // ── Main ──
  return (
    <div className="min-h-screen bg-background flex flex-col">
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

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            {docDisplayId && (
              <span className="font-mono font-bold text-primary text-sm bg-primary/10 px-2 py-0.5 rounded shrink-0">
                {docDisplayId}
              </span>
            )}
            <h1 className="text-sm font-semibold text-foreground truncate">{docTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
          {rideDoc && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleShowVersions}>
              <History className="h-3.5 w-3.5" />
              History
            </Button>
          )}
          {rideDoc && !meta?.isArchived && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setArchiveDialogOpen(true)}>
              <Archive className="h-3.5 w-3.5" />
              Archive
            </Button>
          )}
          {meta?.isArchived && rideDoc && (
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
        <div className="flex-1 bg-muted/30">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title={docTitle}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Unable to load PDF</p>
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
                  {meta.status === 'active' ? 'Active' : meta.status}
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
            </div>
          </aside>
        )}
      </div>

      {/* Version History Dialog */}
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>{docDisplayId}</DialogDescription>
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
                    {v.status === 'active' && (
                      <Badge className="text-[10px] bg-primary/15 text-primary border-0">Active</Badge>
                    )}
                    {v.status === 'superseded' && (
                      <Badge variant="secondary" className="text-[10px]">Superseded</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(parseISO(v.created_at), 'dd MMM yyyy HH:mm')}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleViewVersion(v)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {versions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No version history available</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Dialog */}
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
