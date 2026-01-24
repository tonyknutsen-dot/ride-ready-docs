-- Drop and recreate the profiles_safe view with proper column exclusion
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe AS
SELECT 
  id,
  user_id,
  company_name,
  controller_name,
  showmen_name,
  address,
  country,
  operator_type,
  custom_terminology,
  enable_document_versioning,
  is_suspended,
  -- Provide safe subscription status info without exposing Stripe IDs
  subscription_status,
  subscription_plan,
  billing_cycle,
  trial_started_at,
  trial_ends_at,
  current_period_end,
  extra_items_count,
  app_mode,
  company_logo_path,
  created_at,
  updated_at,
  -- Computed safe flags (without exposing actual Stripe IDs)
  CASE WHEN stripe_customer_id IS NOT NULL THEN true ELSE false END as has_stripe_customer,
  CASE WHEN stripe_subscription_id IS NOT NULL THEN true ELSE false END as has_stripe_subscription,
  -- Add suspension info if needed without sensitive details
  CASE WHEN is_suspended THEN suspended_reason ELSE NULL END as suspension_info,
  -- Add trial status flag
  CASE WHEN subscription_status = 'trial' AND trial_ends_at > now() THEN true ELSE false END as is_trial,
  -- Add subscription status flag
  CASE WHEN subscription_status IN ('active', 'trial') THEN true ELSE false END as has_subscription
FROM public.profiles
WHERE auth.uid() = user_id;

-- Grant access to authenticated users
GRANT SELECT ON public.profiles_safe TO authenticated;