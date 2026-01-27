-- Add location column to checks table for capturing where the check was performed
ALTER TABLE public.checks 
ADD COLUMN IF NOT EXISTS location TEXT NULL;

-- Add a comment to document the column
COMMENT ON COLUMN public.checks.location IS 'Location where the check was performed (address or GPS coordinates)';