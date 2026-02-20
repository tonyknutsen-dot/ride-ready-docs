import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  pdfName: string;
  onDownload: () => void;
}

const PDFViewer = ({ isOpen, onClose, pdfUrl, pdfName, onDownload }: PDFViewerProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>{pdfName}</DialogTitle>
        </VisuallyHidden>
        <div className="relative w-full h-[90vh] bg-background">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-background border-b">
            <div className="min-w-0 flex-1">
              {(() => {
                const docIdMatch = pdfName?.match(/^([A-Z0-9]+-CR-\d{4}-\d{4})\s*[–—-]\s*/);
                if (docIdMatch) {
                  const docId = docIdMatch[1];
                  const rest = pdfName.slice(docIdMatch[0].length);
                  return (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-primary text-base shrink-0">{docId}</span>
                      <h3 className="text-sm text-muted-foreground truncate">{rest}</h3>
                    </div>
                  );
                }
                return (
                  <h3 className="text-lg font-semibold text-foreground truncate max-w-md">
                    {pdfName}
                  </h3>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="icon" onClick={onDownload}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* PDF Container */}
          <div className="w-full h-full pt-16">
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title={pdfName}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PDFViewer;
