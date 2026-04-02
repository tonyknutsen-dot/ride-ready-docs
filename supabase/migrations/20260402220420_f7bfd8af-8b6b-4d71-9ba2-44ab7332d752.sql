-- Add forensic logger attribution to maintenance_records
ALTER TABLE public.maintenance_records 
ADD COLUMN IF NOT EXISTS logged_by_user_id uuid REFERENCES auth.users(id);

-- Backfill old records: set logged_by_user_id = user_id (best available data)
UPDATE public.maintenance_records SET logged_by_user_id = user_id WHERE logged_by_user_id IS NULL;

-- Add index for staff visibility queries
CREATE INDEX IF NOT EXISTS idx_maintenance_records_logged_by_user_id ON public.maintenance_records(logged_by_user_id);