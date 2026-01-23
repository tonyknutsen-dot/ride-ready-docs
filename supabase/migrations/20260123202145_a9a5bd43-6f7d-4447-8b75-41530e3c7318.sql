
-- Fix marketing_contacts RLS policies
-- The current policies are PERMISSIVE which means users can access data if they satisfy ANY policy
-- We need RESTRICTIVE policies so that both conditions must be met

-- First, drop the existing policies
DROP POLICY IF EXISTS "Deny anonymous access to marketing_contacts" ON public.marketing_contacts;
DROP POLICY IF EXISTS "Users can manage their own marketing contacts" ON public.marketing_contacts;

-- Create RESTRICTIVE policy to require authentication (must be met)
CREATE POLICY "Deny anonymous access to marketing_contacts"
ON public.marketing_contacts
AS RESTRICTIVE
FOR ALL
USING (auth.role() = 'authenticated'::text);

-- Create RESTRICTIVE policy to restrict to own data only (must be met)  
CREATE POLICY "Users can manage their own marketing contacts"
ON public.marketing_contacts
AS RESTRICTIVE
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
