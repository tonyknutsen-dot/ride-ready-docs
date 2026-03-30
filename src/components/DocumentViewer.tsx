/**
 * Unified full-screen document viewer for the entire app.
 * Handles PDFs (via pdf.js canvas), images (with pinch/zoom/pan),
 * and falls back to download for unsupported file types.
 */
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/* ─── Types ─── */
export type ViewableFileType = 'pdf' | 'image' | 'unsupported';

export interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  fileType: ViewableFileType;
  onDownload: () => void;
}

export function detectFileType(filePathOrName: string): ViewableFileType {
  const lc = (filePathOrName || '').toLowerCase();
  if (lc.endsWith('.pdf')) return 'pdf';
  if (/\.(jpg|jpeg|png|gif|webp|bmp|tiff?|svg)$/i.test(lc)) return 'image';
  return 'unsupported';
}

/* ─── Constants ─── */
const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const MOBILE_BP = 640;

/* ─── Component ─── */
const DocumentViewer = ({ isOpen, onClose, fileUrl, fileName, fileType, onDownload }: DocumentViewerProps) => {
  // Parse doc-id prefix from fileName
  const docIdMatch = fileName?.match(/^([A-Z0-9]+-[A-Z]{2,3}-\d{4}-\d{4})\s*[–—-]\s*/);
  const docId = docIdMatch ? docIdMatch[1] : null;
  const displayName = docId ? fileName.slice(docIdMatch![0].length) : fileName;

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[100vw] w-[100vw] h-[100dvh] sm:max-w-5xl sm:w-full sm:h-[95vh] sm:max-h-[95vh] p-0 overflow-hidden rounded-none sm:rounded-xl border-0 sm:border sm:border-border shadow-none sm:shadow-xl [&>button.absolute]:hidden"
        aria-describedby={undefined}
      >
        <VisuallyHidden>
          <DialogTitle>{fileName}</DialogTitle>
        </VisuallyHidden>

        <div className="flex flex-col h-full bg-background">
          {/* Compact header */}
          <div className="flex items-center justify-between gap-2 px-2 py-1 sm:px-3 sm:py-1.5 border-b border-border/60 bg-card/90 backdrop-blur-sm shrink-0">
            <div className="min-w-0 flex-1">
              {docId ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[10px] font-semibold text-primary bg-primary/8 px-1.5 py-0.5 rounded shrink-0">
                    {docId}
                  </span>
                  <span className="text-[11px] sm:text-xs text-muted-foreground truncate">{displayName}</span>
                </div>
              ) : (
                <h3 className="text-[11px] sm:text-xs font-medium text-foreground truncate">{displayName}</h3>
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onDownload} title="Save to Device">
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleClose} title="Close">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 min-h-0">
            {fileType === 'pdf' && <PdfContent src={fileUrl} onDownload={onDownload} />}
            {fileType === 'image' && <ImageContent src={fileUrl} alt={fileName} onDownload={onDownload} />}
            {fileType === 'unsupported' && <UnsupportedContent fileName={fileName} onDownload={onDownload} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ══════════════════════════════════════════════
   PDF Content — canvas-based pdf.js renderer
   ══════════════════════════════════════════════ */
function PdfContent({ src, onDownload }: { src: string; onDownload?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const renderTasksRef = useRef<Map<number, any>>(new Map());
  const scaleComputedRef = useRef(false);

  // Load PDF
  useEffect(() => {
    if (!src) { setLoading(false); setError('No source'); return; }
    let cancelled = false;
    setLoading(true); setError(null); setPdfDoc(null); setPages([]);
    setScale(null); scaleComputedRef.current = false;

    (async () => {
      try {
        const doc = await pdfjsLib.getDocument({
          url: src,
          cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) { setError(err?.message || 'Failed to load'); setLoading(false); }
      }
    })();

    return () => { cancelled = true; renderTasksRef.current.forEach(t => { try { t.cancel(); } catch {} }); renderTasksRef.current.clear(); };
  }, [src]);

  // Compute fit-to-width scale once PDF + container are ready
  useEffect(() => {
    if (!pdfDoc || scaleComputedRef.current) return;
    let cancelled = false;

    // Wait for layout to settle — critical for mobile dialogs
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      try {
        const page = await pdfDoc.getPage(1);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        const isMobile = window.innerWidth < MOBILE_BP;

        // Use window width as the source of truth on mobile — container may not have settled
        const containerW = containerRef.current?.clientWidth;
        const usableWidth = isMobile
          ? window.innerWidth - 4
          : Math.max((containerW && containerW > 50 ? containerW : window.innerWidth) - 24, 200);

        const fitScale = usableWidth / viewport.width;
        const minScale = isMobile ? 1.0 : MIN_ZOOM;
        scaleComputedRef.current = true;
        setScale(Math.max(minScale, Math.min(MAX_ZOOM, fitScale)));
      } catch {
        scaleComputedRef.current = true;
        setScale(1);
      }
    }, 150);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [pdfDoc]);

  // Render all pages when scale changes
  useEffect(() => {
    if (!pdfDoc || scale === null) return;
    let cancelled = false;
    const dpr = window.devicePixelRatio || 1;

    (async () => {
      const canvases: HTMLCanvasElement[] = [];
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        if (cancelled) break;
        try {
          const page = await pdfDoc.getPage(i);
          const vp = page.getViewport({ scale: scale * dpr });
          const dvp = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width; canvas.height = vp.height;
          canvas.style.width = `${dvp.width}px`; canvas.style.height = `${dvp.height}px`;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          const prev = renderTasksRef.current.get(i);
          if (prev) try { prev.cancel(); } catch {}
          const task = page.render({ canvasContext: ctx, viewport: vp });
          renderTasksRef.current.set(i, task);
          await task.promise;
          renderTasksRef.current.delete(i);
          if (!cancelled) canvases.push(canvas);
        } catch (err: any) {
          if (err?.name === 'RenderingCancelledException') continue;
        }
      }
      if (!cancelled) setPages(canvases);
    })();

    return () => { cancelled = true; };
  }, [pdfDoc, scale]);

  // Attach canvases to DOM
  useEffect(() => {
    const el = pagesRef.current;
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    pages.forEach((canvas, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'mx-auto bg-white overflow-hidden sm:rounded sm:shadow-sm mb-0.5 sm:mb-2 max-w-full';
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';
      canvas.style.display = 'block';
      wrapper.appendChild(canvas);
      if (totalPages > 1) {
        const label = document.createElement('div');
        label.className = 'hidden sm:block text-center text-[10px] text-muted-foreground py-0.5 bg-white/80';
        label.textContent = `${idx + 1} / ${totalPages}`;
        wrapper.appendChild(label);
      }
      el.appendChild(wrapper);
    });
  }, [pages, totalPages]);

  const zoomIn = useCallback(() => setScale(s => Math.min((s ?? 1) + ZOOM_STEP, MAX_ZOOM)), []);
  const zoomOut = useCallback(() => setScale(s => Math.max((s ?? 1) - ZOOM_STEP, MIN_ZOOM)), []);

  if (loading || scale === null) {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center space-y-2 max-w-xs">
          <p className="text-sm font-medium">Unable to render PDF</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          {onDownload && (
            <Button variant="outline" size="sm" onClick={onDownload} className="gap-2 mt-2">
              <Download className="h-3.5 w-3.5" /> Save to Device
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Zoom toolbar */}
      <div className="flex items-center justify-center gap-1 py-0.5 px-1 border-b border-border/40 bg-muted/20 shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={zoomOut} disabled={scale <= MIN_ZOOM}>
          <ZoomOut className="h-3 w-3" />
        </Button>
        <span className="text-[10px] font-medium text-muted-foreground min-w-[2.5rem] text-center tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={zoomIn} disabled={scale >= MAX_ZOOM}>
          <ZoomIn className="h-3 w-3" />
        </Button>
        <span className="text-[10px] text-muted-foreground tabular-nums ml-1">
          {totalPages} pg{totalPages !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Scrollable pages */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-background sm:bg-muted/10 p-0 sm:p-2 touch-manipulation">
        <div ref={pagesRef} className="flex flex-col items-center w-full" />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Image Content — with zoom/pan/pinch
   ══════════════════════════════════════════════ */
function ImageContent({ src, alt, onDownload }: { src: string; alt: string; onDownload?: () => void }) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const zoomIn = () => setScale(s => Math.min(s + ZOOM_STEP, MAX_ZOOM));
  const zoomOut = () => { setScale(s => { const ns = Math.max(s - ZOOM_STEP, 1); if (ns <= 1) setTranslate({ x: 0, y: 0 }); return ns; }); };
  const resetZoom = () => { setScale(1); setTranslate({ x: 0, y: 0 }); };

  // Pointer drag for panning when zoomed
  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTranslate(t => ({ x: t.x + dx, y: t.y + dy }));
  };
  const onPointerUp = () => { isDragging.current = false; };

  return (
    <div className="flex flex-col h-full">
      {/* Zoom toolbar */}
      <div className="flex items-center justify-center gap-1 py-0.5 px-1 border-b border-border/40 bg-muted/20 shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={zoomOut} disabled={scale <= 1}>
          <ZoomOut className="h-3 w-3" />
        </Button>
        <span className="text-[10px] font-medium text-muted-foreground min-w-[2.5rem] text-center tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={zoomIn} disabled={scale >= MAX_ZOOM}>
          <ZoomIn className="h-3 w-3" />
        </Button>
        {scale > 1 && (
          <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={resetZoom} title="Reset zoom">
            <RotateCw className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Image with pan */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden flex items-center justify-center bg-muted/20 touch-manipulation cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging.current ? 'none' : 'transform 0.15s ease-out',
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Unsupported Content — download fallback
   ══════════════════════════════════════════════ */
function UnsupportedContent({ fileName, onDownload }: { fileName: string; onDownload: () => void }) {
  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="text-center space-y-3 max-w-xs">
        <p className="text-sm font-medium">Preview not available</p>
        <p className="text-xs text-muted-foreground">
          This file type cannot be previewed in the app. You can download it to view on your device.
        </p>
        <Button variant="outline" size="sm" onClick={onDownload} className="gap-2">
          <Download className="h-3.5 w-3.5" /> Download {fileName}
        </Button>
      </div>
    </div>
  );
}

export default DocumentViewer;
