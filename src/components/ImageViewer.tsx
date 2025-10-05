import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';
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

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleClose = () => {
    setZoom(1);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden">
        <div className="relative w-full h-[90vh] bg-background/95 backdrop-blur">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-background to-transparent">
            <h3 className="text-lg font-semibold text-foreground truncate max-w-md">
              {imageName}
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="secondary"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="icon" onClick={onDownload}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Image Container */}
          <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
            <img
              src={imageUrl}
              alt={imageName}
              className="max-w-full h-auto transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageViewer;
