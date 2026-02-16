-- Drop the outdated subscription_status constraint
ALTER TABLE public.profiles DROP CONSTRAINT profiles_subscription_status_check;

-- Add updated constraint with all valid subscription statuses
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IS NULL OR subscription_status = ANY (ARRAY[
    'trial', 'active', 'canceled', 'past_due', 'expired', 
    'incomplete', 'incomplete_expired', 'unpaid', 'paused',
    'basic', 'advanced'
  ]));