
-- 1. Truncation + rate-limit trigger
CREATE OR REPLACE FUNCTION public.signup_funnel_events_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_recent_count int;
BEGIN
  -- Safe truncation of free-text fields (do not fail the insert)
  IF NEW.page_path IS NOT NULL AND length(NEW.page_path) > 512 THEN
    NEW.page_path := left(NEW.page_path, 512);
  END IF;
  IF NEW.referrer IS NOT NULL AND length(NEW.referrer) > 1024 THEN
    NEW.referrer := left(NEW.referrer, 1024);
  END IF;
  IF NEW.user_agent IS NOT NULL AND length(NEW.user_agent) > 1024 THEN
    NEW.user_agent := left(NEW.user_agent, 1024);
  END IF;
  IF NEW.error_message IS NOT NULL AND length(NEW.error_message) > 1000 THEN
    NEW.error_message := left(NEW.error_message, 1000);
  END IF;
  -- Cap utm fields too
  IF NEW.utm_source IS NOT NULL AND length(NEW.utm_source) > 255 THEN
    NEW.utm_source := left(NEW.utm_source, 255);
  END IF;
  IF NEW.utm_medium IS NOT NULL AND length(NEW.utm_medium) > 255 THEN
    NEW.utm_medium := left(NEW.utm_medium, 255);
  END IF;
  IF NEW.utm_campaign IS NOT NULL AND length(NEW.utm_campaign) > 255 THEN
    NEW.utm_campaign := left(NEW.utm_campaign, 255);
  END IF;

  -- Per-session rate limit: max 60 events per 60s for the same anonymous_session_id
  SELECT count(*) INTO v_recent_count
  FROM public.signup_funnel_events
  WHERE anonymous_session_id = NEW.anonymous_session_id
    AND created_at > now() - interval '60 seconds';

  IF v_recent_count >= 60 THEN
    RAISE EXCEPTION 'signup_funnel_events rate limit exceeded for session'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS signup_funnel_events_guard_trg ON public.signup_funnel_events;
CREATE TRIGGER signup_funnel_events_guard_trg
BEFORE INSERT ON public.signup_funnel_events
FOR EACH ROW EXECUTE FUNCTION public.signup_funnel_events_guard();

-- 2. Replace the wide-open INSERT policy with a validated one
DROP POLICY IF EXISTS "Anyone can insert funnel events" ON public.signup_funnel_events;

CREATE POLICY "Funnel events: validated insert"
ON public.signup_funnel_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Approved event names only
  event_name IN (
    'landing_page_view',
    'cta_click',
    'pricing_click',
    'signup_page_view',
    'signup_submit_attempt',
    'signup_success',
    'signup_failure',
    'onboarding_completed'
  )
  -- Anonymous session id required and within sane bounds
  AND anonymous_session_id IS NOT NULL
  AND length(anonymous_session_id) BETWEEN 8 AND 128
  -- Email is only allowed on signup-related events
  AND (
    email IS NULL
    OR (
      event_name IN ('signup_submit_attempt', 'signup_success', 'signup_failure')
      AND length(email) <= 320
    )
  )
  -- Anonymous callers must not set user_id; authenticated callers may only set their own
  AND (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
  )
);
