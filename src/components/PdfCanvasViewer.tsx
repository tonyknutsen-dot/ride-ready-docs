/**
 * PDF.js canvas-based PDF renderer.
 * Replaces all iframe/object/embed PDF rendering for reliable cross-browser viewing.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, FileText, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker from CDN (must match installed version)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfCanvasViewerProps {
  /** URL or blob URL for the PDF */
  src: string | null;
  /** Fallback download handler if rendering fails */
  onDownload?: () => void;
  /** Additional class for the container */
  className?: string;
}

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

const PdfCanvasViewer = ({ src, onDownload, className }: PdfCanvasViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const renderTasksRef = useRef<Map<number, any>>(new Map());

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

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: src,
          // Improve rendering on high-DPI displays
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
      // Cancel any in-progress render tasks
      renderTasksRef.current.forEach(task => {
        try { task.cancel(); } catch {}
      });
      renderTasksRef.current.clear();
    };
  }, [src]);

  // Render all pages when doc or scale changes
  useEffect(() => {
    if (!pdfDoc) return;

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

          // Cancel any previous render for this page
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
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    // Clear existing children
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    pages.forEach((canvas, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-page-wrapper mx-auto shadow-md bg-white mb-4 rounded overflow-hidden max-w-full';
      // Ensure canvas scales down on small screens
      canvas.style.maxWidth = '100%';
      canvas.style.height = 'auto';
      wrapper.appendChild(canvas);

      // Page number label
      const label = document.createElement('div');
      label.className = 'text-center text-[10px] text-muted-foreground py-1';
      label.textContent = `Page ${idx + 1} of ${totalPages}`;
      wrapper.appendChild(label);

      container.appendChild(wrapper);
    });
  }, [pages, totalPages]);

  const handleZoomIn = useCallback(() => {
    setScale(s => Math.min(s + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(s => Math.max(s - ZOOM_STEP, MIN_ZOOM));
  }, []);

  // ── Loading state ──
  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading document…</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error || !src) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center space-y-3 max-w-xs">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Unable to render PDF</p>
          <p className="text-xs text-muted-foreground">{error || 'No document available'}</p>
          {onDownload && (
            <Button variant="outline" onClick={onDownload} className="gap-2 mt-2">
              <Download className="h-4 w-4" /> Save to Device instead
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Rendered PDF ──
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-2 py-2 px-3 border-b border-border bg-card shrink-0">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleZoomOut} disabled={scale <= MIN_ZOOM}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-medium text-muted-foreground min-w-[3.5rem] text-center">
          {Math.round(scale * 100)}%
        </span>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleZoomIn} disabled={scale >= MAX_ZOOM}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground ml-2">
          {totalPages} page{totalPages !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Scrollable pages */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-muted/30 p-4">
        <div ref={pagesContainerRef} className="flex flex-col items-center" />
      </div>
    </div>
  );
};

export default PdfCanvasViewer;
