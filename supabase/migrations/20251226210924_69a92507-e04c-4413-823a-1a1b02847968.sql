-- Drop conflicting check constraints that use 'annual' instead of 'yearly'
ALTER TABLE public.daily_check_templates 
DROP CONSTRAINT IF EXISTS daily_check_templates_check_frequency_check;

ALTER TABLE public.daily_check_templates 
DROP CONSTRAINT IF EXISTS daily_check_templates_template_type_check;