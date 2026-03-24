
-- Billing account flags: lightweight flagged-account tracking for admin triage
CREATE TABLE public.billing_account_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flag_reason text NOT NULL,  -- past_due, failed_payment, no_stripe_link, status_mismatch, plan_mismatch, stale_sync, cancellation_pending, manual_review
  severity text NOT NULL DEFAULT 'warning',  -- critical, warning, info
  review_status text NOT NULL DEFAULT 'new',  -- new, under_review, waiting, resolved, ignored
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  auto_detected boolean NOT NULL DEFAULT true,
  source_details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, flag_reason)
);

-- Index for fast admin queries
CREATE INDEX idx_billing_flags_status ON public.billing_account_flags (review_status) WHERE review_status NOT IN ('resolved', 'ignored');
CREATE INDEX idx_billing_flags_user ON public.billing_account_flags (user_id);

-- RLS: only admins via edge functions (service role)
ALTER TABLE public.billing_account_flags ENABLE ROW LEVEL SECURITY;

-- Admin read access
CREATE POLICY "Admins can manage billing flags"
  ON public.billing_account_flags
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_billing_flags_updated_at
  BEFORE UPDATE ON public.billing_account_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
