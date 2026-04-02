
ALTER TABLE public.checks ADD COLUMN IF NOT EXISTS performed_by_user_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN public.checks.performed_by_user_id IS 'The actual user who performed the check (for forensic attribution). Distinct from user_id which is the org owner for data scoping.';
