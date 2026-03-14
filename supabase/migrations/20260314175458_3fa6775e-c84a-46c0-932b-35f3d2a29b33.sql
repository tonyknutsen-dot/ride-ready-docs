CREATE OR REPLACE FUNCTION public.subscription_allows_writes(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_target_user_id uuid;
BEGIN
  -- Testers always allowed
  IF public.is_tester(_user_id) THEN RETURN true; END IF;

  -- If user is staff, check org owner's subscription instead
  SELECT o.owner_id INTO v_target_user_id
  FROM organisation_members om
  JOIN organisations o ON o.id = om.organisation_id
  WHERE om.user_id = _user_id AND om.is_active = true
  LIMIT 1;

  -- If not staff, check own subscription
  IF v_target_user_id IS NULL THEN
    v_target_user_id := _user_id;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = v_target_user_id
    AND (
      subscription_status IN ('active', 'basic', 'advanced')
      OR (subscription_status = 'trial' AND trial_ends_at > now())
      -- Grace period: past_due users retain write access until their paid period ends
      OR (subscription_status = 'past_due' AND current_period_end > now())
    )
  );
END;
$function$;