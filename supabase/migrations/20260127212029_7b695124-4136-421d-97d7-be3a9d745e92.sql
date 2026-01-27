-- Add date_format and timezone columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS date_format text DEFAULT 'DD/MM/YYYY',
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/London';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.date_format IS 'User preferred date format: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD';
COMMENT ON COLUMN public.profiles.timezone IS 'User preferred timezone identifier (e.g., Europe/London, America/New_York)';