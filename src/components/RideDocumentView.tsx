import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  Image as ImageIcon,
  ChevronDown,
  MoreVertical,
  Download,
  History,
  Archive,
  RotateCcw,
  Globe,
  AlertTriangle,
  File,
  RefreshCw,
  Link2,
  Eye,
} from 'lucide-react';
import DocumentRowActions from '@/components/documents/DocumentRowActions';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useStaff } from '@/contexts/StaffContext';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { formatDateUK } from '@/utils/dateFormat';
import { getSignedStorageUrl } from '@/utils/exportFileActions';
import DocumentViewer, { detectFileType } from '@/components/DocumentViewer';
import { useAuditLog } from '@/hooks/useAuditLog';

type Document = Tables<'documents'>;

/* ─── Shared helpers from single source of truth ─── */
import {
  isGeneratedDoc as isGenerated,
  isImageFile,
  isPDFFile,
  fileExtension as fileExt,
  isDocExpiringSoon as isExpiringSoon,
  isDocExpired as isExpired,
  getExpiryLabel,
  getCompactExpiry,
  DOC_TYPE_LABELS as TYPE_LABELS,
} from '@/utils/documentHelpers';

type FilterType = 'all' | 'generated' | 'uploaded' | 'expiring';

interface RideDocumentViewProps {
  rideId: string;
  rideName: string;
  onDocumentDeleted: () => void;
  refreshKey: number;
}

const RideDocumentView = ({ rideId, rideName, onDocumentDeleted, refreshKey }: RideDocumentViewProps) => {
  const { effectiveUserId } = useEffectiveUserId();
  const { isStaff } = useStaff();
  const { toast } = useToast();
  const { logEvent } = useAuditLog();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [rideOpen, setRideOpen] = useState(true);
  const [globalOpen, setGlobalOpen] = useState(true);

  // Viewer state
  const [viewerDoc, setViewerDoc] = useState<{ url: string; name: string; type: 'pdf' | 'image' | 'unsupported' } | null>(null);

  /* ─── Fetch ─── */
  useEffect(() => {
    if (!effectiveUserId) return;
    loadDocuments();
  }, [effectiveUserId, rideId, refreshKey]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('documents')
        .select('*')
        .neq('document_type', 'maintenance')
        .neq('document_type', 'photo')
        .or(`ride_id.eq.${rideId},is_global.eq.true`)
        .order('uploaded_at', { ascending: false });

      if (!isStaff) {
        query = query.eq('user_id', effectiveUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDocuments(data || []);
    } catch (err: any) {
      console.error('Error loading documents:', err);
      if (navigator.onLine) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  /* ─── Classify & filter ─── */
  const classified = useMemo(() => {
    let filtered = documents;

    if (filter === 'generated') filtered = filtered.filter(isGenerated);
    else if (filter === 'uploaded') filtered = filtered.filter(d => !isGenerated(d));
    else if (filter === 'expiring') {
      filtered = filtered.filter(d => d.expires_at && (isExpiringSoon(d.expires_at) || isExpired(d.expires_at)));
      // Sort expired/expiring to top
      filtered.sort((a, b) => new Date(a.expires_at!).getTime() - new Date(b.expires_at!).getTime());
    }

    const rideGenerated: Document[] = [];
    const rideUploaded: Document[] = [];
    const globalGenerated: Document[] = [];
    const globalUploaded: Document[] = [];

    filtered.forEach(doc => {
      const global = doc.is_global === true;
      const gen = isGenerated(doc);
      if (global) {
        gen ? globalGenerated.push(doc) : globalUploaded.push(doc);
      } else {
        gen ? rideGenerated.push(doc) : rideUploaded.push(doc);
      }
    });

    return { rideGenerated, rideUploaded, globalGenerated, globalUploaded };
  }, [documents, filter]);

  const rideCount = classified.rideGenerated.length + classified.rideUploaded.length;
  const globalCount = classified.globalGenerated.length + classified.globalUploaded.length;

  /* ─── Actions ─── */

  const handleView = async (doc: Document) => {
    try {
      const signedUrl = await getSignedStorageUrl(doc.file_path);
      if (!signedUrl) throw new Error('Could not get file URL');
      const ft = detectFileType(doc.file_path || doc.document_name || '');
      if (ft === 'unsupported') {
        window.open(signedUrl, '_blank');
      } else {
        setViewerDoc({ url: signedUrl, name: doc.document_name, type: ft });
      }
    } catch (err: any) {
      toast({ title: 'Failed to open', description: err.message, variant: 'destructive' });
    }
  };

  const handleViewerDownload = async () => {
    if (!viewerDoc) return;
    try {
      const response = await fetch(viewerDoc.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = viewerDoc.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('ride-documents')
        .download(doc.file_path);
      if (error) throw error;
      const blob = new Blob([data], { type: doc.mime_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.document_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: 'Download failed', description: err.message, variant: 'destructive' });
    }
  };


  const handleCopyLink = async (doc: Document) => {
    try {
      const signedUrl = await getSignedStorageUrl(doc.file_path);
      if (!signedUrl) throw new Error('No signed URL');
      await navigator.clipboard.writeText(signedUrl);
      toast({ title: 'Link copied', description: 'Signed link valid for 1 hour.' });
    } catch {
      toast({ title: 'Copy link failed', description: 'Could not copy link.', variant: 'destructive' });
    }
  };

  const handleDelete = async (doc: Document) => {
    try {
      await supabase.storage.from('ride-documents').remove([doc.file_path]);
      await supabase.from('documents').delete().eq('id', doc.id);
      logEvent('delete', 'document', doc.id, { name: doc.document_name, ride: rideName }, {
        before: { document_name: doc.document_name, document_type: doc.document_type, file_path: doc.file_path },
        equipmentName: rideName,
        contextHint: 'permanent file deletion',
      });
      toast({ title: 'Document deleted' });
      onDocumentDeleted();
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleScope = async (doc: Document) => {
    try {
      const newGlobal = !doc.is_global;
      const { error } = await supabase
        .from('documents')
        .update({
          is_global: newGlobal,
          ride_id: newGlobal ? null : (doc.ride_id || rideId),
        })
        .eq('id', doc.id);
      if (error) throw error;
      toast({
        title: newGlobal ? 'Document is now Global' : 'Document is now Ride-Only',
        description: newGlobal
          ? 'This document will appear across all equipment.'
          : 'This document is now linked to this equipment only.',
      });
      onDocumentDeleted(); // triggers refresh
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  /* ─── Render helpers ─── */

  const getRelativeExpiry = (date: string) => {
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
    if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`;
    if (days === 0) return 'Expires today';
    if (days === 1) return 'Expires tomorrow';
    return `Expires in ${days} days`;
  };

  const ExpiryPill = ({ date }: { date: string }) => {
    const { chip, detail, severity } = getCompactExpiry(date);
    if (severity === 'expired') {
      return (
        <span className="inline-flex items-center gap-1.5">
          <Badge variant="destructive" className="text-[10px] h-5 gap-1 whitespace-nowrap">
            <AlertTriangle className="h-3 w-3" /> {chip}
          </Badge>
          <span className="text-[10px] text-destructive font-medium">{detail}</span>
        </span>
      );
    }
    if (severity === 'critical' || severity === 'warning') {
      return (
        <span className="inline-flex items-center gap-1.5">
          <Badge className="text-[10px] h-5 gap-1 bg-warning/15 text-warning-foreground border-warning/30 whitespace-nowrap">
            <AlertTriangle className="h-3 w-3" /> {chip}
          </Badge>
          <span className="text-[10px] text-warning-foreground font-medium">{detail}</span>
        </span>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] h-5 text-green-700 border-green-200 bg-green-50 whitespace-nowrap">
        Current
      </Badge>
    );
  };

  const FileIcon = ({ doc }: { doc: Document }) => {
    const fp = doc.file_path || '';
    if (isPDFFile(fp)) return <FileText className="h-5 w-5 text-destructive" />;
    if (isImageFile(fp)) return <ImageIcon className="h-5 w-5 text-primary" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const DocCard = ({ doc, showGlobalBadge = false }: { doc: Document; showGlobalBadge?: boolean }) => {
    const gen = isGenerated(doc);
    const typeLabel = TYPE_LABELS[doc.document_type] || doc.document_type;
    const ext = fileExt(doc.file_path || '');

    return (
      <div
        className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => handleView(doc)}
      >
        {/* File type icon */}
        <div className="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
          <FileIcon doc={doc} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{doc.document_name || typeLabel}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {doc.is_global ? (
              <span className="text-[10px] text-muted-foreground font-medium">Global</span>
            ) : (
              <span className="text-[10px] text-muted-foreground font-medium">This ride only</span>
            )}
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {gen ? 'Generated' : 'Uploaded'}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-medium">{ext}</span>
            {doc.version_number && (
              <span className="text-[10px] text-muted-foreground">v{doc.version_number}</span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {formatDateUK(new Date(doc.uploaded_at))}
            </span>
          </div>

          {doc.expires_at && (
            <div className="mt-0.5">
              <ExpiryPill date={doc.expires_at} />
            </div>
          )}
        </div>

        {/* Canonical actions */}
        <DocumentRowActions
          onView={() => handleView(doc)}
          onDownload={() => handleDownload(doc)}
          onCopyLink={() => handleCopyLink(doc)}
          onReplace={() => {
            window.dispatchEvent(new CustomEvent('rrd:replace-doc', {
              detail: { docId: doc.id, docType: doc.document_type, docName: doc.document_name }
            }));
          }}
          onDelete={!showGlobalBadge ? () => handleDelete(doc) : undefined}
          isGlobal={doc.is_global ?? false}
          onToggleGlobal={!isStaff ? () => handleToggleScope(doc) : undefined}
        />
      </div>
    );
  };

  const SubSection = ({ label, docs, showGlobalBadge = false }: { label: string; docs: Document[]; showGlobalBadge?: boolean }) => {
    if (docs.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
          {label}
          <span className="ml-1.5 text-[10px] font-normal">({docs.length})</span>
        </p>
        <div className="space-y-1.5">
          {docs.map(doc => (
            <DocCard key={doc.id} doc={doc} showGlobalBadge={showGlobalBadge} />
          ))}
        </div>
      </div>
    );
  };

  /* ─── Filter chips ─── */
  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'generated', label: 'Generated' },
    { key: 'uploaded', label: 'Uploaded' },
    { key: 'expiring', label: 'Expiring' },
  ];

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* GROUP A: Ride Documents */}
      <Collapsible open={rideOpen} onOpenChange={setRideOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
          <h3 className="text-base font-bold">
            Ride Documents
            <span className="ml-2 text-xs font-normal text-muted-foreground">({rideCount})</span>
          </h3>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', !rideOpen && '-rotate-90')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-1">
          {rideCount === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No ride documents yet</p>
          ) : (
            <>
              <SubSection label="Generated" docs={classified.rideGenerated} />
              <SubSection label="Uploaded" docs={classified.rideUploaded} />
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* GROUP B: Global Documents */}
      <Collapsible open={globalOpen} onOpenChange={setGlobalOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
          <h3 className="text-base font-bold">
            Global Documents
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              – Applies to All Rides ({globalCount})
            </span>
          </h3>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', !globalOpen && '-rotate-90')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-1">
          {globalCount === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No global documents yet</p>
          ) : (
            <>
              <SubSection label="Generated" docs={classified.globalGenerated} showGlobalBadge />
              <SubSection label="Uploaded" docs={classified.globalUploaded} showGlobalBadge />
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {viewerDoc && (
        <DocumentViewer
          isOpen
          onClose={() => setViewerDoc(null)}
          fileUrl={viewerDoc.url}
          fileName={viewerDoc.name}
          fileType={viewerDoc.type}
          onDownload={handleViewerDownload}
        />
      )}
    </div>
  );
};

export default RideDocumentView;
