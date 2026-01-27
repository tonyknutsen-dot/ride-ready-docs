-- Drop the old check constraint
ALTER TABLE public.checks DROP CONSTRAINT IF EXISTS daily_checks_status_check;

-- Add updated check constraint with 'completed' status
ALTER TABLE public.checks ADD CONSTRAINT checks_status_check 
CHECK (status = ANY (ARRAY['passed', 'failed', 'partial', 'completed']));