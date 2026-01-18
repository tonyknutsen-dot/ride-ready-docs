-- Drop and recreate profiles_safe view with proper security settings
DROP VIEW IF EXISTS profiles_safe;

-- Recreate with security_invoker to inherit RLS from profiles table
CREATE VIEW profiles_safe 
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  company_name,
  controller_name,
  showmen_name,
  address,
  country,
  operator_type,
  app_mode,
  custom_terminology,
  enable_document_versioning,
  is_suspended,
  created_at,
  updated_at,
  -- Computed fields (safe to expose)
  CASE WHEN subscription_status IS NOT NULL THEN true ELSE false END as has_subscription,
  CASE WHEN trial_ends_at IS NOT NULL AND trial_ends_at > now() THEN true ELSE false END as is_trial,
  CASE WHEN is_suspended THEN suspended_reason ELSE NULL END as suspension_info
FROM profiles;

-- Add comment explaining the view
COMMENT ON VIEW profiles_safe IS 'Safe view of profiles that excludes sensitive payment data. Uses security_invoker to inherit RLS from profiles table.';