import { useState, useCallback, useRef } from 'react';

interface RateLimitState {
  attempts: number;
  lastAttempt: number;
  lockedUntil: number | null;
}

interface UseAuthRateLimitReturn {
  checkRateLimit: () => boolean;
  recordAttempt: (success: boolean) => void;
  getRemainingLockTime: () => number;
  isLocked: boolean;
  attemptsRemaining: number;
  reset: () => void;
}

const STORAGE_KEY = 'auth-rate-limit';
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout after max attempts

function getStoredState(): RateLimitState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    // Ignore parse errors
  }
  return { attempts: 0, lastAttempt: 0, lockedUntil: null };
}

function saveState(state: RateLimitState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Ignore storage errors
  }
}

export function useAuthRateLimit(): UseAuthRateLimitReturn {
  const [state, setState] = useState<RateLimitState>(getStoredState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const isLocked = state.lockedUntil !== null && Date.now() < state.lockedUntil;

  const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - state.attempts);

  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    const currentState = getStoredState();

    // Check if currently locked
    if (currentState.lockedUntil && now < currentState.lockedUntil) {
      setState(currentState);
      return false;
    }

    // Clear lockout if expired
    if (currentState.lockedUntil && now >= currentState.lockedUntil) {
      const newState = { attempts: 0, lastAttempt: 0, lockedUntil: null };
      saveState(newState);
      setState(newState);
      return true;
    }

    // Reset attempts if outside the window
    if (now - currentState.lastAttempt > ATTEMPT_WINDOW_MS) {
      const newState = { attempts: 0, lastAttempt: 0, lockedUntil: null };
      saveState(newState);
      setState(newState);
      return true;
    }

    // Check if attempts exceeded
    if (currentState.attempts >= MAX_ATTEMPTS) {
      const newState = {
        ...currentState,
        lockedUntil: now + LOCKOUT_DURATION_MS,
      };
      saveState(newState);
      setState(newState);
      return false;
    }

    return true;
  }, []);

  const recordAttempt = useCallback((success: boolean) => {
    const now = Date.now();
    const currentState = getStoredState();

    // If successful, reset the counter
    if (success) {
      const newState = { attempts: 0, lastAttempt: 0, lockedUntil: null };
      saveState(newState);
      setState(newState);
      return;
    }

    // Reset if outside window
    if (now - currentState.lastAttempt > ATTEMPT_WINDOW_MS) {
      const newState = { attempts: 1, lastAttempt: now, lockedUntil: null };
      saveState(newState);
      setState(newState);
      return;
    }

    // Increment failed attempts
    const newAttempts = currentState.attempts + 1;
    const newState: RateLimitState = {
      attempts: newAttempts,
      lastAttempt: now,
      lockedUntil: newAttempts >= MAX_ATTEMPTS ? now + LOCKOUT_DURATION_MS : null,
    };
    saveState(newState);
    setState(newState);
  }, []);

  const getRemainingLockTime = useCallback((): number => {
    const currentState = getStoredState();
    if (!currentState.lockedUntil) return 0;
    const remaining = currentState.lockedUntil - Date.now();
    return Math.max(0, Math.ceil(remaining / 1000));
  }, []);

  const reset = useCallback(() => {
    const newState = { attempts: 0, lastAttempt: 0, lockedUntil: null };
    saveState(newState);
    setState(newState);
  }, []);

  return {
    checkRateLimit,
    recordAttempt,
    getRemainingLockTime,
    isLocked,
    attemptsRemaining,
    reset,
  };
}
