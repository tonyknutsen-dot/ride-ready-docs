import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface UseIdleLockOptions {
  idleMinutes: number;
  enabled: boolean;
  onLock: () => void;
}

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'] as const;

export function useIdleLock({ idleMinutes, enabled, onLock }: UseIdleLockOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());
  const { user } = useAuth();

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!enabled || idleMinutes <= 0 || !user) return;

    timerRef.current = setTimeout(() => {
      onLock();
    }, idleMinutes * 60 * 1000);
  }, [idleMinutes, enabled, onLock, user]);

  useEffect(() => {
    if (!enabled || !user) return;

    // Start the timer
    resetTimer();

    const handleActivity = () => resetTimer();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    // Also handle visibility change (tab switch back)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= idleMinutes * 60 * 1000) {
          onLock();
        } else {
          resetTimer();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, idleMinutes, resetTimer, onLock, user]);

  return { resetTimer };
}
