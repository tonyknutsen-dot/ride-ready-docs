-- Support access grants table for user-requested admin access
CREATE TABLE public.support_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  granted_to_admin UUID,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  access_scope TEXT NOT NULL DEFAULT 'read_only',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_status CHECK (status IN ('active', 'expired', 'revoked')),
  CONSTRAINT valid_access_scope CHECK (access_scope IN ('read_only'))
);

-- Enable RLS
ALTER TABLE public.support_access_grants ENABLE ROW LEVEL SECURITY;

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to support_access_grants"
  ON public.support_access_grants
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Users can view their own grants
CREATE POLICY "Users can view their own grants"
  ON public.support_access_grants
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own grants
CREATE POLICY "Users can create their own grants"
  ON public.support_access_grants
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can revoke their own grants (update to revoked status only)
CREATE POLICY "Users can revoke their own grants"
  ON public.support_access_grants
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can view all grants
CREATE POLICY "Admins can view all grants"
  ON public.support_access_grants
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Admins can update grants (to assign themselves)
CREATE POLICY "Admins can update grants"
  ON public.support_access_grants
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Function to check if admin has active support access to a user's data
CREATE OR REPLACE FUNCTION public.admin_has_support_access(_admin_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_access_grants
    WHERE (granted_to_admin = _admin_id OR granted_to_admin IS NULL)
      AND user_id = _user_id
      AND status = 'active'
      AND expires_at > now()
  )
$$;

-- Function to auto-expire grants (for scheduled cleanup)
CREATE OR REPLACE FUNCTION public.expire_support_grants()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.support_access_grants
  SET status = 'expired'
  WHERE status = 'active' AND expires_at <= now();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

-- Create index for efficient lookups
CREATE INDEX idx_support_access_grants_user_id ON public.support_access_grants(user_id);
CREATE INDEX idx_support_access_grants_status ON public.support_access_grants(status) WHERE status = 'active';
CREATE INDEX idx_support_access_grants_expires ON public.support_access_grants(expires_at) WHERE status = 'active';