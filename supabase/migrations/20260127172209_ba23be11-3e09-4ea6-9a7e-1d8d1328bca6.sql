-- Drop the existing constraint and recreate it with 'preopening' included
ALTER TABLE public.daily_check_templates 
DROP CONSTRAINT IF EXISTS valid_check_frequency;

ALTER TABLE public.daily_check_templates 
ADD CONSTRAINT valid_check_frequency 
CHECK (check_frequency IN ('daily', 'weekly', 'monthly', 'yearly', 'preopening'));