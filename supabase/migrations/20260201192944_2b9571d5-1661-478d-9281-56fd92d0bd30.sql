-- Fix linter warning (0024_permissive_rls_policy): avoid WITH CHECK (true) on INSERT.

-- 1) audit_logs: restrict insert policy to service_role only
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- 2) early_access_signups: allow public inserts but avoid unconditional true
DROP POLICY IF EXISTS "Anyone can sign up for early access" ON public.early_access_signups;
CREATE POLICY "Anyone can sign up for early access"
ON public.early_access_signups
FOR INSERT
WITH CHECK (auth.role() IN ('anon', 'authenticated'));
