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
  const docIdMatch = pdfName?.match(/^([A-Z0-9]+-[A-Z]{2,3}-\d{4}-\d{4})\s*[–—-]\s*/);
  const docId = docIdMatch ? docIdMatch[1] : null;
  const displayName = docId ? pdfName.slice(docIdMatch![0].length) : pdfName;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[100vw] w-full h-[100dvh] sm:max-w-4xl sm:h-[95vh] sm:max-h-[95vh] p-0 overflow-hidden rounded-none sm:rounded-xl border-0 sm:border sm:border-border shadow-none sm:shadow-xl [&>button.absolute]:hidden"
        aria-describedby={undefined}
      >
        <VisuallyHidden>
          <DialogTitle>{pdfName}</DialogTitle>
        </VisuallyHidden>

        <div className="flex flex-col h-full bg-background">
          {/* Compact header */}
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 sm:px-3 sm:py-2 border-b border-border/60 bg-card/90 backdrop-blur-sm shrink-0">
            <div className="min-w-0 flex-1">
              {docId ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[10px] font-semibold text-primary bg-primary/8 px-1.5 py-0.5 rounded shrink-0">
                    {docId}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">{displayName}</span>
                </div>
              ) : (
                <h3 className="text-xs font-medium text-foreground truncate">{displayName}</h3>
              )}
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
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

          {/* PDF content — fills remaining space */}
          <div className="flex-1 min-h-0">
            <PdfCanvasViewer src={pdfUrl} onDownload={onDownload} fitWidth />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PDFViewer;