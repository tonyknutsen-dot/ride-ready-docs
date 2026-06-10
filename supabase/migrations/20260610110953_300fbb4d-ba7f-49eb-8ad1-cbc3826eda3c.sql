
-- Server-side fallback: when a new organisation is created (which only happens
-- once per controller signup via auto_create_organisation), asynchronously call
-- the internal-new-signup-alert edge function. The function itself dedups via
-- email_send_log and skips staff-invite emails, so this is safe to fire even
-- if the client-side AuthContext.signUp path already invoked it.

CREATE OR REPLACE FUNCTION public.trigger_internal_signup_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
  v_url text := 'https://sbtldudgiskqfqqkrmaa.supabase.co/functions/v1/internal-new-signup-alert';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidGxkdWRnaXNrcWZxcWtybWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MzA1NzMsImV4cCI6MjA3NDMwNjU3M30.I0WeylvH8HQzNROhpqsfvd5HCKxX21DbC0g6AN0dwb8';
BEGIN
  -- Get the owner's email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.owner_id;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;

  -- Fire-and-forget HTTP call. pg_net runs async and never blocks the insert.
  BEGIN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon
      ),
      body := jsonb_build_object('email', v_email, 'source', 'db_trigger')
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never block signup if pg_net is unavailable
    RAISE LOG 'trigger_internal_signup_alert pg_net error: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_internal_signup_alert ON public.organisations;
CREATE TRIGGER trg_internal_signup_alert
AFTER INSERT ON public.organisations
FOR EACH ROW
EXECUTE FUNCTION public.trigger_internal_signup_alert();
