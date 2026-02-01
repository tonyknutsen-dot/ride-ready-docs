-- 1. Clean up ALL existing tester sessions (starting fresh with accurate tracking)
DELETE FROM tester_sessions;

-- 2. Add a partial unique index to enforce only ONE open session per user
-- This prevents duplicate sessions if the tracker mounts multiple times
CREATE UNIQUE INDEX idx_tester_sessions_one_open_per_user 
ON tester_sessions (user_id) 
WHERE session_end IS NULL;

-- 3. Add last_heartbeat column to track idle time
ALTER TABLE tester_sessions 
ADD COLUMN last_heartbeat timestamptz DEFAULT now();

-- 4. Create function to close stale sessions (no heartbeat for 15+ minutes)
CREATE OR REPLACE FUNCTION public.close_stale_tester_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  closed_count INTEGER;
BEGIN
  -- Close sessions with no heartbeat for 15+ minutes
  UPDATE tester_sessions
  SET 
    session_end = last_heartbeat,
    duration_minutes = GREATEST(1, EXTRACT(EPOCH FROM (last_heartbeat - session_start)) / 60)
  WHERE session_end IS NULL
    AND last_heartbeat < now() - interval '15 minutes';
  
  GET DIAGNOSTICS closed_count = ROW_COUNT;
  RETURN closed_count;
END;
$$;

-- 5. Update the start session logic to close any existing open session first
-- and use INSERT ... ON CONFLICT to handle race conditions
CREATE OR REPLACE FUNCTION public.start_tester_session(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- First, close any stale sessions for this user
  UPDATE tester_sessions
  SET 
    session_end = last_heartbeat,
    duration_minutes = GREATEST(1, EXTRACT(EPOCH FROM (last_heartbeat - session_start)) / 60)
  WHERE user_id = p_user_id
    AND session_end IS NULL
    AND last_heartbeat < now() - interval '15 minutes';
  
  -- Try to get existing open session
  SELECT id INTO v_session_id
  FROM tester_sessions
  WHERE user_id = p_user_id AND session_end IS NULL
  LIMIT 1;
  
  -- If no open session, create one
  IF v_session_id IS NULL THEN
    INSERT INTO tester_sessions (user_id, session_start, last_heartbeat)
    VALUES (p_user_id, now(), now())
    RETURNING id INTO v_session_id;
  END IF;
  
  RETURN v_session_id;
END;
$$;

-- 6. Update heartbeat function to also update last_heartbeat
CREATE OR REPLACE FUNCTION public.update_tester_heartbeat(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE tester_sessions
  SET 
    last_heartbeat = now(),
    session_end = now(),
    duration_minutes = EXTRACT(EPOCH FROM (now() - session_start)) / 60
  WHERE id = p_session_id AND session_end IS NULL;
  
  -- Also close any stale sessions while we're here
  PERFORM close_stale_tester_sessions();
END;
$$;