-- FIX: The heartbeat function was CLOSING sessions by setting session_end = now()
-- This should only update last_heartbeat and duration_minutes WITHOUT closing

CREATE OR REPLACE FUNCTION public.update_tester_heartbeat(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update heartbeat and running duration (but DO NOT set session_end - that closes it!)
  UPDATE tester_sessions
  SET 
    last_heartbeat = now(),
    duration_minutes = EXTRACT(EPOCH FROM (now() - session_start)) / 60
  WHERE id = p_session_id 
    AND session_end IS NULL;
END;
$$;

-- Also clean up the end_tester_session to be cleaner
CREATE OR REPLACE FUNCTION public.end_tester_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE tester_sessions
  SET 
    session_end = now(),
    duration_minutes = EXTRACT(EPOCH FROM (now() - session_start)) / 60
  WHERE id = p_session_id
    AND session_end IS NULL;
END;
$$;