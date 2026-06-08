
-- Add preview columns to documents table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS preview_status text,
  ADD COLUMN IF NOT EXISTS preview_file_path text,
  ADD COLUMN IF NOT EXISTS preview_mime_type text,
  ADD COLUMN IF NOT EXISTS preview_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS preview_failure_reason text;

-- Add CHECK via validation trigger so values stay constrained but flexible
CREATE OR REPLACE FUNCTION public.validate_document_preview_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.preview_status IS NOT NULL
     AND NEW.preview_status NOT IN ('pending','ready','failed','not_supported','not_required') THEN
    RAISE EXCEPTION 'Invalid preview_status: %', NEW.preview_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_validate_preview_status ON public.documents;
CREATE TRIGGER documents_validate_preview_status
BEFORE INSERT OR UPDATE OF preview_status ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.validate_document_preview_status();
