-- Add audit fields to risk_assessments table for tracking changes
ALTER TABLE public.risk_assessments 
ADD COLUMN IF NOT EXISTS last_modified_by TEXT,
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS revision_notes TEXT;

-- Add audit fields to risk_assessment_items table for tracking changes
ALTER TABLE public.risk_assessment_items
ADD COLUMN IF NOT EXISTS last_modified_by TEXT,
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMP WITH TIME ZONE;

-- Create table to store audit history of changes
CREATE TABLE public.risk_assessment_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  risk_assessment_id UUID NOT NULL REFERENCES public.risk_assessments(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  old_values JSONB,
  new_values JSONB,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.risk_assessment_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view audit logs for their assessments
CREATE POLICY "Users can view audit logs for their assessments"
ON public.risk_assessment_audit_log
FOR SELECT
USING (
  risk_assessment_id IN (
    SELECT id FROM public.risk_assessments WHERE user_id = auth.uid()
  )
);

-- Policy: Users can create audit logs for their assessments
CREATE POLICY "Users can create audit logs for their assessments"
ON public.risk_assessment_audit_log
FOR INSERT
WITH CHECK (
  risk_assessment_id IN (
    SELECT id FROM public.risk_assessments WHERE user_id = auth.uid()
  )
);