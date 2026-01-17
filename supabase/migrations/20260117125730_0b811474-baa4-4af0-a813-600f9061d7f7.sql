-- Fix Security Issues - Final
-- 1. Recreate view with SECURITY INVOKER
-- 2. Move movable extensions from public (excluding system extensions)

-- Drop and recreate view with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe 
WITH (security_invoker = true) AS
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
  CASE WHEN subscription_plan IS NOT NULL THEN true ELSE false END as has_subscription,
  CASE WHEN subscription_status = 'trial' THEN true ELSE false END as is_trial,
  CASE WHEN is_suspended THEN suspended_reason ELSE NULL END as suspension_info
FROM public.profiles;

-- Move extensions from public to extensions schema
-- Excluding pg_net which is a Supabase system extension that cannot be moved
DO $$
DECLARE
  ext_record RECORD;
BEGIN
  FOR ext_record IN 
    SELECT e.extname 
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE n.nspname = 'public'
    AND e.extname NOT IN ('pg_net', 'plpgsql', 'pg_graphql', 'supabase_vault', 'pgsodium')
  LOOP
    BEGIN
      EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext_record.extname);
      RAISE NOTICE 'Moved extension % to extensions schema', ext_record.extname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not move extension %: %', ext_record.extname, SQLERRM;
    END;
  END LOOP;
END $$;