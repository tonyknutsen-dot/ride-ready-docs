-- Billing sync log: captures every webhook event, polling sync, and manual resync
CREATE TABLE public.billing_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  stripe_event_id text,
  stripe_subscription_id text,
  stripe_customer_id text,
  previous_status text,
  new_status text,
  previous_plan text,
  new_plan text,
  stripe_status text,
  stripe_plan text,
  mismatch_detected boolean DEFAULT false,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_billing_sync_log_user ON public.billing_sync_log(user_id, created_at DESC);
CREATE INDEX idx_billing_sync_log_event_type ON public.billing_sync_log(event_type, created_at DESC);
CREATE INDEX idx_billing_sync_log_mismatch ON public.billing_sync_log(mismatch_detected, created_at DESC) WHERE mismatch_detected = true;

ALTER TABLE public.billing_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read billing sync logs"
ON public.billing_sync_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_billing_sync_at timestamptz;