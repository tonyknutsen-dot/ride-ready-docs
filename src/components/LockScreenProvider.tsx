import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSecuritySettings } from '@/hooks/useSecuritySettings';
import { useIdleLock } from '@/hooks/useIdleLock';
import { supabase } from '@/integrations/supabase/client';

const LockScreen = lazy(() => import('./LockScreen'));

const REMEMBER_KEY = 'rrd-remember-device';

/**
 * Wraps the app and shows a lock screen overlay after idle timeout.
 * Must be placed inside AuthProvider.
 */
export function LockScreenProvider({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { settings, loading, isLockEnabled } = useSecuritySettings();
  const [locked, setLocked] = useState(false);

  // Check "remember device" - skip lock on this device
  const isRemembered = useCallback(() => {
    if (!settings.remember_device_enabled || !user) return false;
    const token = localStorage.getItem(REMEMBER_KEY);
    return token === user.id;
  }, [settings.remember_device_enabled, user]);

  const handleLock = useCallback(() => {
    if (isRemembered()) return;
    setLocked(true);
    // Log lock event
    try {
      supabase.rpc('log_audit_event', {
        p_action: 'lock',
        p_resource_type: 'session',
        p_resource_id: null,
        p_details: { trigger: 'idle_timeout', idle_minutes: settings.idle_lock_minutes },
      });
    } catch {}
  }, [isRemembered, settings.idle_lock_minutes]);

  const handleUnlock = useCallback(() => {
    setLocked(false);
    // If remember device is on, set the token
    if (settings.remember_device_enabled && user) {
      localStorage.setItem(REMEMBER_KEY, user.id);
    }
  }, [settings.remember_device_enabled, user]);

  const handleSignOut = useCallback(async () => {
    setLocked(false);
    await signOut();
    window.location.href = '/';
  }, [signOut]);

  useIdleLock({
    idleMinutes: settings.idle_lock_minutes,
    enabled: isLockEnabled && !loading && !!user,
    onLock: handleLock,
  });

  // Get PIN hash (prefer from settings, fallback to localStorage for offline)
  const pinHash = settings.lock_pin_hash || 
    (user ? localStorage.getItem(`rrd-pin-hash-${user.id}`) : null) || '';

  if (!user || loading) return <>{children}</>;

  return (
    <>
      {children}
      {locked && pinHash && (
        <Suspense fallback={null}>
          <LockScreen
            pinHash={pinHash}
            onUnlock={handleUnlock}
            onSignOut={handleSignOut}
          />
        </Suspense>
      )}
    </>
  );
}
