-- Create bug_reports table
CREATE TABLE public.bug_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  user_email TEXT,
  user_role TEXT DEFAULT 'user',
  
  -- User input fields
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  steps_to_reproduce TEXT,
  expected_result TEXT,
  actual_result TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  issue_type TEXT NOT NULL DEFAULT 'bug',
  screenshot_url TEXT,
  
  -- Auto-captured context
  app_name TEXT,
  app_version TEXT,
  build_date TEXT,
  current_route TEXT,
  device_type TEXT,
  browser_info TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Tester-specific
  is_after_recent_changes BOOLEAN DEFAULT false,
  
  -- Admin triage fields
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to TEXT,
  internal_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sequence for reference IDs
CREATE SEQUENCE bug_report_seq START 1;

-- Function to generate reference ID
CREATE OR REPLACE FUNCTION public.generate_bug_report_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.reference_id := 'BR-' || LPAD(nextval('bug_report_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate reference ID
CREATE TRIGGER set_bug_report_reference
  BEFORE INSERT ON public.bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_bug_report_reference();

-- Trigger for updated_at
CREATE TRIGGER update_bug_reports_updated_at
  BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Policies: Users can create and view their own reports
CREATE POLICY "Users can create bug reports"
  ON public.bug_reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own bug reports"
  ON public.bug_reports
  FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update bug reports"
  ON public.bug_reports
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Create index for common queries
CREATE INDEX idx_bug_reports_status ON public.bug_reports(status);
CREATE INDEX idx_bug_reports_severity ON public.bug_reports(severity);
CREATE INDEX idx_bug_reports_user_id ON public.bug_reports(user_id);
CREATE INDEX idx_bug_reports_created_at ON public.bug_reports(created_at DESC);

-- Create storage bucket for bug report attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-attachments', 'bug-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for bug attachments
CREATE POLICY "Users can upload bug attachments"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'bug-attachments' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own bug attachments"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'bug-attachments' 
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "Admins can view all bug attachments"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'bug-attachments' 
    AND public.has_role(auth.uid(), 'admin')
  );