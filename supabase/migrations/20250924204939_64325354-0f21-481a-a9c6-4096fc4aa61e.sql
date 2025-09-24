-- Fix the function search path security issue
CREATE OR REPLACE FUNCTION public.initialize_user_trial()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set trial period to 30 days from account creation
  NEW.trial_started_at = now();
  NEW.trial_ends_at = now() + interval '30 days';
  NEW.subscription_status = 'trial';
  RETURN NEW;
END;
$$;