import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, AlertTriangle, Download } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfJsViewerProps {
  url: string;
  title?: string;
  onError?: (message: string) => void;
  onLoad?: () => void;
  className?: string;
}

const PdfJsViewer = ({ url, title, onError, onLoad, className = '' }: PdfJsViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // Load PDF document
  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const doc = await pdfjsLib.getDocument({ url, disableAutoFetch: false }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        onLoad?.();
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load PDF';
        setError(message);
        onError?.(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    // Cancel any in-progress render
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
      renderTaskRef.current = null;
    }

    try {
      const page = await pdfDoc.getPage(currentPage);
      const containerWidth = containerRef.current.clientWidth;

      // Calculate scale to fit width
      const unscaledViewport = page.getViewport({ scale: 1 });
      const fitScale = (containerWidth - 32) / unscaledViewport.width; // 32px padding
      const effectiveScale = fitScale * scale;
      const viewport = page.getViewport({ scale: effectiveScale });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Use devicePixelRatio for sharp rendering
      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.scale(dpr, dpr);

      const renderTask = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = renderTask;
      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err: any) {
      if (err?.name === 'RenderingCancelledException') return;
      console.warn('[PdfJsViewer] render error:', err);
    }
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Re-render on resize
  useEffect(() => {
    const observer = new ResizeObserver(() => renderPage());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [renderPage]);

  const goToPrev = () => setCurrentPage(p => Math.max(1, p - 1));
  const goToNext = () => setCurrentPage(p => Math.min(totalPages, p + 1));
  const zoomIn = () => setScale(s => Math.min(3, s + 0.25));
  const zoomOut = () => setScale(s => Math.max(0.5, s - 0.25));

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = title || 'document.pdf';
    a.click();
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full bg-background ${className}`}>
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading document…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full bg-background ${className}`}>
        <div className="text-center space-y-3 max-w-xs px-4">
          <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
          <p className="text-sm font-semibold text-foreground">Could not display PDF</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Download instead
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50 shrink-0">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrev} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums min-w-[5rem] text-center">
            {currentPage} / {totalPages}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNext} disabled={currentPage >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} disabled={scale <= 0.5}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} disabled={scale >= 3}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <div className="flex justify-center p-4">
          <canvas ref={canvasRef} className="shadow-md" />
        </div>
      </div>
    </div>
  );
};

export default PdfJsViewer;
