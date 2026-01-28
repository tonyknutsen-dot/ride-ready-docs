import { useState, useEffect, useCallback } from 'react';

interface UpdateState {
  needsUpdate: boolean;
  isUpdating: boolean;
  lastChecked: Date | null;
}

// Store the service worker registration globally
let swRegistration: ServiceWorkerRegistration | null = null;

export const usePWAUpdate = () => {
  const [state, setState] = useState<UpdateState>({
    needsUpdate: false,
    isUpdating: false,
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

    // Get the registration and set up update detection
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration) return;
      
      swRegistration = registration;

      // Check if there's already a waiting worker
      if (registration.waiting) {
        setState(prev => ({ ...prev, needsUpdate: true }));
      }

      // Listen for new waiting workers
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New version available!');
            setState(prev => ({ ...prev, needsUpdate: true }));
          }
        });
      });
    });

    // Check for updates when app regains focus (user returns to app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
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
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
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
