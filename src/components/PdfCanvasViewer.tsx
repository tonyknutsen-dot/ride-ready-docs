import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const PAGE_GUTTER_PX = 16;
const MIN_ZOOM_MULTIPLIER = 0.75;
const MAX_ZOOM_MULTIPLIER = 2.5;
const ZOOM_STEP = 0.2;

interface PdfCanvasViewerProps {
  className?: string;
  fileName?: string;
  fileUrl: string;
  onLoadError?: (message: string) => void;
  onLoadSuccess?: (details: { pageCount: number }) => void;
}

interface PdfPageCanvasProps {
  onRenderError?: (message: string) => void;
  pageNumber: number;
  pdfDocument: any;
  scale: number;
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'The PDF could not be rendered.';
}

function PdfPageCanvas({ onRenderError, pageNumber, pdfDocument, scale }: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pageSize, setPageSize] = useState<{ height: number; width: number }>({ height: 0, width: 0 });
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let renderTask: { cancel?: () => void; promise?: Promise<unknown> } | null = null;

    const renderPage = async () => {
      try {
        setPageError(null);
        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const outputScale = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Canvas context is unavailable.');
        }

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        renderTask = page.render({
          canvasContext: context,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
          viewport,
        });

        await renderTask.promise;
        if (cancelled) return;

        setPageSize({ height: viewport.height, width: viewport.width });
      } catch (error) {
        const message = formatErrorMessage(error);
        if (cancelled || message.toLowerCase().includes('cancel')) return;
        setPageError(message);
        onRenderError?.(message);
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [onRenderError, pageNumber, pdfDocument, scale]);

  if (pageError) {
    return (
      <div className="flex w-full justify-center px-2">
        <div className="flex w-full max-w-xl items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-foreground">Page {pageNumber} could not be rendered</p>
            <p className="mt-1 text-xs leading-relaxed">{pageError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-center px-2">
      <div
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        style={pageSize.width > 0 ? { minHeight: `${pageSize.height}px`, width: `${pageSize.width}px` } : undefined}
      >
        <canvas ref={canvasRef} className="block max-w-none bg-background" />
      </div>
    </div>
  );
}

export default function PdfCanvasViewer({
  className,
  fileName,
  fileUrl,
  onLoadError,
  onLoadSuccess,
}: PdfCanvasViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [fitScale, setFitScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageCount, setPageCount] = useState(0);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [zoomMultiplier, setZoomMultiplier] = useState(1);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateWidth = () => {
      const nextWidth = Math.max(node.clientWidth, 0);
      setContainerWidth(nextWidth);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(() => updateWidth());
    resizeObserver.observe(node);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadingTask = getDocument(fileUrl);

    setLoading(true);
    setViewerError(null);
    setPdfDocument(null);
    setPageCount(0);
    setZoomMultiplier(1);

    loadingTask.promise
      .then((nextPdfDocument) => {
        if (cancelled) {
          void nextPdfDocument.destroy();
          return;
        }

        setPdfDocument(nextPdfDocument);
        setPageCount(nextPdfDocument.numPages);
        onLoadSuccess?.({ pageCount: nextPdfDocument.numPages });
      })
      .catch((error) => {
        const message = formatErrorMessage(error);
        if (cancelled) return;
        setViewerError(message);
        onLoadError?.(message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [fileUrl, onLoadError, onLoadSuccess]);

  useEffect(() => {
    if (!pdfDocument || containerWidth <= 0) return;

    let cancelled = false;

    pdfDocument
      .getPage(1)
      .then((page: any) => {
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        const nextScale = Math.max((containerWidth - PAGE_GUTTER_PX) / viewport.width, 0.35);
        setFitScale(nextScale);
      })
      .catch((error: unknown) => {
        const message = formatErrorMessage(error);
        if (cancelled) return;
        setViewerError(message);
        onLoadError?.(message);
      });

    return () => {
      cancelled = true;
    };
  }, [containerWidth, onLoadError, pdfDocument]);

  const activeScale = useMemo(() => fitScale * zoomMultiplier, [fitScale, zoomMultiplier]);

  const handleZoomOut = useCallback(() => {
    setZoomMultiplier((current) => Math.max(Number((current - ZOOM_STEP).toFixed(2)), MIN_ZOOM_MULTIPLIER));
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomMultiplier((current) => Math.min(Number((current + ZOOM_STEP).toFixed(2)), MAX_ZOOM_MULTIPLIER));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomMultiplier(1);
  }, []);

  const zoomLabel = zoomMultiplier === 1 ? 'Fit width' : `${Math.round(zoomMultiplier * 100)}%`;

  return (
    <div className={cn('relative flex h-full min-h-0 flex-col bg-muted/20', className)}>
      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto overscroll-contain"
        style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Loading PDF</p>
                <p className="text-xs text-muted-foreground">Rendering {fileName || 'document'} in-app</p>
              </div>
            </div>
          </div>
        )}

        {viewerError && !loading && (
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
              <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
              <h2 className="mt-4 text-base font-semibold text-foreground">PDF could not be opened</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{viewerError}</p>
            </div>
          </div>
        )}

        {!viewerError && pdfDocument && (
          <div className="mx-auto flex min-h-full w-full max-w-full flex-col gap-3 py-2 sm:py-4">
            {Array.from({ length: pageCount }, (_, index) => (
              <PdfPageCanvas
                key={`${fileUrl}-${index + 1}-${activeScale}`}
                onRenderError={onLoadError}
                pageNumber={index + 1}
                pdfDocument={pdfDocument}
                scale={activeScale}
              />
            ))}
          </div>
        )}
      </div>

      {!viewerError && pdfDocument && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex items-center gap-2">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/95 p-1 shadow-sm backdrop-blur">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={handleZoomOut}
              disabled={zoomMultiplier <= MIN_ZOOM_MULTIPLIER}
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-full px-3 text-xs font-medium"
              onClick={handleResetZoom}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {zoomLabel}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={handleZoomIn}
              disabled={zoomMultiplier >= MAX_ZOOM_MULTIPLIER}
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="pointer-events-auto rounded-full border border-border bg-card/95 px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            {pageCount} page{pageCount === 1 ? '' : 's'}
          </div>
        </div>
      )}
    </div>
  );
}
