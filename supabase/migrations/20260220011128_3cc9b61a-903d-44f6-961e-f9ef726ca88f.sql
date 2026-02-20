
-- Add missing composite indexes
CREATE INDEX IF NOT EXISTS idx_ride_documents_ride_type_status ON public.ride_documents (ride_id, document_type, status);
CREATE INDEX IF NOT EXISTS idx_ride_documents_ride_archived ON public.ride_documents (ride_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_ride_documents_docid_version ON public.ride_documents (document_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ride_documents_docid_version_unique ON public.ride_documents (document_id, version);

-- Make title NOT NULL (set default for any existing rows)
UPDATE public.ride_documents SET title = document_id WHERE title IS NULL;
ALTER TABLE public.ride_documents ALTER COLUMN title SET NOT NULL;

-- Helper function to get next version
CREATE OR REPLACE FUNCTION public.get_next_ride_document_version(p_document_id TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(MAX(version), 0) + 1
  FROM public.ride_documents
  WHERE document_id = p_document_id;
$$;

-- Upsert function with versioning
CREATE OR REPLACE FUNCTION public.upsert_ride_document(
  p_ride_id UUID,
  p_ride_code TEXT,
  p_document_type TEXT,
  p_document_id TEXT,
  p_file_url TEXT,
  p_title TEXT,
  p_related_event_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next_version INTEGER;
  v_new_id UUID;
BEGIN
  -- Mark all existing active versions as superseded
  UPDATE public.ride_documents
  SET status = 'superseded'
  WHERE document_id = p_document_id
    AND status = 'active';

  -- Get next version
  v_next_version := public.get_next_ride_document_version(p_document_id);

  -- Insert new version
  INSERT INTO public.ride_documents (
    ride_id, ride_code, document_type, document_id,
    version, created_by, file_url, related_event_id,
    status, title, metadata
  ) VALUES (
    p_ride_id, p_ride_code, p_document_type, p_document_id,
    v_next_version, auth.uid(), p_file_url, p_related_event_id,
    'active', p_title, p_metadata
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Remove any DELETE policies (enforce no-delete rule)
DROP POLICY IF EXISTS "Users can delete their own ride documents" ON public.ride_documents;
