-- Create table for blocked IPs
CREATE TABLE public.blocked_ips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  reason TEXT NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  blocked_by TEXT DEFAULT 'system',
  request_count INTEGER,
  unblocked_at TIMESTAMP WITH TIME ZONE,
  unblocked_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast IP lookups
CREATE INDEX idx_blocked_ips_active ON public.blocked_ips (ip_address, is_active, expires_at);
CREATE INDEX idx_blocked_ips_expires ON public.blocked_ips (expires_at) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

-- Only service role can manage blocked IPs (edge functions)
CREATE POLICY "Service role can manage blocked IPs"
ON public.blocked_ips
FOR ALL
USING (true)
WITH CHECK (true);

-- Create function to check if IP is blocked
CREATE OR REPLACE FUNCTION public.is_ip_blocked(p_ip TEXT)
RETURNS TABLE(is_blocked BOOLEAN, reason TEXT, expires_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true AS is_blocked,
    bi.reason,
    bi.expires_at
  FROM public.blocked_ips bi
  WHERE bi.ip_address = p_ip
    AND bi.is_active = true
    AND bi.expires_at > now()
  LIMIT 1;
  
  -- If no rows returned, return not blocked
  IF NOT FOUND THEN
    RETURN QUERY SELECT false AS is_blocked, NULL::TEXT AS reason, NULL::TIMESTAMP WITH TIME ZONE AS expires_at;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to auto-unblock expired IPs (called by cleanup cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_blocks()
RETURNS INTEGER AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  UPDATE public.blocked_ips
  SET is_active = false,
      unblocked_at = now(),
      unblocked_by = 'auto-expire'
  WHERE is_active = true
    AND expires_at <= now();
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;