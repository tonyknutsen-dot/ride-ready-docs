CREATE OR REPLACE FUNCTION public.can_add_billable_ride(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan text;
  v_status text;
  v_trial_end timestamptz;
  v_max_rides int;
  v_current_count int;
BEGIN
  -- Testers bypass
  IF public.is_tester(_user_id) THEN RETURN true; END IF;

  -- Get subscription info
  SELECT subscription_plan, subscription_status, trial_ends_at
  INTO v_plan, v_status, v_trial_end
  FROM profiles WHERE user_id = _user_id;

  -- Trial users: allow up to business max (50) during trial
  IF v_status = 'trial' AND v_trial_end > now() THEN
    RETURN true;
  END IF;

  -- Expired users cannot add items at all
  IF v_status NOT IN ('active', 'past_due', 'basic', 'advanced') THEN
    RETURN false;
  END IF;

  -- Determine max items for plan (single tier, not cumulative)
  v_max_rides := CASE COALESCE(v_plan, 'starter')
    WHEN 'starter' THEN 5
    WHEN 'operator' THEN 12
    WHEN 'professional' THEN 25
    WHEN 'business' THEN 50
    WHEN 'enterprise' THEN 50  -- legacy fallback
    ELSE 5
  END;

  -- Count current billable items
  SELECT COUNT(*) INTO v_current_count
  FROM rides r
  JOIN ride_categories rc ON r.category_id = rc.id
  WHERE r.user_id = _user_id AND rc.is_billable = true;

  RETURN v_current_count < v_max_rides;
END;
$function$;