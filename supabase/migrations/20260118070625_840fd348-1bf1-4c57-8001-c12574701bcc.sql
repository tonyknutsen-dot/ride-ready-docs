-- ============================================
-- GDPR Data Retention Policy for blocked_ips
-- Create cleanup function (to be called by edge function)
-- ============================================

-- Create function to purge old blocked_ips entries (90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_blocked_ips()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete entries older than 90 days
  DELETE FROM public.blocked_ips
  WHERE blocked_at < now() - interval '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;