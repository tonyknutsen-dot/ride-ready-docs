-- ============================================
-- Fix Warning-Level RLS Issues
-- Tighten overly permissive policies
-- ============================================

-- 1. Fix blocked_ips - replace "true" policy with proper service role check
DROP POLICY IF EXISTS "Service role can manage blocked IPs" ON public.blocked_ips;

-- Service role access (for edge functions) - use proper role check
CREATE POLICY "Service role can manage blocked IPs"
  ON public.blocked_ips
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Admin read access (for security dashboard)
CREATE POLICY "Admins can view blocked IPs"
  ON public.blocked_ips
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin update access (for unblocking)
CREATE POLICY "Admins can update blocked IPs"
  ON public.blocked_ips
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));