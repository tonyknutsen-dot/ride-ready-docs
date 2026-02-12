
-- Add 'weekly' to the check_frequency enum
ALTER TYPE check_frequency ADD VALUE IF NOT EXISTS 'weekly';

-- Update check constraints on daily_check_templates to include 'weekly'
ALTER TABLE public.daily_check_templates 
  DROP CONSTRAINT IF EXISTS valid_check_frequency;

ALTER TABLE public.daily_check_templates 
  ADD CONSTRAINT valid_check_frequency 
  CHECK (check_frequency IN ('daily', 'weekly', 'monthly', 'yearly', 'preopening', 'custom'));

-- Update check constraints on checks to include 'weekly'
ALTER TABLE public.checks 
  DROP CONSTRAINT IF EXISTS valid_inspection_frequency;

ALTER TABLE public.checks 
  ADD CONSTRAINT valid_inspection_frequency 
  CHECK (check_frequency IN ('daily', 'weekly', 'monthly', 'yearly', 'preopening'));
