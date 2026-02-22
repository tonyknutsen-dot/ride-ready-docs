
-- Add repeat_annually boolean, default false
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS repeat_annually boolean NOT NULL DEFAULT false;

-- Migrate existing data: if auto_create_event was true, set repeat_annually = true
UPDATE public.documents SET repeat_annually = true WHERE auto_create_event = true;

-- Drop the complex fields
ALTER TABLE public.documents DROP COLUMN IF EXISTS recurrence_type;
ALTER TABLE public.documents DROP COLUMN IF EXISTS recurrence_interval_days;
ALTER TABLE public.documents DROP COLUMN IF EXISTS auto_create_event;
