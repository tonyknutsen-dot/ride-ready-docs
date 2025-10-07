-- Add app_mode column to profiles to store user's preferred mode
ALTER TABLE public.profiles 
ADD COLUMN app_mode text NOT NULL DEFAULT 'documents';

-- Add a check constraint to ensure valid values
ALTER TABLE public.profiles
ADD CONSTRAINT app_mode_check CHECK (app_mode IN ('documents', 'operations'));

COMMENT ON COLUMN public.profiles.app_mode IS 'User preference for app mode: documents (basic features) or operations (advanced features)';