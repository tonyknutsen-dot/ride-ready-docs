import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Eye, Download, Share2, FolderPlus, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import PDFViewer from '@/components/PDFViewer';
import { isLikelyMobileOrTablet, shareBlobOrFallback, downloadBlob } from '@/utils/exportFileActions';

export interface ExportResult {
  blob: Blob;
  fileName: string;
  /** If provided, enables "Save to Documents" */
  onSaveToDocuments?: () => Promise<void>;
  /** Label override for save button (e.g. "Save to Asset Documents" vs "Save as Global Document") */
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Stable blob URL that only changes when the blob changes
  const objectUrl = useMemo(() => {
    if (!result) return '';
    return URL.createObjectURL(result.blob);
  }, [result?.blob]);

  // Clean up blob URL when it changes or unmounts
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  if (!result) return null;

  const isPdf = result.blob.type === 'application/pdf' || result.fileName.toLowerCase().endsWith('.pdf');

  const handleView = () => {
    if (isPdf) {
      setPreviewOpen(true);
      return;
    }
    // Non-PDF files (e.g. CSV) can't be previewed in-app — download instead
    handleDownload();
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: 'Downloaded', description: result.fileName });
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        const file = new File([result.blob], result.fileName, { type: result.blob.type });
        await navigator.share({ files: [file], title: result.fileName });
      } else {
        // Fallback: download
        handleDownload();
        toast({ title: 'Sharing not supported', description: 'File downloaded instead' });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        handleDownload();
      }
    }
  };

  const handleSaveToDocuments = async () => {
    if (!result.onSaveToDocuments || saving || saved) return;
    setSaving(true);
    try {
      await result.onSaveToDocuments();
      setSaved(true);
      toast({ title: 'Saved to Documents', description: 'Report added to your document register' });
    } catch (err) {
      console.error('Failed to save to documents:', err);
      toast({ title: 'Failed to save', description: 'Could not save to documents', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSaved(false);
      setSaving(false);
      setPreviewOpen(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Export ready</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground truncate">
              {result.fileName}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 pt-2">
            <ActionButton icon={Eye} label="View" description="Open in a new tab" onClick={handleView} />
            <ActionButton icon={Download} label="Download" description="Save file to your device" onClick={handleDownload} />
            <ActionButton icon={Share2} label="Share" description="Send via email or messaging" onClick={handleShare} />

            {result.onSaveToDocuments && (
              <>
                <div className="border-t border-border my-1" />
                {result.saveHint && (
                  <p className="text-[11px] text-muted-foreground text-center px-2 py-1">
                    {result.saveHint}
                  </p>
                )}
                <ActionButton
                  icon={saved ? CheckCircle2 : FolderPlus}
                  label={saved ? 'Saved to Documents' : (result.saveLabel || 'Save to Documents')}
                  description={saved ? 'Added to your document register' : 'Archive in your equipment documents'}
                  onClick={handleSaveToDocuments}
                  loading={saving}
                  disabled={saved}
                  accent={!saved}
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {isPdf && (
        <PDFViewer
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          pdfUrl={objectUrl}
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
  icon: typeof Eye;
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

