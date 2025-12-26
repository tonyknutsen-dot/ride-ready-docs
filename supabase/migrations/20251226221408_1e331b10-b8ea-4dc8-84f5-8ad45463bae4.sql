-- Add is_archived column to daily_check_templates
ALTER TABLE public.daily_check_templates 
ADD COLUMN is_archived boolean NOT NULL DEFAULT false;

-- Add an index for faster filtering
CREATE INDEX idx_daily_check_templates_archived ON public.daily_check_templates(is_archived);