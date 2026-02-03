-- Add function to get total tester time per user
CREATE OR REPLACE FUNCTION public.get_tester_usage_summary()
RETURNS TABLE (
  user_id uuid,
  total_sessions integer,
  total_minutes numeric,
  first_session_at timestamptz,
  last_session_at timestamptz,
  active_session boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    ts.user_id,
    COUNT(*)::integer AS total_sessions,
    COALESCE(SUM(
      CASE 
        WHEN ts.session_end IS NULL THEN 
          EXTRACT(EPOCH FROM (now() - ts.session_start)) / 60
        ELSE 
          COALESCE(ts.duration_minutes, 0)
      END
    ), 0) AS total_minutes,
    MIN(ts.session_start) AS first_session_at,
    MAX(COALESCE(ts.session_end, ts.last_heartbeat)) AS last_session_at,
    BOOL_OR(ts.session_end IS NULL) AS active_session
  FROM tester_sessions ts
  GROUP BY ts.user_id
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.get_tester_usage_summary() TO authenticated;