import { useState, useEffect, useCallback, useRef } from 'react';

interface UpdateState {
  needsUpdate: boolean;
  isUpdating: boolean;
  isStale: boolean;
}

// Check if we're in a dev/preview environment
const isDevEnvironment = () => {
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname.includes('lovableproject.com') || hostname.includes('lovable.app');
};

export const usePWAUpdate = () => {
  const [state, setState] = useState<UpdateState>({
    needsUpdate: false,
    isUpdating: false,
    isStale: false,
  });
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || isDevEnvironment()) return;

    let cancelled = false;

    const setup = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration || cancelled) return;
        registrationRef.current = registration;

        // If a waiting worker already exists, prompt immediately
        if (registration.waiting) {
          setState(prev => ({ ...prev, needsUpdate: true }));
          return;
        }

        // Listen for new service workers
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version waiting to activate
              if (!cancelled) {
                setState(prev => ({ ...prev, needsUpdate: true }));
              }
            }
          });
        });

        // Trigger an update check
        if (navigator.onLine) {
          await registration.update().catch(() => {});
        }
      } catch (err) {
        console.log('[PWA] Setup failed:', err);
      }
    };

    // Reload when new SW takes control (after skipWaiting)
    const handleControllerChange = () => {
      if (sessionStorage.getItem('pwa-user-update')) {
        sessionStorage.removeItem('pwa-user-update');
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Small delay to not block initial render
    const timeoutId = setTimeout(setup, 800);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  // Check for updates on visibility change (user returns to tab)
  useEffect(() => {
    if (!('serviceWorker' in navigator) || isDevEnvironment()) return;

    let lastChecked = Date.now();

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      // Only check every 5 minutes
      if (now - lastChecked < 5 * 60 * 1000) return;
      lastChecked = now;

      registrationRef.current?.update().catch(() => {});
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Stale tab detection: if open > 24h, suggest refresh
  useEffect(() => {
    if (isDevEnvironment()) return;

    const STALE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
    const openedAt = Date.now();

    const interval = setInterval(() => {
      if (Date.now() - openedAt >= STALE_THRESHOLD) {
        setState(prev => {
          if (prev.isStale) return prev;
          return { ...prev, isStale: true };
        });
        clearInterval(interval);
      }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const applyUpdate = useCallback(async () => {
    setState(prev => ({ ...prev, isUpdating: true }));

    try {
      const registration = registrationRef.current || await navigator.serviceWorker.getRegistration();

      if (registration?.waiting) {
        sessionStorage.setItem('pwa-user-update', 'true');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        // controllerchange handler will reload
      } else {
        // No waiting worker — just hard reload
        window.location.reload();
      }
    } catch (err) {
      console.error('[PWA] Update failed:', err);
      window.location.reload();
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setState(prev => ({ ...prev, needsUpdate: false }));
  }, []);

  const dismissStale = useCallback(() => {
    setState(prev => ({ ...prev, isStale: false }));
  }, []);

  return {
    ...state,
    applyUpdate,
    dismissUpdate,
    dismissStale,
  };
};
