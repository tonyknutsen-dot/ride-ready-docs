-- Add forensic reporter attribution to defects
ALTER TABLE public.defects 
ADD COLUMN IF NOT EXISTS reported_by_user_id uuid REFERENCES auth.users(id);

-- Backfill old records: set reported_by_user_id = user_id (best available data)
UPDATE public.defects SET reported_by_user_id = user_id WHERE reported_by_user_id IS NULL;

-- Add index for staff visibility queries
CREATE INDEX IF NOT EXISTS idx_defects_reported_by_user_id ON public.defects(reported_by_user_id);