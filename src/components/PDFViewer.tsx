import { Dialog, DialogContent } from '@/components/ui/dialog';
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
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden">
        <div className="relative w-full h-[90vh] bg-background">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-background border-b">
            <h3 className="text-lg font-semibold text-foreground truncate max-w-md">
              {pdfName}
            </h3>
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
