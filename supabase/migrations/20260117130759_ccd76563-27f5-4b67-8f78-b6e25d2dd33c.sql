-- Create rate limit tracking table
CREATE TABLE IF NOT EXISTS public.rate_limit_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rate_limit_entries_key_window_unique UNIQUE (key, window_start)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_key ON public.rate_limit_entries(key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON public.rate_limit_entries(window_start);

-- Enable RLS (but allow service role full access)
ALTER TABLE public.rate_limit_entries ENABLE ROW LEVEL SECURITY;

-- No policies needed - only service role accesses this table

-- Create atomic rate limit check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER,
  p_window_ms BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
  v_retry_after_ms BIGINT;
BEGIN
  -- Calculate window start time
  v_window_start := now() - (p_window_ms || ' milliseconds')::INTERVAL;
  
  -- Clean up old entries (older than 2x window to be safe)
  DELETE FROM rate_limit_entries 
  WHERE window_start < now() - (p_window_ms * 2 || ' milliseconds')::INTERVAL;
  
  -- Count requests in current window
  SELECT COALESCE(SUM(count), 0) INTO v_current_count
  FROM rate_limit_entries
  WHERE key = p_key AND window_start >= v_window_start;
  
  -- Check if limit exceeded
  IF v_current_count >= p_max_requests THEN
    -- Calculate retry after (time until oldest entry expires)
    SELECT EXTRACT(EPOCH FROM (window_start + (p_window_ms || ' milliseconds')::INTERVAL - now())) * 1000
    INTO v_retry_after_ms
    FROM rate_limit_entries
    WHERE key = p_key AND window_start >= v_window_start
    ORDER BY window_start ASC
    LIMIT 1;
    
    RETURN json_build_object(
      'allowed', false,
      'current_count', v_current_count,
      'retry_after_ms', COALESCE(v_retry_after_ms, p_window_ms)
    );
  END IF;
  
  -- Insert or update rate limit entry
  INSERT INTO rate_limit_entries (key, count, window_start)
  VALUES (p_key, 1, date_trunc('second', now()))
  ON CONFLICT (key, window_start) 
  DO UPDATE SET count = rate_limit_entries.count + 1;
  
  RETURN json_build_object(
    'allowed', true,
    'current_count', v_current_count + 1,
    'retry_after_ms', 0
  );
END;
$$;