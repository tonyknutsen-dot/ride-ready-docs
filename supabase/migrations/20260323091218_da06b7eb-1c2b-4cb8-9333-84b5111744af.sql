ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS pending_subscription_plan text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pending_change_effective_date timestamptz DEFAULT NULL;