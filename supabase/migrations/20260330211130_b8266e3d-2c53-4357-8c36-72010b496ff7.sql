
-- Create email_send_log table for tracking all outbound emails
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT,
  recipient_email TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for time-range queries
CREATE INDEX idx_email_send_log_created_at ON public.email_send_log(created_at DESC);

-- Index for status filtering
CREATE INDEX idx_email_send_log_status ON public.email_send_log(status);

-- Index for template filtering
CREATE INDEX idx_email_send_log_template ON public.email_send_log(template_name);

-- Index for deduplication by message_id
CREATE INDEX idx_email_send_log_message_id ON public.email_send_log(message_id);

-- RLS: admin-only read access, service-role inserts
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

-- Allow admins to read all logs
CREATE POLICY "Admins can read email logs"
  ON public.email_send_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No client-side writes - edge functions use service_role
