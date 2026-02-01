-- Create early access signups table for unauthenticated visitors
CREATE TABLE public.early_access_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  source TEXT NOT NULL DEFAULT 'coming_soon',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT early_access_signups_email_unique UNIQUE (email)
);

-- Enable RLS
ALTER TABLE public.early_access_signups ENABLE ROW LEVEL SECURITY;

-- Allow public inserts only (no reads/updates/deletes from client)
CREATE POLICY "Anyone can sign up for early access"
ON public.early_access_signups
FOR INSERT
WITH CHECK (true);

-- Allow service role full access for edge functions
CREATE POLICY "Service role can manage signups"
ON public.early_access_signups
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Admins can view signups
CREATE POLICY "Admins can view early access signups"
ON public.early_access_signups
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for email lookups
CREATE INDEX idx_early_access_signups_email ON public.early_access_signups(email);

-- Add index for created_at for sorting
CREATE INDEX idx_early_access_signups_created_at ON public.early_access_signups(created_at DESC);