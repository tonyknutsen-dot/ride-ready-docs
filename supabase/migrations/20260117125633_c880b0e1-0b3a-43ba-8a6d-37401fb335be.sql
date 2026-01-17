-- Security Fixes Migration
-- 1. Move extensions from public schema to extensions schema

-- Move uuid-ossp if it exists in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'uuid-ossp' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
  END IF;
END $$;

-- Move pgcrypto if it exists in public  
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pgcrypto' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION pgcrypto SET SCHEMA extensions;
  END IF;
END $$;

-- Move pg_trgm if it exists in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END $$;

-- Move fuzzystrmatch if it exists in public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'fuzzystrmatch' AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION fuzzystrmatch SET SCHEMA extensions;
  END IF;
END $$;

-- 2. Create a secure view for profiles that hides Stripe-sensitive fields
-- Uses actual column names from the profiles table
CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT 
  id,
  user_id,
  company_name,
  showmen_name,
  controller_name,
  address,
  country,
  operator_type,
  app_mode,
  created_at,
  updated_at,
  is_suspended,
  enable_document_versioning,
  custom_terminology,
  -- Derived safe fields
  CASE WHEN subscription_plan IS NOT NULL THEN true ELSE false END as has_subscription,
  CASE WHEN subscription_status = 'trial' THEN true ELSE false END as is_trial,
  CASE WHEN is_suspended THEN suspended_reason ELSE NULL END as suspension_info
FROM public.profiles;

-- 3. Add security documentation comments
COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'SENSITIVE: Access via edge functions only';
COMMENT ON COLUMN public.profiles.stripe_subscription_id IS 'SENSITIVE: Access via edge functions only';
COMMENT ON COLUMN public.marketing_contacts.unsubscribe_token IS 'SENSITIVE: UUID provides entropy for unsubscribe links';
COMMENT ON COLUMN public.marketing_contacts.email IS 'SENSITIVE: Protected by user_id RLS';

-- 4. Add index on unsubscribe_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_marketing_contacts_unsubscribe_token 
ON public.marketing_contacts(unsubscribe_token) 
WHERE unsubscribe_token IS NOT NULL;