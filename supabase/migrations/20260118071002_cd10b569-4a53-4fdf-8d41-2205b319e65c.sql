-- ============================================
-- Move Internal Notes to Admin-Only Table
-- Better security isolation for sensitive data
-- ============================================

-- 1. Create admin-only table for internal bug report data
CREATE TABLE public.bug_report_admin_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bug_report_id UUID NOT NULL UNIQUE REFERENCES public.bug_reports(id) ON DELETE CASCADE,
  internal_notes TEXT,
  assigned_to TEXT,
  priority TEXT DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.bug_report_admin_data ENABLE ROW LEVEL SECURITY;

-- 3. Admin-only policies
CREATE POLICY "Admins can view all admin data"
  ON public.bug_report_admin_data
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert admin data"
  ON public.bug_report_admin_data
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update admin data"
  ON public.bug_report_admin_data
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete admin data"
  ON public.bug_report_admin_data
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Migrate existing data
INSERT INTO public.bug_report_admin_data (bug_report_id, internal_notes, assigned_to)
SELECT id, internal_notes, assigned_to
FROM public.bug_reports
WHERE internal_notes IS NOT NULL OR assigned_to IS NOT NULL;

-- 5. Drop columns from bug_reports (now in admin-only table)
ALTER TABLE public.bug_reports DROP COLUMN IF EXISTS internal_notes;
ALTER TABLE public.bug_reports DROP COLUMN IF EXISTS assigned_to;

-- 6. Add updated_at trigger
CREATE TRIGGER update_bug_report_admin_data_updated_at
  BEFORE UPDATE ON public.bug_report_admin_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();