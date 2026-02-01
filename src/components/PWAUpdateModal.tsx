import React from 'react';
import { Download, Loader2, RefreshCw, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';

export const PWAUpdateModal = () => {
  const { 
    needsUpdate, 
    isUpdating,
    isChecking,
    applyUpdate, 
    dismissUpdate 
  } = usePWAUpdate();

  // Show blocking overlay only during actual update
  if (isUpdating) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
          <div>
            <h2 className="text-xl font-semibold">Updating App...</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Please wait, this will only take a moment.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show checking indicator for installed PWA users
  if (isChecking) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="bg-card border rounded-full shadow-lg px-4 py-2 flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Checking for updates...</span>
        </div>
      </div>
    );
  }

  // Show non-blocking banner when update is available
  if (!needsUpdate) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-full shrink-0">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm">Update Available</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              A new version is ready to install
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={dismissUpdate}
                className="h-8 text-xs"
              >
                Later
              </Button>
              <Button
                size="sm"
                onClick={applyUpdate}
                className="h-8 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Update
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={dismissUpdate}
            className="h-6 w-6 shrink-0 -mt-1 -mr-1"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PWAUpdateModal;
