-- Add trial and subscription tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'basic', 'advanced', 'expired')),
ADD COLUMN subscription_plan TEXT CHECK (subscription_plan IN ('basic', 'advanced'));

-- Create function to initialize trial period
CREATE OR REPLACE FUNCTION public.initialize_user_trial()
RETURNS TRIGGER AS $$
BEGIN
  -- Set trial period to 30 days from account creation
  NEW.trial_started_at = now();
  NEW.trial_ends_at = now() + interval '30 days';
  NEW.subscription_status = 'trial';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-initialize trial for new profiles
CREATE TRIGGER initialize_trial_on_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_trial();

-- Update existing profiles to have trial period
UPDATE public.profiles 
SET 
  trial_started_at = created_at,
  trial_ends_at = created_at + interval '30 days',
  subscription_status = CASE 
    WHEN created_at + interval '30 days' > now() THEN 'trial'
    ELSE 'expired'
  END
WHERE trial_started_at IS NULL;