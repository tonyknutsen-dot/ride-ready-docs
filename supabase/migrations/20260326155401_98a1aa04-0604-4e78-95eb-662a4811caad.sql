-- Fix: marketing_contacts has only RESTRICTIVE policies and no PERMISSIVE ones.
-- PostgreSQL requires at least one PERMISSIVE policy to return any rows.
-- Change the user-scoping policy to PERMISSIVE (it was incorrectly RESTRICTIVE).

DROP POLICY IF EXISTS "Users can manage their own marketing contacts" ON public.marketing_contacts;

CREATE POLICY "Users can manage their own marketing contacts"
ON public.marketing_contacts
AS PERMISSIVE
FOR ALL
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- The "Deny anonymous access" RESTRICTIVE policy stays as-is — it correctly blocks unauthenticated access.