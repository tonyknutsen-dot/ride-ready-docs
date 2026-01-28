import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { APP_NAME, APP_VERSION } from '@/config/appVersion';

interface StartupUpdateCheckProps {
  children: React.ReactNode;
}

/**
 * Wraps the app and shows a loading screen on startup while checking for updates.
 * This ensures users always have the latest version before interacting with the app.
 */
export const StartupUpdateCheck: React.FC<StartupUpdateCheckProps> = ({ children }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Monitor online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for service worker updates on startup
    const checkForUpdates = async () => {
      try {
        // Wait a short moment for service worker to register
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.getRegistration();
          
          if (registration) {
            // Trigger an update check
            await registration.update();
            
            // Wait a moment for the update check to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (err) {
        console.log('[Startup] Update check skipped:', err);
      } finally {
        // Always allow the app to load after checking
        setIsChecking(false);
      }
    };

    // If offline, skip update check
    if (!navigator.onLine) {
      setIsChecking(false);
    } else {
      checkForUpdates();
    }

    // Timeout fallback - don't block the app for more than 3 seconds
    const timeout = setTimeout(() => {
      setIsChecking(false);
    }, 3000);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isChecking) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-[9999]">
        <div className="text-center space-y-6 p-8">
          {/* App Logo/Name */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{APP_NAME}</h1>
            <p className="text-sm text-muted-foreground">v{APP_VERSION}</p>
          </div>

          {/* Loading indicator */}
          <div className="flex flex-col items-center gap-4">
            {isOnline ? (
              <>
                <div className="relative">
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                  <RefreshCw className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Checking for updates...
                </p>
              </>
            ) : (
              <>
                <WifiOff className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Starting in offline mode...
                </p>
              </>
            )}
          </div>

          {/* Subtle hint */}
          <p className="text-xs text-muted-foreground/60 max-w-xs">
            This ensures you have the latest features and security updates
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default StartupUpdateCheck;
