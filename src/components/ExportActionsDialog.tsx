import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FolderPlus, Loader2, CheckCircle2, Eye, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { downloadBlob } from '@/utils/exportFileActions';
import PDFViewer from '@/components/PDFViewer';
import ShareMenuPopover from '@/components/ShareMenuPopover';

export interface ExportResult {
  blob: Blob;
  fileName: string;
  /** If provided, enables "Save to Documents". Return the document row ID to enable View. */
  onSaveToDocuments?: () => Promise<string | void>;
  /** Label override for save button */
  saveLabel?: string;
  /** Helper text explaining where the document will be saved */
  saveHint?: string;
}

interface ExportActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: ExportResult | null;
}

const ExportActionsDialog = ({ open, onOpenChange, result }: ExportActionsDialogProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [copyingLink, setCopyingLink] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  if (!result) return null;

  const handleView = () => {
    const normalizedBlob =
      result.blob.type === 'application/pdf'
        ? result.blob
        : new Blob([result.blob], { type: 'application/pdf' });
    const url = URL.createObjectURL(normalizedBlob);
    setBlobUrl(url);
    setViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setViewerOpen(false);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
  };

  const handleDownload = () => {
    downloadBlob(result.blob, result.fileName);
    toast({ title: 'Downloaded', description: result.fileName });
  };

  const handleSaveToDocuments = async () => {
    if (!result.onSaveToDocuments || saving || saved) return;
    setSaving(true);
    try {
      const docId = await result.onSaveToDocuments();
      setSaved(true);
      if (docId && typeof docId === 'string') {
        setSavedDocId(docId);
      }
      toast({ title: 'Saved to Documents', description: result.saveHint || 'Report added to your document register' });
    } catch (err) {
      console.error('Failed to save to documents:', err);
      toast({ title: 'Failed to save', description: 'Could not save to documents', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleViewSavedDocument = () => {
    if (!savedDocId) return;
    onOpenChange(false);
    navigate(`/documents/${savedDocId}`);
  };

  const handleCopyLink = async () => {
    if (!savedDocId) return;
    setCopyingLink(true);
    try {
      const link = `${window.location.origin}/documents/${savedDocId}`;
      await navigator.clipboard.writeText(link);
      toast({ title: 'Link copied', description: 'Document link copied to clipboard' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    } finally {
      setCopyingLink(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSaved(false);
      setSaving(false);
      setSavedDocId(null);
      handleCloseViewer();
    }
    onOpenChange(nextOpen);
  };

  const savedDocLink = savedDocId ? `${window.location.origin}/documents/${savedDocId}` : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{saved ? 'Saved to Documents' : 'Export ready'}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground truncate">
              {result.fileName}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 pt-2">
            {/* ── Pre-save actions ── */}
            {!saved && (
              <>
                <ActionButton icon={Eye} label="View" description="Read this report inside the app" onClick={handleView} accent />
                <ActionButton icon={Download} label="Save to Device" description="Download file to your phone or laptop" onClick={handleDownload} />

                <ShareMenuPopover blob={result.blob} fileName={result.fileName} />

                {result.onSaveToDocuments && (
                  <>
                    <div className="border-t border-border my-1" />
                    {result.saveHint && (
                      <p className="text-[11px] text-muted-foreground text-center px-2 py-1">
                        {result.saveHint}
                      </p>
                    )}
                    <ActionButton
                      icon={FolderPlus}
                      label={result.saveLabel || 'Save to Documents'}
                      description="Saves this report inside RideReadyDocs for later access"
                      onClick={handleSaveToDocuments}
                      loading={saving}
                    />
                  </>
                )}
              </>
            )}

            {/* ── Post-save success state ── */}
            {saved && (
              <>
                <div className="flex flex-col items-center py-3 gap-2">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Report saved successfully</p>
                  <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                    {result.saveHint || 'This report is now in your document register and can be viewed anytime.'}
                  </p>
                </div>

                {savedDocId && (
                  <ActionButton
                    icon={Eye}
                    label="View Saved Document"
                    description="Open in the document viewer"
                    onClick={handleViewSavedDocument}
                    accent
                  />
                )}

                <ActionButton
                  icon={Download}
                  label="Save to Device"
                  description="Also download a copy to your phone or laptop"
                  onClick={handleDownload}
                />

                <ShareMenuPopover blob={result.blob} fileName={result.fileName} documentLink={savedDocLink} />

                {savedDocId && (
                  <ActionButton icon={Link2} label="Copy Link" description="Copy document link to clipboard" onClick={handleCopyLink} loading={copyingLink} />
                )}

                <div className="pt-1">
                  <Button
                    variant="outline"
                    className="w-full h-10 text-sm"
                    onClick={() => handleClose(false)}
                  >
                    Done
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* In-app PDF viewer modal for pre-save View */}
      {blobUrl && (
        <PDFViewer
          isOpen={viewerOpen}
          onClose={handleCloseViewer}
          pdfUrl={blobUrl}
          pdfName={result.fileName}
          onDownload={handleDownload}
        />
      )}
    </>
  );
};

function ActionButton({
  icon: Icon,
  label,
  description,
  onClick,
  loading,
  disabled,
  accent,
}: {
  icon: typeof Download;
  label: string;
  description: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-left transition-colors',
        'hover:bg-muted/50 active:bg-muted/70 disabled:opacity-60',
        accent && !disabled && 'border-primary/30 bg-primary/5',
        disabled && 'cursor-default',
      )}
    >
      <div className={cn(
        'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
        accent && !disabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        disabled && 'text-primary bg-primary/10',
      )}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

export default ExportActionsDialog;
