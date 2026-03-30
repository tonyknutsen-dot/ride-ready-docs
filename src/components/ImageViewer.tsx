import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName: string;
  onDownload: () => void;
}

const ImageViewer = ({ isOpen, onClose, imageUrl, imageName, onDownload }: ImageViewerProps) => {
  const [zoom, setZoom] = useState(1);

  const handleClose = () => {
    setZoom(1);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[100vw] w-full h-[100dvh] sm:max-w-4xl sm:h-[95vh] sm:max-h-[95vh] p-0 overflow-hidden rounded-none sm:rounded-xl border-0 sm:border sm:border-border shadow-none sm:shadow-xl [&>button.absolute]:hidden"
        aria-describedby={undefined}
      >
        <VisuallyHidden>
          <DialogTitle>{imageName}</DialogTitle>
        </VisuallyHidden>

        <div className="flex flex-col h-full bg-background">
          {/* Compact header */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-card/90 backdrop-blur-sm shrink-0">
            <h3 className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
              {imageName}
            </h3>
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
                onClick={handleClose}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Image — fills remaining space, pinch-zoomable */}
          <div
            className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-2 bg-muted/20 touch-manipulation"
          >
            <img
              src={imageUrl}
              alt={imageName}
              className="max-w-full max-h-full object-contain"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageViewer;