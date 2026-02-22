import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { updateLastVisitedRoute } from '@/lib/offlineDb';

/**
 * Silently tracks the current route so the PWA can resume there on offline boot.
 * Writes to IndexedDB identity cache.
 */
export function LastRouteTracker() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      updateLastVisitedRoute(user.id, pathname);
    }
  }, [pathname, user]);

  return null;
}
