import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Eye, MoreVertical, Archive, RotateCcw, History, ChevronDown, Filter,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { openDocumentById } from '@/utils/documentOpen';
import {
  fetchRideDocuments, fetchDocumentVersions, archiveRideDocument,
  restoreRideDocument, RideDocument, RideDocType,
  RIDE_DOC_TYPE_LABELS, RIDE_DOC_TYPE_ICONS, RIDE_DOC_GROUP_ORDER,
} from '@/utils/rideDocumentService';

interface RideDocumentRegisterProps {
  rideId: string;
  rideName: string;
}

const RideDocumentRegister = ({ rideId, rideName }: RideDocumentRegisterProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<RideDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [versionDialogDoc, setVersionDialogDoc] = useState<RideDocument | null>(null);
  const [versions, setVersions] = useState<RideDocument[]>([]);
  const [archiveDialogDoc, setArchiveDialogDoc] = useState<RideDocument | null>(null);
  const [archiveReason, setArchiveReason] = useState('');

  useEffect(() => {
    loadDocuments();
  }, [rideId, showArchived]);

  const loadDocuments = async () => {
    setLoading(true);
    const docs = await fetchRideDocuments(rideId, { includeArchived: showArchived });
    setDocuments(docs);
    setLoading(false);
  };

  const grouped = useMemo(() => {
    const groups: Record<RideDocType, RideDocument[]> = {
      CR: [], MR: [], TL: [], CH: [], IC: [], RA: [], IR: [],
    };
    documents.forEach(doc => {
      if (groups[doc.document_type as RideDocType]) {
        groups[doc.document_type as RideDocType].push(doc);
      }
    });
    return groups;
  }, [documents]);

  const toggleGroup = (type: string) => {
    setExpandedGroups(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleViewPdf = (doc: RideDocument) => {
    navigate(`/documents/${doc.id}`);
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
      loadDocuments();
    } else {
      toast({ title: 'Failed to archive', variant: 'destructive' });
    }
  };

  const handleRestore = async (doc: RideDocument) => {
    const ok = await restoreRideDocument(doc.id);
    if (ok) {
      toast({ title: 'Document restored' });
      loadDocuments();
    } else {
      toast({ title: 'Failed to restore', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  const totalDocs = documents.filter(d => !d.archived_at).length;
  const archivedCount = documents.filter(d => d.archived_at).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Document Register</h3>
          <p className="text-xs text-muted-foreground">
            {totalDocs} active document{totalDocs !== 1 ? 's' : ''}
            {archivedCount > 0 && !showArchived && ` · ${archivedCount} archived`}
          </p>
        </div>
        <Button
          variant={showArchived ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
        >
          <Filter className="h-3.5 w-3.5 mr-1.5" />
          {showArchived ? 'Showing All' : 'Active Only'}
        </Button>
      </div>

      {/* Grouped document list */}
      {RIDE_DOC_GROUP_ORDER.map(type => {
        const docs = grouped[type];
        if (docs.length === 0) return null;

        const isOpen = expandedGroups[type] !== false; // default open
        const activeDocs = docs.filter(d => !d.archived_at);
        const archivedDocs = docs.filter(d => d.archived_at);
        const displayDocs = showArchived ? docs : activeDocs;

        return (
          <Collapsible
            key={type}
            open={isOpen}
            onOpenChange={() => toggleGroup(type)}
          >
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/50 transition-colors text-left">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{RIDE_DOC_TYPE_ICONS[type]}</span>
                  <span className="font-semibold text-sm">{RIDE_DOC_TYPE_LABELS[type]}</span>
                  <Badge variant="secondary" className="text-xs">
                    {displayDocs.length}
                  </Badge>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-1">
              {displayDocs.map(doc => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  onView={() => handleViewPdf(doc)}
                  onVersions={() => handleShowVersions(doc)}
                  onArchive={() => setArchiveDialogDoc(doc)}
                  onRestore={() => handleRestore(doc)}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      {totalDocs === 0 && !showArchived && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No system-generated documents yet. Documents will appear here when you generate PDFs (checks, reports, assessments, etc.).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Version History Dialog */}
      <Dialog open={!!versionDialogDoc} onOpenChange={() => setVersionDialogDoc(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>
              {versionDialogDoc?.document_id}
            </DialogDescription>
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
                    {v.status === 'active' && (
                      <Badge variant="default" className="text-[10px]">Active</Badge>
                    )}
                    {v.status === 'superseded' && (
                      <Badge variant="secondary" className="text-[10px]">Superseded</Badge>
                    )}
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
            <DialogDescription>
              This document will be hidden from the default view but not deleted.
            </DialogDescription>
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

/* ── Individual document row ── */
function DocumentRow({
  doc,
  onView,
  onVersions,
  onArchive,
  onRestore,
}: {
  doc: RideDocument;
  onView: () => void;
  onVersions: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const isArchived = !!doc.archived_at;
  const meta = doc.metadata || {};

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ml-2 ${
        isArchived ? 'border-border/50 bg-muted/30 opacity-70' : 'border-border bg-card'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{doc.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground">
            {format(parseISO(doc.created_at), 'dd MMM yyyy HH:mm')}
          </span>
          <span className="text-[11px] text-muted-foreground">
            · {doc.document_id} v{doc.version}
          </span>
          {isArchived && (
            <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
              Archived
            </Badge>
          )}
          {meta.certificateReference && (
            <span className="text-[11px] text-muted-foreground">
              · Ref: {meta.certificateReference}
            </span>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onView}>
            <Eye className="h-4 w-4 mr-2" /> View PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onVersions}>
            <History className="h-4 w-4 mr-2" /> Version History
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isArchived ? (
            <DropdownMenuItem onClick={onRestore}>
              <RotateCcw className="h-4 w-4 mr-2" /> Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="h-4 w-4 mr-2" /> Archive
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default RideDocumentRegister;
