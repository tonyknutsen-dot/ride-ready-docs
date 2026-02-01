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
  const isInitializedRef = useRef(false);

  const startSession = useCallback(async () => {
    if (!user || !isTester || sessionIdRef.current) {
      console.log('[TesterSession] Skip start:', { hasUser: !!user, isTester, hasSession: !!sessionIdRef.current });
      return;
    }

    try {
      console.log('[TesterSession] Starting session for user:', user.id);
      const { data, error } = await supabase
        .from('tester_sessions')
        .insert({
          user_id: user.id,
          session_start: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('[TesterSession] Failed to start session:', error);
        return;
      }

      sessionIdRef.current = data.id;
      isInitializedRef.current = true;
      console.log('[TesterSession] Session started:', data.id);
    } catch (err) {
      console.error('[TesterSession] Error starting session:', err);
    }
  }, [user, isTester]);

  const endSession = useCallback(async () => {
    if (!sessionIdRef.current) return;

    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;

    try {
      console.log('[TesterSession] Ending session:', sessionId);
      
      // Use the RPC function for reliable session ending
      const { error } = await supabase.rpc('end_tester_session', {
        p_session_id: sessionId
      });

      if (error) {
        console.error('[TesterSession] RPC error:', error);
        // Fallback to direct update
        const { data: session } = await supabase
          .from('tester_sessions')
          .select('session_start')
          .eq('id', sessionId)
          .single();

        if (session) {
          const sessionStart = new Date(session.session_start);
          const sessionEnd = new Date();
          const durationMinutes = Math.round((sessionEnd.getTime() - sessionStart.getTime()) / 60000);

          await supabase
            .from('tester_sessions')
            .update({
              session_end: sessionEnd.toISOString(),
              duration_minutes: durationMinutes,
            })
            .eq('id', sessionId);
        }
      }

      console.log('[TesterSession] Session ended:', sessionId);
    } catch (err) {
      console.error('[TesterSession] Error ending session:', err);
    }
  }, []);

  const updateHeartbeat = useCallback(async () => {
    if (!sessionIdRef.current) {
      console.log('[TesterSession] Heartbeat skipped - no active session');
      return;
    }

    try {
      const sessionId = sessionIdRef.current;
      
      // Get the session start time
      const { data: session } = await supabase
        .from('tester_sessions')
        .select('session_start')
        .eq('id', sessionId)
        .single();

      if (!session) {
        console.log('[TesterSession] Heartbeat - session not found:', sessionId);
        return;
      }

      const sessionStart = new Date(session.session_start);
      const now = new Date();
      const durationMinutes = Math.round((now.getTime() - sessionStart.getTime()) / 60000);

      // Update the session with current end time and duration (in case of crash)
      const { error } = await supabase
        .from('tester_sessions')
        .update({
          session_end: now.toISOString(),
          duration_minutes: durationMinutes,
        })
        .eq('id', sessionId);

      if (error) {
        console.error('[TesterSession] Heartbeat update error:', error);
      } else {
        console.log('[TesterSession] Heartbeat updated - duration:', durationMinutes, 'minutes');
      }
    } catch (err) {
      console.error('[TesterSession] Error updating heartbeat:', err);
    }
  }, []);

  useEffect(() => {
    if (isTester && user) {
      startSession();

      // Set up heartbeat - run first one after 10 seconds, then every 60 seconds
      const initialHeartbeat = setTimeout(() => {
        updateHeartbeat();
        heartbeatRef.current = setInterval(updateHeartbeat, HEARTBEAT_INTERVAL);
      }, 10000);

      // Handle visibility change (tab switch, minimize)
      const handleVisibilityChange = () => {
        if (document.hidden) {
          console.log('[TesterSession] Page hidden - updating heartbeat');
          updateHeartbeat();
        }
      };

      // Handle before unload (close tab/window)
      const handleBeforeUnload = () => {
        if (sessionIdRef.current) {
          console.log('[TesterSession] Page unloading - sending beacon');
          const sessionId = sessionIdRef.current;
          
          // Use sendBeacon with the RPC endpoint
          const url = `https://sbtldudgiskqfqqkrmaa.supabase.co/rest/v1/rpc/end_tester_session`;
          const body = JSON.stringify({ p_session_id: sessionId });
          
          // Get the current session token
          const token = supabase.auth.getSession().then(({ data }) => data.session?.access_token);
          
          // sendBeacon doesn't support custom headers well, so we use a simple POST
          // The RPC function uses SECURITY DEFINER so it will work
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
      console.log('[TesterSession] User no longer tester - ending session');
      endSession();
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    }
  }, [isTester, user, startSession, endSession, updateHeartbeat]);

  return { sessionId: sessionIdRef.current };
};
