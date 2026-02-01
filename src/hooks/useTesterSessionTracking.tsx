import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTester } from '@/contexts/TesterContext';
import { useAuth } from '@/contexts/AuthContext';

const HEARTBEAT_INTERVAL = 60000; // Update every 60 seconds

export const useTesterSessionTracking = () => {
  const { isTester } = useTester();
  const { user } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const isStartingRef = useRef(false);

  const startSession = useCallback(async () => {
    if (!user || !isTester || isStartingRef.current) {
      return null;
    }

    // Prevent duplicate starts
    if (sessionIdRef.current) {
      return sessionIdRef.current;
    }

    isStartingRef.current = true;

    try {
      // Use the RPC function which handles duplicates and stale sessions
      const { data, error } = await supabase.rpc('start_tester_session', {
        p_user_id: user.id
      });

      if (error) {
        // Don't spam console for non-critical tracking errors
        console.warn('[TesterSession] Failed to start session:', error.message);
        return null;
      }

      sessionIdRef.current = data;
      return data;
    } catch (err) {
      // Silently fail - tracking should never break the app
      return null;
    } finally {
      isStartingRef.current = false;
    }
  }, [user, isTester]);

  const endSession = useCallback(async () => {
    if (!sessionIdRef.current) return;

    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;

    try {
      await supabase.rpc('end_tester_session', {
        p_session_id: sessionId
      });
    } catch {
      // Silently fail - don't block app shutdown
    }
  }, []);

  const updateHeartbeat = useCallback(async () => {
    // If no session, try to start one (handles resuming after idle timeout)
    if (!sessionIdRef.current) {
      await startSession();
      return;
    }

    try {
      const sessionId = sessionIdRef.current;
      
      // Use the RPC function to update heartbeat
      const { error } = await supabase.rpc('update_tester_heartbeat', {
        p_session_id: sessionId
      });

      if (error) {
        // Session might have been closed by idle timeout, try to start a new one
        sessionIdRef.current = null;
        await startSession();
      }
    } catch {
      // Silently fail - tracking errors shouldn't affect the app
    }
  }, [startSession]);

  useEffect(() => {
    if (isTester && user) {
      // Start session in background - don't block rendering
      startSession();

      // Set up heartbeat - run first one after 10 seconds, then every 60 seconds
      const initialHeartbeat = setTimeout(() => {
        updateHeartbeat();
        heartbeatRef.current = setInterval(updateHeartbeat, HEARTBEAT_INTERVAL);
      }, 10000);

      // Handle visibility change - resume session when tab becomes visible
      const handleVisibilityChange = () => {
        if (document.hidden) {
          // Tab hidden - update heartbeat one last time
          updateHeartbeat();
        } else {
          // Tab visible again - ensure we have an active session
          startSession();
        }
      };

      // Handle before unload - best effort session end
      const handleBeforeUnload = async () => {
        if (sessionIdRef.current) {
          const sessionId = sessionIdRef.current;
          sessionIdRef.current = null;
          
          // Try to end session - this may or may not complete before page unloads
          // The idle timeout cleanup will handle incomplete sessions
          try {
            await supabase.rpc('end_tester_session', {
              p_session_id: sessionId
            });
          } catch {
            // Best effort - idle timeout will clean up if this fails
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        clearTimeout(initialHeartbeat);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        endSession();
      };
    } else if (sessionIdRef.current) {
      // User is no longer a tester, end the session
      endSession();
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    }
  }, [isTester, user, startSession, endSession, updateHeartbeat]);

  return { sessionId: sessionIdRef.current };
};
