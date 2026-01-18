-- Create tester_invites table to store invite tokens
CREATE TABLE public.tester_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  invite_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tester_invites ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage invites
CREATE POLICY "Admins can view all invites"
ON public.tester_invites
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create invites"
ON public.tester_invites
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update invites"
ON public.tester_invites
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow anonymous access for invite verification (via service role in edge function)
-- The edge function will verify the token

-- Create index for faster token lookups
CREATE INDEX idx_tester_invites_token ON public.tester_invites(invite_token);
CREATE INDEX idx_tester_invites_email ON public.tester_invites(email);
CREATE INDEX idx_tester_invites_status ON public.tester_invites(status);