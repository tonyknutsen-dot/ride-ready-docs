-- Fix 1: Restrict check_item_library to authenticated users only
DROP POLICY IF EXISTS "Everyone can view check item library" ON public.check_item_library;

CREATE POLICY "Authenticated users can view check item library"
ON public.check_item_library
FOR SELECT
TO authenticated
USING (true);

-- Fix 2: Recreate profiles_safe view with security_invoker to enforce RLS
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe
WITH (security_invoker = on) AS
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
  (stripe_customer_id IS NOT NULL) AS has_stripe_customer,
  (stripe_subscription_id IS NOT NULL) AS has_stripe_subscription
FROM public.profiles
WHERE (auth.uid() = user_id);