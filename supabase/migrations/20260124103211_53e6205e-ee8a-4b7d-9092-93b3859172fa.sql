-- Add company logo path column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS company_logo_path TEXT;