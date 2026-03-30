/**
 * PDF.js canvas-based PDF renderer.
 * Replaces all iframe/object/embed PDF rendering for reliable cross-browser viewing.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, FileText, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfCanvasViewerProps {
  src: string | null;
  onDownload?: () => void;
  className?: string;
  /** When true, auto-calculate scale to fit container width on first load */
  fitWidth?: boolean;
}

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const MOBILE_MIN_FIT_SCALE = 0.85; // Never open smaller than this on mobile

const PdfCanvasViewer = ({ src, onDownload, className, fitWidth }: PdfCanvasViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<number | null>(null); // null = not yet computed
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const renderTasksRef = useRef<Map<number, any>>(new Map());
  const fitWidthComputed = useRef(false);

  // Load the PDF document
  useEffect(() => {
    if (!src) {
      setLoading(false);
      setError('No document source provided');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdfDoc(null);
    setPages([]);
    setScale(null);
    fitWidthComputed.current = false;

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: src,
          cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (cancelled) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        console.error('PDF.js load error:', err);
        setError(err?.message || 'Failed to load PDF');
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      renderTasksRef.current.forEach(task => {
        try { task.cancel(); } catch {}
      });
      renderTasksRef.current.clear();
    };
  }, [src]);

  // Compute fit-width scale once doc loads
  useEffect(() => {
    if (!pdfDoc || fitWidthComputed.current) return;

    const computeFitWidth = async () => {
      if (!fitWidth) {
        fitWidthComputed.current = true;
        setScale(1);
        return;
      }

      try {
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1 });

        // Try multiple width sources — dialog may not have laid out containerRef yet
        let availableWidth = 0;
        if (containerRef.current && containerRef.current.clientWidth > 50) {
          availableWidth = containerRef.current.clientWidth - 16;
        } else {
          // Fallback: use viewport width minus modal chrome (padding, borders)
          availableWidth = window.innerWidth - 24;
        }

        const fitScale = availableWidth / viewport.width;
        // On mobile, never open unreadably small
        const isMobile = window.innerWidth < 640;
        const minScale = isMobile ? MOBILE_MIN_FIT_SCALE : MIN_ZOOM;
        const clampedScale = Math.max(minScale, Math.min(MAX_ZOOM, fitScale));

        fitWidthComputed.current = true;
        setScale(clampedScale);
      } catch {
        fitWidthComputed.current = true;
        setScale(1);
      }
    };

    // Wait for dialog layout to settle before measuring
    const timer = setTimeout(computeFitWidth, 80);
  }, [pdfDoc, fitWidth]);

  // Render all pages when doc or scale changes
  useEffect(() => {
    if (!pdfDoc || scale === null) return;

    let cancelled = false;
    const devicePixelRatio = window.devicePixelRatio || 1;

    const renderPages = async () => {
      const canvases: HTMLCanvasElement[] = [];

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        if (cancelled) break;

        try {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: scale * devicePixelRatio });
          const displayViewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${displayViewport.width}px`;
          canvas.style.height = `${displayViewport.height}px`;

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          const prevTask = renderTasksRef.current.get(i);
          if (prevTask) {
            try { prevTask.cancel(); } catch {}
          }

          const renderTask = page.render({
            canvasContext: ctx,
            viewport,
          });

          renderTasksRef.current.set(i, renderTask);

          await renderTask.promise;
          renderTasksRef.current.delete(i);

          if (!cancelled) {
            canvases.push(canvas);
          }
        } catch (err: any) {
          if (err?.name === 'RenderingCancelledException') continue;
          console.warn(`Failed to render page ${i}:`, err);
        }
      }

      if (!cancelled) {
        setPages(canvases);
      }
    };

    renderPages();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, scale]);

  // Mount canvases into the DOM
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    pages.forEach((canvas, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'mx-auto bg-white rounded overflow-hidden shadow-sm mb-2 max-w-full';
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';
      canvas.style.display = 'block';
      wrapper.appendChild(canvas);

      const label = document.createElement('div');
      label.className = 'text-center text-[10px] text-muted-foreground py-1 bg-white/80';
      label.textContent = `${idx + 1} / ${totalPages}`;
      wrapper.appendChild(label);

      container.appendChild(wrapper);
    });
  }, [pages, totalPages]);

  const handleZoomIn = useCallback(() => {
    setScale(s => Math.min((s ?? 1) + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(s => Math.max((s ?? 1) - ZOOM_STEP, MIN_ZOOM));
  }, []);

  if (loading || scale === null) {
    return (
      <div ref={containerRef} className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center space-y-2">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading document…</p>
        </div>
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center space-y-3 max-w-xs px-4">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">Unable to render PDF</p>
          <p className="text-xs text-muted-foreground">{error || 'No document available'}</p>
          {onDownload && (
            <Button variant="outline" size="sm" onClick={onDownload} className="gap-2 mt-2">
              <Download className="h-3.5 w-3.5" /> Save to Device instead
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Compact toolbar */}
      <div className="flex items-center justify-center gap-1 py-1.5 px-2 border-b border-border/40 bg-muted/20 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} disabled={scale <= MIN_ZOOM}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[10px] font-medium text-muted-foreground min-w-[2.5rem] text-center tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} disabled={scale >= MAX_ZOOM}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[10px] text-muted-foreground tabular-nums ml-1">
          {totalPages} pg{totalPages !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Scrollable pages */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-muted/10 p-2">
        <div ref={pagesContainerRef} className="flex flex-col items-center" />
      </div>
    </div>
  );
};

export default PdfCanvasViewer;