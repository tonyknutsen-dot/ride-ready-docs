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

    isStartingRef.current = true;

    try {
      // Use the RPC function which handles duplicates and stale sessions
      const { data, error } = await supabase.rpc('start_tester_session', {
        p_user_id: user.id
      });

      if (error) {
        console.error('[TesterSession] Failed to start session:', error);
        return null;
      }

      sessionIdRef.current = data;
      console.log('[TesterSession] Session started/resumed:', data);
      return data;
    } catch (err) {
      console.error('[TesterSession] Error starting session:', err);
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
      console.log('[TesterSession] Ending session:', sessionId);
      
      const { error } = await supabase.rpc('end_tester_session', {
        p_session_id: sessionId
      });

      if (error) {
        console.error('[TesterSession] RPC error:', error);
      } else {
        console.log('[TesterSession] Session ended:', sessionId);
      }
    } catch (err) {
      console.error('[TesterSession] Error ending session:', err);
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
        console.error('[TesterSession] Heartbeat update error:', error);
        // Session might have been closed, try to start a new one
        sessionIdRef.current = null;
        await startSession();
      }
    } catch (err) {
      console.error('[TesterSession] Error updating heartbeat:', err);
    }
  }, [startSession]);

  useEffect(() => {
    if (isTester && user) {
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
          // This handles the case where session was closed due to inactivity
          startSession();
        }
      };

      // Handle before unload (close tab/window)
      const handleBeforeUnload = () => {
        if (sessionIdRef.current) {
          const sessionId = sessionIdRef.current;
          
          // Use sendBeacon with the RPC endpoint for reliable session end
          const url = `https://sbtldudgiskqfqqkrmaa.supabase.co/rest/v1/rpc/end_tester_session`;
          const body = JSON.stringify({ p_session_id: sessionId });
          
          navigator.sendBeacon?.(url, body);
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
