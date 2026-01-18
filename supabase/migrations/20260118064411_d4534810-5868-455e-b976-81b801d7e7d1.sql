-- Create role change audit log table
CREATE TABLE public.role_change_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  changed_by UUID NOT NULL,
  previous_role TEXT NOT NULL,
  new_role TEXT NOT NULL,
  reason TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view role change audit"
  ON public.role_change_audit
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Only admins can insert audit logs
CREATE POLICY "Admins can insert role change audit"
  ON public.role_change_audit
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create index for faster lookups
CREATE INDEX idx_role_change_audit_user_id ON public.role_change_audit(user_id);
CREATE INDEX idx_role_change_audit_changed_at ON public.role_change_audit(changed_at DESC);