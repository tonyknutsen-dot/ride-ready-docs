-- Add operator_type column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN operator_type text DEFAULT 'company';

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.operator_type IS 'User preference for terminology: showman, private_operator, or company';