import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { saveLastRoute } from '@/lib/offlineIdentity';

/**
 * Silently tracks the current route so the PWA can resume there on offline boot.
 * Only tracks when a user is authenticated and online.
 */
export function LastRouteTracker() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (user && navigator.onLine) {
      saveLastRoute(pathname);
    }
  }, [pathname, user]);

  return null;
}
