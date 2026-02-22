
-- Add recurrence fields to documents table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS recurrence_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_interval_days integer,
  ADD COLUMN IF NOT EXISTS auto_create_event boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.documents.recurrence_type IS 'none | annual | 6_monthly | quarterly | monthly | custom';
COMMENT ON COLUMN public.documents.recurrence_interval_days IS 'Custom interval in days when recurrence_type = custom';
COMMENT ON COLUMN public.documents.auto_create_event IS 'If true, completing linked compliance event auto-creates next recurring event';
