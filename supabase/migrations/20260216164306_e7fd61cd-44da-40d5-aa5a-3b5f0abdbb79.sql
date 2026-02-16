
-- Update trial initialization to 14 days instead of 30
CREATE OR REPLACE FUNCTION public.initialize_user_trial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.trial_started_at = now();
  NEW.trial_ends_at = now() + interval '14 days';
  NEW.subscription_status = 'trial';
  RETURN NEW;
END;
$function$;
