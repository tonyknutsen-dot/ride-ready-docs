import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FolderPlus, Loader2, CheckCircle2, Eye, Link2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { downloadBlob } from '@/utils/exportFileActions';
import { openDocumentById } from '@/utils/documentOpen';
import QuickSendDialog from '@/components/QuickSendDialog';

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
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  // For auto-save-then-act flows
  const [autoSaving, setAutoSaving] = useState(false);

  if (!result) return null;

  /** Save to documents and return the doc ID */
  const ensureSaved = async (): Promise<string | null> => {
    if (savedDocId) return savedDocId;
    if (!result.onSaveToDocuments) return null;

    setAutoSaving(true);
    try {
      const docId = await result.onSaveToDocuments();
      const id = docId && typeof docId === 'string' ? docId : null;
      if (id) {
        setSaved(true);
        setSavedDocId(id);
      }
      return id;
    } catch (err) {
      console.error('Auto-save failed:', err);
      toast({ title: 'Save failed', description: 'Could not save the document first', variant: 'destructive' });
      return null;
    } finally {
      setAutoSaving(false);
    }
  };

  const handleView = async () => {
    onOpenChange(false);
    const fileUrl = URL.createObjectURL(result.blob);
    navigate('/viewer', {
      state: {
        fileUrl,
        fileName: result.fileName,
        mimeType: result.blob.type || null,
        temporary: true,
      },
    });
  };

  const handleDownload = () => {
    downloadBlob(result.blob, result.fileName);
    toast({ title: 'Downloaded', description: result.fileName });
  };

  const handleSend = async () => {
    const docId = await ensureSaved();
    if (docId) {
      setSendDialogOpen(true);
    } else {
      toast({ title: 'Cannot send', description: 'Save the document first to send it', variant: 'destructive' });
    }
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
    void openDocumentById({
      documentId: savedDocId,
      navigate,
      sourceComponent: 'ExportActionsDialog',
      toast,
    });
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
      setAutoSaving(false);
    }
    onOpenChange(nextOpen);
  };

  const isLoading = saving || autoSaving;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-0">
            <DialogTitle className="text-base">{saved ? 'Saved to Documents' : 'Export ready'}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground truncate">
              {result.fileName}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5 pt-1">
            {/* ── Pre-save actions ── */}
            {!saved && (
              <>
                <ActionRow icon={Eye} label="View" hint="Open the report now without saving" onClick={handleView} loading={autoSaving} accent />
                <ActionRow icon={Download} label="Save to Device" hint="Download a copy to your device" onClick={handleDownload} />
                <ActionRow icon={Send} label="Send" hint="Share via email or your device's share menu" onClick={handleSend} loading={autoSaving} />

                {result.onSaveToDocuments && (
                  <>
                    <div className="border-t border-border my-0.5" />
                    {result.saveHint && (
                      <p className="text-[11px] text-muted-foreground text-center px-2 py-0.5">
                        {result.saveHint}
                      </p>
                    )}
                    <ActionRow
                      icon={FolderPlus}
                      label={result.saveLabel || 'Save to Documents'}
                      hint="Store inside the app's document register"
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
                <div className="flex items-center gap-3 py-2 px-1">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Report saved successfully</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {result.saveHint || 'Available in your document register.'}
                    </p>
                  </div>
                </div>

                {savedDocId && (
                  <ActionRow icon={Eye} label="View Saved Document" hint="Open the saved report" onClick={handleViewSavedDocument} accent />
                )}
                <ActionRow icon={Download} label="Save to Device" hint="Download a copy to your device" onClick={handleDownload} />
                {savedDocId && (
                  <ActionRow icon={Send} label="Send" hint="Share via email or your device's share menu" onClick={() => setSendDialogOpen(true)} />
                )}
                {savedDocId && (
                  <ActionRow icon={Link2} label="Copy Link" hint="Copy a link to this saved document" onClick={handleCopyLink} loading={copyingLink} />
                )}

                <Button
                  variant="outline"
                  className="w-full h-9 text-sm mt-1"
                  onClick={() => handleClose(false)}
                >
                  Done
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick send dialog */}
      {savedDocId && (
        <QuickSendDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          documentIds={[savedDocId]}
          documentName={result.fileName}
        />
      )}
    </>
  );
};

/** Compact action row — icon + label + optional helper text */
function ActionRow({
  icon: Icon,
  label,
  hint,
  onClick,
  loading,
  disabled,
  accent,
}: {
  icon: typeof Download;
  label: string;
  hint?: string;
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
        'flex items-center gap-3 w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
        'hover:bg-muted/50 active:bg-muted/70 disabled:opacity-60',
        accent && !disabled && 'border-primary/30 bg-primary/5',
        disabled && 'cursor-default',
      )}
    >
      <div className={cn(
        'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
        accent && !disabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        disabled && 'text-primary bg-primary/10',
      )}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{hint}</p>}
      </div>
    </button>
  );
}

export default ExportActionsDialog;
