import { useState, useEffect, useCallback, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Download, Share2, ExternalLink, X, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  downloadBlob,
  getStorageFileBlob,
  shareBlobOrFallback,
  shareStoredFileOrFallback,
  isLikelyMobileOrTablet,
  revokeObjectUrl,
} from '@/utils/exportFileActions';
import { useToast } from '@/hooks/use-toast';

/* ─── Public API ─── */

export interface DocumentPreviewSource {
  /** Display name */
  name: string;
  /** Either a ready blob OR a storage path — provide one */
  blob?: Blob;
  storagePath?: string;
  /** Optional metadata shown beneath the title */
  meta?: string;
}

interface DocumentPreviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: DocumentPreviewSource | null;
}

/* ─── Component ─── */

const PREVIEW_TIMEOUT_MS = 6000;

const DocumentPreviewSheet = ({ open, onOpenChange, source }: DocumentPreviewSheetProps) => {
  const { toast } = useToast();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [downloading, setDownloading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const blobRef = useRef<Blob | null>(null);

  const isPdf = source
    ? (source.blob?.type === 'application/pdf' || (source.name || '').toLowerCase().endsWith('.pdf'))
    : false;

  /* ─── Load blob & create object URL ─── */
  useEffect(() => {
    if (!open || !source) return;

    let cancelled = false;

    const load = async () => {
      setPreviewStatus('loading');

      try {
        let blob: Blob;

        if (source.blob) {
          blob = source.blob;
        } else if (source.storagePath) {
          blob = await getStorageFileBlob(source.storagePath);
        } else {
          setPreviewStatus('failed');
          return;
        }

        if (cancelled) return;

        // Normalise PDF mime type
        if (isPdf && blob.type !== 'application/pdf') {
          blob = new Blob([blob], { type: 'application/pdf' });
        }

        blobRef.current = blob;
        const url = URL.createObjectURL(blob);

        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });

        if (isPdf) {
          // Give the iframe time to render; if it doesn't trigger onLoad, fall back
          timeoutRef.current = setTimeout(() => {
            if (!cancelled) setPreviewStatus((s) => (s === 'loading' ? 'failed' : s));
          }, PREVIEW_TIMEOUT_MS);
        } else {
          // Non-PDF — go straight to fallback actions (no embed preview)
          setPreviewStatus('failed');
        }
      } catch (err) {
        console.error('[DocumentPreview] load error', err);
        if (!cancelled) setPreviewStatus('failed');
      }
    };

    load();

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [open, source, isPdf]);

  /* ─── Cleanup on close ─── */
  useEffect(() => {
    if (!open) {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPreviewStatus('loading');
      blobRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [open]);

  const handleIframeLoad = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPreviewStatus('ready');
  }, []);

  const handleIframeError = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPreviewStatus('failed');
  }, []);

  /* ─── Actions ─── */
  const getBlob = async (): Promise<Blob> => {
    if (blobRef.current) return blobRef.current;
    if (source?.blob) return source.blob;
    if (source?.storagePath) return getStorageFileBlob(source.storagePath);
    throw new Error('No file source available');
  };

  const handleDownload = async () => {
    if (!source) return;
    setDownloading(true);
    try {
      const blob = await getBlob();
      downloadBlob(blob, source.name);
      toast({ title: 'Downloaded', description: source.name });
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!source) return;
    try {
      if (source.storagePath) {
        const result = await shareStoredFileOrFallback(source.storagePath, source.name);
        if (result === 'copied') toast({ title: 'Link copied', description: 'Signed link valid for 1 hour.' });
        else if (result === 'downloaded') toast({ title: 'Downloaded', description: 'File downloaded as share fallback.' });
      } else if (source.blob) {
        const result = await shareBlobOrFallback(source.blob, source.name);
        if (result === 'downloaded') toast({ title: 'Downloaded', description: 'File downloaded as share fallback.' });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast({ title: 'Share failed', variant: 'destructive' });
      }
    }
  };

  const handleOpenExternal = async () => {
    if (!source) return;
    try {
      const blob = await getBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Revoke after a delay to give the new tab time to load
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      toast({ title: 'Could not open file', variant: 'destructive' });
    }
  };

  if (!source) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[95vh] p-0 rounded-t-2xl flex flex-col">
        {/* ─── Header ─── */}
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-sm font-semibold truncate">{source.name}</SheetTitle>
              {source.meta && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{source.meta}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* ─── Preview area ─── */}
        <div className="flex-1 min-h-0 relative bg-muted/30">
          {/* Loading state */}
          {previewStatus === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading preview…</p>
            </div>
          )}

          {/* PDF iframe (hidden when failed) */}
          {isPdf && blobUrl && previewStatus !== 'failed' && (
            <iframe
              ref={iframeRef}
              src={blobUrl}
              className={cn(
                'w-full h-full border-0',
                previewStatus === 'loading' && 'opacity-0',
                previewStatus === 'ready' && 'opacity-100',
              )}
              title={source.name}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          )}

          {/* Fallback state */}
          {previewStatus === 'failed' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                {isPdf ? (
                  <FileText className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isPdf ? 'Preview unavailable' : 'No in-app preview for this file type'}
                </p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  You can still open it, save it to your device, or share it.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button onClick={handleOpenExternal} className="gap-2 h-11">
                  <ExternalLink className="h-4 w-4" /> Open file
                </Button>
                <Button variant="outline" onClick={handleDownload} disabled={downloading} className="gap-2 h-11">
                  <Download className="h-4 w-4" /> Save to device
                </Button>
                <Button variant="outline" onClick={handleShare} className="gap-2 h-11">
                  <Share2 className="h-4 w-4" /> Share
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Bottom action bar (visible when preview IS working) ─── */}
        {previewStatus === 'ready' && (
          <div className="shrink-0 border-t border-border px-4 py-3 flex items-center gap-2 bg-background">
            <Button variant="outline" size="sm" onClick={handleOpenExternal} className="gap-1.5 flex-1 h-10 text-[12px]">
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading} className="gap-1.5 flex-1 h-10 text-[12px]">
              <Download className="h-3.5 w-3.5" /> Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5 flex-1 h-10 text-[12px]">
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default DocumentPreviewSheet;
