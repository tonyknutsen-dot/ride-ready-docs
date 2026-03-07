import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PdfCanvasViewer from '@/components/PdfCanvasViewer';

interface PDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  pdfName: string;
  onDownload: () => void;
}

const PDFViewer = ({ isOpen, onClose, pdfUrl, pdfName, onDownload }: PDFViewerProps) => {
  // Parse structured doc ID from name if present
  const docIdMatch = pdfName?.match(/^([A-Z0-9]+-[A-Z]{2,3}-\d{4}-\d{4})\s*[–—-]\s*/);
  const docId = docIdMatch ? docIdMatch[1] : null;
  const displayName = docId ? pdfName.slice(docIdMatch![0].length) : pdfName;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[95vw] w-full sm:max-w-4xl max-h-[95vh] p-0 overflow-hidden rounded-xl border border-border shadow-xl"
        aria-describedby={undefined}
      >
        <VisuallyHidden>
          <DialogTitle>{pdfName}</DialogTitle>
        </VisuallyHidden>

        <div className="flex flex-col h-[90vh] bg-background">
          {/* ── Clean top bar ── */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
            <div className="min-w-0 flex-1">
              {docId ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-semibold text-primary bg-primary/8 px-2 py-0.5 rounded shrink-0">
                    {docId}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">{displayName}</span>
                </div>
              ) : (
                <h3 className="text-sm font-medium text-foreground truncate">{displayName}</h3>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={onDownload}
                title="Save to Device"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={onClose}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ── PDF content ── */}
          <div className="flex-1 min-h-0">
            <PdfCanvasViewer src={pdfUrl} onDownload={onDownload} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PDFViewer;
