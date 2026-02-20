
-- Drop and recreate the function with updated logic
DROP FUNCTION IF EXISTS public.upsert_ride_document(uuid,text,text,text,text,text,uuid,jsonb);

CREATE OR REPLACE FUNCTION public.upsert_ride_document(
  p_ride_id uuid,
  p_ride_code text,
  p_document_type text,
  p_document_id text,
  p_file_url text,
  p_title text,
  p_related_event_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_version integer;
  v_new_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  -- Mark all existing active versions as superseded
  UPDATE public.ride_documents
  SET status = 'superseded',
      updated_at = now(),
      updated_by = v_user_id
  WHERE document_id = p_document_id
    AND status = 'active';

  -- Get next version number
  SELECT get_next_ride_document_version(p_document_id) INTO v_next_version;

  -- Insert new version
  INSERT INTO public.ride_documents (
    ride_id, ride_code, document_type, document_id,
    version, created_by, file_url, related_event_id,
    status, title, metadata, updated_at, updated_by
  ) VALUES (
    p_ride_id, p_ride_code, p_document_type, p_document_id,
    v_next_version, v_user_id, p_file_url, p_related_event_id,
    'active', p_title, p_metadata, now(), v_user_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id::text;
END;
$$;
