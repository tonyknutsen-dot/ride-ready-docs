import React from 'react';
import { Download, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { APP_VERSION, getLastUpdateDate, formatVersionDate } from '@/config/appVersion';

export const PWAUpdateModal = () => {
  const { 
    needsUpdate, 
    isUpdating, 
    applyUpdate, 
    dismissUpdate 
  } = usePWAUpdate();

  // Don't render anything if no update is needed
  if (!needsUpdate && !isUpdating) {
    return null;
  }

  const lastUpdate = formatVersionDate(getLastUpdateDate());

  return (
    <AlertDialog open={needsUpdate || isUpdating}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-primary/10 rounded-full">
              {isUpdating ? (
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              ) : (
                <Download className="h-6 w-6 text-primary" />
              )}
            </div>
            <AlertDialogTitle className="text-xl">
              {isUpdating ? 'Updating App...' : 'Update Available'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left space-y-3">
            {isUpdating ? (
              <>
                <p>
                  Please wait while the app updates. This will only take a moment.
                </p>
                <p className="text-sm text-muted-foreground">
                  Do not close or refresh the app.
                </p>
              </>
            ) : (
              <>
                <p>
                  A new version of Ride Ready Docs is available with improvements and bug fixes.
                </p>
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="text-muted-foreground">
                    Current version: <span className="font-medium text-foreground">{APP_VERSION}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Last updated: <span className="font-medium text-foreground">{lastUpdate}</span>
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  We recommend updating now for the best experience.
                </p>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {!isUpdating && (
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={dismissUpdate}
              disabled={isUpdating}
              className="w-full sm:w-auto"
            >
              <X className="h-4 w-4 mr-2" />
              Later
            </Button>
            <Button
              onClick={applyUpdate}
              disabled={isUpdating}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Update Now
            </Button>
          </AlertDialogFooter>
        )}

        {/* Progress indicator during update */}
        {isUpdating && (
          <div className="mt-4">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full animate-pulse"
                style={{ width: '100%' }}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Installing update...
            </p>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PWAUpdateModal;
