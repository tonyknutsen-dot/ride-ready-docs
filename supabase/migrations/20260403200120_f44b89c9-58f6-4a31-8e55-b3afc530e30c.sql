-- Fix 1: Harden support_access_grants INSERT policy to require granted_to_admin
-- This prevents NULL granted_to_admin rows that would give ALL admins access

DROP POLICY IF EXISTS "Users can create their own grants" ON public.support_access_grants;

CREATE POLICY "Users can create their own grants"
  ON public.support_access_grants
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND granted_to_admin IS NOT NULL
  );

-- Fix 2: Also update admin_has_support_access function to be defensive
-- Remove the OR granted_to_admin IS NULL fallback
CREATE OR REPLACE FUNCTION public.admin_has_support_access(_admin_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_access_grants
    WHERE granted_to_admin = _admin_id
      AND user_id = _user_id
      AND status = 'active'
      AND expires_at > now()
  )
$$;