-- Drop the existing template_type constraint and recreate it with 'preopening' included
ALTER TABLE public.daily_check_templates 
DROP CONSTRAINT IF EXISTS valid_template_type;

ALTER TABLE public.daily_check_templates 
ADD CONSTRAINT valid_template_type 
CHECK (template_type IN ('daily', 'weekly', 'monthly', 'yearly', 'preopening'));