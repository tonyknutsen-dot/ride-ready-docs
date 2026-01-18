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

  const startSession = useCallback(async () => {
    if (!user || !isTester || sessionIdRef.current) return;

    try {
      const { data, error } = await supabase
        .from('tester_sessions')
        .insert({
          user_id: user.id,
          session_start: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to start tester session:', error);
        return;
      }

      sessionIdRef.current = data.id;
      console.log('Tester session started:', data.id);
    } catch (err) {
      console.error('Error starting tester session:', err);
    }
  }, [user, isTester]);

  const endSession = useCallback(async () => {
    if (!sessionIdRef.current) return;

    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;

    try {
      // Get the session start time first
      const { data: session } = await supabase
        .from('tester_sessions')
        .select('session_start')
        .eq('id', sessionId)
        .single();

      if (!session) return;

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

      console.log('Tester session ended:', sessionId, `Duration: ${durationMinutes} minutes`);
    } catch (err) {
      console.error('Error ending tester session:', err);
    }
  }, []);

  const updateHeartbeat = useCallback(async () => {
    if (!sessionIdRef.current) return;

    try {
      // Get the session start time
      const { data: session } = await supabase
        .from('tester_sessions')
        .select('session_start')
        .eq('id', sessionIdRef.current)
        .single();

      if (!session) return;

      const sessionStart = new Date(session.session_start);
      const now = new Date();
      const durationMinutes = Math.round((now.getTime() - sessionStart.getTime()) / 60000);

      // Update the session with current end time and duration (in case of crash)
      await supabase
        .from('tester_sessions')
        .update({
          session_end: now.toISOString(),
          duration_minutes: durationMinutes,
        })
        .eq('id', sessionIdRef.current);
    } catch (err) {
      console.error('Error updating session heartbeat:', err);
    }
  }, []);

  useEffect(() => {
    if (isTester && user) {
      startSession();

      // Set up heartbeat
      heartbeatRef.current = setInterval(updateHeartbeat, HEARTBEAT_INTERVAL);

      // Handle visibility change (tab switch, minimize)
      const handleVisibilityChange = () => {
        if (document.hidden) {
          updateHeartbeat();
        }
      };

      // Handle before unload (close tab/window)
      const handleBeforeUnload = () => {
        if (sessionIdRef.current) {
          // Use sendBeacon for reliable delivery on page close
          const sessionId = sessionIdRef.current;
          navigator.sendBeacon?.(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://sbtldudgiskqfqqkrmaa.supabase.co'}/rest/v1/rpc/end_tester_session`,
            JSON.stringify({ session_id: sessionId })
          );
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
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
