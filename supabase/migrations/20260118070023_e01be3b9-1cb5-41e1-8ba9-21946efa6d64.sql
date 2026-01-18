-- ============================================
-- Fix Critical RLS Issues
-- ============================================

-- 1. Fix profiles_safe VIEW - add security barrier to respect underlying table RLS
-- Drop and recreate the view with security_invoker = true (Postgres 15+)
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe 
WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  company_name,
  controller_name,
  showmen_name,
  operator_type,
  address,
  country,
  app_mode,
  custom_terminology,
  enable_document_versioning,
  is_suspended,
  created_at,
  updated_at,
  -- Computed fields for safe exposure
  CASE WHEN subscription_status IS NOT NULL THEN true ELSE false END as has_subscription,
  CASE WHEN subscription_status = 'trial' THEN true ELSE false END as is_trial,
  CASE WHEN is_suspended THEN suspended_reason ELSE NULL END as suspension_info
FROM public.profiles;

-- Grant access to authenticated users
GRANT SELECT ON public.profiles_safe TO authenticated;

-- 2. Fix rate_limit_entries - add policy for service role only (used by edge functions)
-- This table should only be accessible via database functions, not directly
CREATE POLICY "Service role can manage rate limits"
  ON public.rate_limit_entries
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Also allow the check_rate_limit function to work (it's SECURITY DEFINER)
-- The function already runs with definer privileges, so no additional policy needed

-- 3. Strengthen bug_reports - ensure users can only update their own reports
-- Add delete policy (missing)
CREATE POLICY "Users can delete their own bug reports"
  ON public.bug_reports
  FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Strengthen tester_invites - add policy for users to see their own accepted invites
CREATE POLICY "Users can view invites sent to their email"
  ON public.tester_invites
  FOR SELECT
  TO authenticated
  USING (
    -- User can see invite if they accepted it
    auth.uid() = accepted_by
  );

-- 5. Add delete policy for tester_invites (admin only)
CREATE POLICY "Admins can delete invites"
  ON public.tester_invites
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));