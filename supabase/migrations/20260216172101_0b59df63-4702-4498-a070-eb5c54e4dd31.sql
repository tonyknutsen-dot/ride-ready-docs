
-- Drop the old restrictive check constraint
ALTER TABLE public.profiles DROP CONSTRAINT profiles_subscription_plan_check;

-- Add updated constraint allowing new ride-based tier names
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_plan_check
  CHECK (subscription_plan IS NULL OR subscription_plan = ANY (ARRAY['basic', 'advanced', 'starter', 'operator', 'professional', 'enterprise']));
