import { useState, useEffect, useCallback } from 'react';

interface UpdateState {
  needsUpdate: boolean;
  isChecking: boolean;
  isUpdating: boolean;
  lastChecked: Date | null;
  error: string | null;
}

// Store the service worker registration globally
let swRegistration: ServiceWorkerRegistration | null = null;

export const usePWAUpdate = () => {
  const [state, setState] = useState<UpdateState>({
    needsUpdate: false,
    isChecking: false,
    isUpdating: false,
    lastChecked: null,
    error: null,
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

      // Check for updates periodically (every 60 seconds)
      const intervalId = setInterval(() => {
        console.log('[PWA] Checking for updates...');
        setState(prev => ({ ...prev, isChecking: true }));
        registration.update().then(() => {
          setState(prev => ({ 
            ...prev, 
            isChecking: false, 
            lastChecked: new Date() 
          }));
        }).catch((err) => {
          console.error('[PWA] Update check failed:', err);
          setState(prev => ({ 
            ...prev, 
            isChecking: false, 
            error: 'Failed to check for updates' 
          }));
        });
      }, 60 * 1000);

      return () => clearInterval(intervalId);
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

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
      setState(prev => ({ 
        ...prev, 
        isUpdating: false, 
        error: 'Update failed. Please refresh manually.' 
      }));
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setState(prev => ({ ...prev, needsUpdate: false }));
  }, []);

  const checkForUpdates = useCallback(async () => {
    setState(prev => ({ ...prev, isChecking: true }));
    
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) {
        await registration.update();
        
        // Check if there's a waiting worker after update
        if (registration.waiting) {
          setState(prev => ({ 
            ...prev, 
            isChecking: false, 
            lastChecked: new Date(),
            needsUpdate: true
          }));
        } else {
          setState(prev => ({ 
            ...prev, 
            isChecking: false, 
            lastChecked: new Date() 
          }));
        }
      } else {
        setState(prev => ({ ...prev, isChecking: false }));
      }
    } catch (err) {
      console.error('[PWA] Manual update check failed:', err);
      setState(prev => ({ 
        ...prev, 
        isChecking: false, 
        error: 'Could not check for updates' 
      }));
    }
  }, []);

  return {
    ...state,
    applyUpdate,
    dismissUpdate,
    checkForUpdates,
  };
};
