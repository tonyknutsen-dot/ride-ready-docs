
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS upload_status text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS detected_mime_type text,
  ADD COLUMN IF NOT EXISTS checksum text,
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS stored_path text;

-- Enum-like check: allow NULL (legacy) or one of three states for new uploads
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_upload_status_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_upload_status_check
  CHECK (upload_status IS NULL OR upload_status IN ('pending_scan','clean','rejected'));

-- Helpful index for filtered reads (send pack / share)
CREATE INDEX IF NOT EXISTS idx_documents_upload_status
  ON public.documents (upload_status)
  WHERE upload_status IS NOT NULL;

COMMENT ON COLUMN public.documents.upload_status IS
  'NULL = legacy document uploaded before security validation. pending_scan/clean/rejected applies only to uploads made after the security pipeline was introduced.';
