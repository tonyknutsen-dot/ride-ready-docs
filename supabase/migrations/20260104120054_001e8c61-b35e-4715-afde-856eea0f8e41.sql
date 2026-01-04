-- Add custom_terminology column to profiles table for user overrides
ALTER TABLE public.profiles
ADD COLUMN custom_terminology jsonb DEFAULT NULL;

-- Add a comment explaining the structure
COMMENT ON COLUMN public.profiles.custom_terminology IS 'Optional user overrides for terminology. Structure: { safetyCertificate?: string, inflatableCertificate?: string, localAuthority?: string, inspector?: string }';