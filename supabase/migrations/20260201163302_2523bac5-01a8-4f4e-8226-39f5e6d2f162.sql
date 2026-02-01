-- Create a function to end tester sessions (for sendBeacon on page close)
CREATE OR REPLACE FUNCTION public.end_tester_session(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_start TIMESTAMPTZ;
  v_duration INT;
BEGIN
  -- Get the session start time
  SELECT session_start INTO v_session_start
  FROM tester_sessions
  WHERE id = p_session_id AND session_end IS NULL;
  
  IF v_session_start IS NOT NULL THEN
    -- Calculate duration in minutes
    v_duration := EXTRACT(EPOCH FROM (now() - v_session_start)) / 60;
    
    -- Update the session
    UPDATE tester_sessions
    SET session_end = now(),
        duration_minutes = v_duration
    WHERE id = p_session_id AND session_end IS NULL;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.end_tester_session(UUID) TO authenticated;

-- Also clean up any orphaned sessions older than 24 hours
UPDATE tester_sessions
SET session_end = session_start + interval '1 hour',
    duration_minutes = 60
WHERE session_end IS NULL 
  AND session_start < now() - interval '24 hours';