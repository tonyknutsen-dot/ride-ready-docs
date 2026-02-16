
-- Function to check engagement milestones and auto-extend trial to 21 days
CREATE OR REPLACE FUNCTION public.check_trial_engagement_extension()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
  v_ride_count INTEGER;
  v_doc_count INTEGER;
  v_has_template BOOLEAN;
  v_trial_days INTEGER;
  v_new_trial_end TIMESTAMPTZ;
  v_reason TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('extended', false, 'reason', 'not_authenticated');
  END IF;

  -- Get profile
  SELECT trial_started_at, trial_ends_at, subscription_status
  INTO v_profile
  FROM profiles
  WHERE user_id = v_user_id;

  -- Only extend trial users
  IF v_profile.subscription_status != 'trial' THEN
    RETURN json_build_object('extended', false, 'reason', 'not_on_trial');
  END IF;

  -- Check if already extended (trial > 17 days means already at 21)
  v_trial_days := EXTRACT(EPOCH FROM (v_profile.trial_ends_at - v_profile.trial_started_at)) / 86400;
  IF v_trial_days > 17 THEN
    RETURN json_build_object('extended', false, 'reason', 'already_extended');
  END IF;

  -- Check milestones
  SELECT COUNT(*) INTO v_ride_count
  FROM rides WHERE user_id = v_user_id;

  SELECT COUNT(*) INTO v_doc_count
  FROM documents WHERE user_id = v_user_id;

  SELECT EXISTS(
    SELECT 1 FROM daily_check_templates WHERE user_id = v_user_id LIMIT 1
  ) INTO v_has_template;

  -- Determine if any milestone is met
  IF v_ride_count >= 3 THEN
    v_reason := 'added_3_rides';
  ELSIF v_doc_count >= 5 THEN
    v_reason := 'uploaded_5_docs';
  ELSIF v_has_template THEN
    v_reason := 'created_first_checklist';
  ELSE
    RETURN json_build_object('extended', false, 'reason', 'no_milestone_met',
      'rides', v_ride_count, 'docs', v_doc_count, 'has_template', v_has_template);
  END IF;

  -- Extend to 21 days from original start
  v_new_trial_end := v_profile.trial_started_at + interval '21 days';

  UPDATE profiles
  SET trial_ends_at = v_new_trial_end
  WHERE user_id = v_user_id;

  RETURN json_build_object('extended', true, 'reason', v_reason,
    'new_trial_ends_at', v_new_trial_end);
END;
$function$;
