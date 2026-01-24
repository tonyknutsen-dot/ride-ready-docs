-- Fix 1: Force RLS on encryption_keys table to prevent ALL direct access (even table owners)
-- This ensures the ONLY way to access encryption keys is via the SECURITY DEFINER functions
ALTER TABLE public.encryption_keys FORCE ROW LEVEL SECURITY;

-- Add an explicit DENY ALL policy to make the security intent clear
-- (RLS with no policies already blocks all access, but this makes it explicit)
CREATE POLICY "Deny all direct access to encryption_keys" 
ON public.encryption_keys 
FOR ALL 
USING (false);