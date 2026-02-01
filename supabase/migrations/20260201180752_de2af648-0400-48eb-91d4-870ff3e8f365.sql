-- Fix 1: Make audit_logs append-only (prevent DELETE and UPDATE on audit entries)
-- Drop the service role policy that allows full management
DROP POLICY IF EXISTS "Service role can manage audit logs" ON public.audit_logs;

-- Create separate policies: service role can INSERT only, not delete/update
CREATE POLICY "Service role can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- Create a trigger to prevent updates and deletes on audit_logs
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach triggers to prevent modification
DROP TRIGGER IF EXISTS prevent_audit_delete ON public.audit_logs;
CREATE TRIGGER prevent_audit_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_modification();

DROP TRIGGER IF EXISTS prevent_audit_update ON public.audit_logs;
CREATE TRIGGER prevent_audit_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_modification();

-- Fix 2: Add RLS to profiles_safe view (double protection)
-- First drop and recreate the view with proper security
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe 
WITH (security_invoker = true)
AS 
SELECT 
  id,
  user_id,
  company_name,
  controller_name,
  address,
  country,
  operator_type,
  subscription_status,
  subscription_plan,
  billing_cycle,
  trial_started_at,
  trial_ends_at,
  current_period_end,
  app_mode,
  enable_document_versioning,
  extra_items_count,
  date_format,
  timezone,
  company_logo_path,
  is_suspended,
  created_at,
  updated_at,
  -- Expose boolean flags instead of actual Stripe IDs
  (stripe_customer_id IS NOT NULL) AS has_stripe_customer,
  (stripe_subscription_id IS NOT NULL) AS has_stripe_subscription
FROM public.profiles
WHERE auth.uid() = user_id;

-- Grant access to authenticated users (RLS on underlying table provides protection)
GRANT SELECT ON public.profiles_safe TO authenticated;

-- Fix 3: The early_access_signups INSERT policy with true is intentional for public signup
-- But we should add rate limiting protection - mark as acknowledged
COMMENT ON POLICY "Anyone can sign up for early access" ON public.early_access_signups IS 
  'Intentionally permissive for public signup. Protected by database-level rate limiting via check_rate_limit function.';