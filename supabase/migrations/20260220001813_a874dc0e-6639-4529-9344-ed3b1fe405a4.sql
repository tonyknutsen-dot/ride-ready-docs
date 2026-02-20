
-- Add inspector/company and certificate reference fields to compliance_events
ALTER TABLE public.compliance_events
  ADD COLUMN IF NOT EXISTS inspector_company text,
  ADD COLUMN IF NOT EXISTS certificate_reference text;
