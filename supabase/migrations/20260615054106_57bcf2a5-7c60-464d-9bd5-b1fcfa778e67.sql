-- Signup funnel events table
CREATE TABLE public.signup_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  anonymous_session_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  page_path text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  user_agent text,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sfe_event_created ON public.signup_funnel_events (event_name, created_at DESC);
CREATE INDEX idx_sfe_session ON public.signup_funnel_events (anonymous_session_id);
CREATE INDEX idx_sfe_created ON public.signup_funnel_events (created_at DESC);

-- Grants: anon + authenticated may INSERT (tracking from any visitor); only admins SELECT
GRANT INSERT ON public.signup_funnel_events TO anon;
GRANT INSERT ON public.signup_funnel_events TO authenticated;
GRANT ALL ON public.signup_funnel_events TO service_role;

ALTER TABLE public.signup_funnel_events ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) may insert a tracking event
CREATE POLICY "Anyone can insert funnel events"
  ON public.signup_funnel_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins may read
CREATE POLICY "Admins can view funnel events"
  ON public.signup_funnel_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));