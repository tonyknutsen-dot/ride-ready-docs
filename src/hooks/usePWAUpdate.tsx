import { useState, useEffect, useCallback } from 'react';

interface UpdateState {
  needsUpdate: boolean;
  isUpdating: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
}

// Store the service worker registration globally
let swRegistration: ServiceWorkerRegistration | null = null;

// Check if app is installed as PWA
const isInstalledPWA = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
};

export const usePWAUpdate = () => {
  const [state, setState] = useState<UpdateState>({
    needsUpdate: false,
    isUpdating: false,
    isChecking: false,
    lastChecked: null,
  });

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Listen for service worker updates
    const handleControllerChange = () => {
      console.log('[PWA] Controller changed, reloading...');
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Initial update check for installed PWA users
    const performInitialCheck = async () => {
      // Only show checking indicator for installed PWA users
      if (isInstalledPWA() && navigator.onLine) {
        setState(prev => ({ ...prev, isChecking: true }));
        console.log('[PWA] Checking for updates...');
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          setState(prev => ({ ...prev, isChecking: false }));
          return;
        }
        
        swRegistration = registration;

        // Check if there's already a waiting worker
        if (registration.waiting) {
          setState(prev => ({ ...prev, needsUpdate: true, isChecking: false }));
          return;
        }

        // Listen for new waiting workers
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New version available!');
              setState(prev => ({ ...prev, needsUpdate: true, isChecking: false }));
            }
          });
        });

        // Trigger update check if installed PWA
        if (isInstalledPWA() && navigator.onLine) {
          await registration.update();
          setState(prev => ({ ...prev, lastChecked: new Date(), isChecking: false }));
        }
      } catch (err) {
        console.log('[PWA] Update check failed:', err);
        setState(prev => ({ ...prev, isChecking: false }));
      }
    };

    // Small delay to let the app render first
    const timeoutId = setTimeout(performInitialCheck, 500);

    return () => {
      clearTimeout(timeoutId);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  // Check for updates when app regains focus (user returns to app)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isInstalledPWA()) {
        // Only check if we haven't checked in the last 5 minutes
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        
        if (!state.lastChecked || state.lastChecked < fiveMinutesAgo) {
          console.log('[PWA] App visible, checking for updates...');
          navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg) {
              reg.update().then(() => {
                setState(prev => ({ ...prev, lastChecked: new Date() }));
              }).catch(console.error);
            }
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.lastChecked]);

  const applyUpdate = useCallback(async () => {
    setState(prev => ({ ...prev, isUpdating: true }));
    
    try {
      const registration = swRegistration || await navigator.serviceWorker.getRegistration();
      
      if (registration?.waiting) {
        // Tell the waiting service worker to activate
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        // The controllerchange event will trigger a reload
      } else {
        // No waiting worker, just reload
        window.location.reload();
      }
    } catch (err) {
      console.error('[PWA] Update failed:', err);
      setState(prev => ({ ...prev, isUpdating: false }));
      // Fallback: just reload
      window.location.reload();
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setState(prev => ({ ...prev, needsUpdate: false }));
    // Store dismissal in session so it doesn't keep appearing
    sessionStorage.setItem('pwa-update-dismissed', 'true');
  }, []);

  // Check if update was dismissed this session
  useEffect(() => {
    const wasDismissed = sessionStorage.getItem('pwa-update-dismissed');
    if (wasDismissed && state.needsUpdate) {
      setState(prev => ({ ...prev, needsUpdate: false }));
    }
  }, [state.needsUpdate]);

  return {
    ...state,
    applyUpdate,
    dismissUpdate,
  };
};
