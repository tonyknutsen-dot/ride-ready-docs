CREATE OR REPLACE FUNCTION public.enforce_inspection_record_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Permit attaching generated PDF metadata after creation, even if PDF
  -- generation finishes later than the original short mobile/browser window.
  -- No inspection/check content may change through this path.
  IF NEW.check_id = OLD.check_id
     AND NEW.ride_id = OLD.ride_id
     AND NEW.user_id = OLD.user_id
     AND NEW.version = OLD.version
     AND NEW.amended_from_id IS NOT DISTINCT FROM OLD.amended_from_id
     AND NEW.amendment_reason IS NOT DISTINCT FROM OLD.amendment_reason
     AND NEW.amended_by IS NOT DISTINCT FROM OLD.amended_by
     AND NEW.superseded_by_id IS NOT DISTINCT FROM OLD.superseded_by_id
     AND NEW.inspector_name = OLD.inspector_name
     AND NEW.completed_at = OLD.completed_at
     AND NEW.check_date = OLD.check_date
     AND NEW.check_frequency = OLD.check_frequency
     AND NEW.template_id = OLD.template_id
     AND NEW.template_name IS NOT DISTINCT FROM OLD.template_name
     AND NEW.overall_result = OLD.overall_result
     AND NEW.item_results = OLD.item_results
     AND NEW.notes IS NOT DISTINCT FROM OLD.notes
     AND NEW.weather_conditions IS NOT DISTINCT FROM OLD.weather_conditions
     AND NEW.location IS NOT DISTINCT FROM OLD.location
     AND NEW.environment_notes IS NOT DISTINCT FROM OLD.environment_notes
     AND NEW.compliance_officer IS NOT DISTINCT FROM OLD.compliance_officer
     AND NEW.signature_data IS NOT DISTINCT FROM OLD.signature_data
     AND NEW.defect_ids IS NOT DISTINCT FROM OLD.defect_ids
     AND NEW.photo_paths IS NOT DISTINCT FROM OLD.photo_paths
     AND NEW.is_locked = OLD.is_locked
     AND NEW.created_at = OLD.created_at
     AND (OLD.pdf_file_path IS NULL OR NEW.pdf_file_path = OLD.pdf_file_path)
     AND (OLD.document_id IS NULL OR NEW.document_id = OLD.document_id)
     AND (NEW.pdf_file_path IS NOT NULL OR NEW.document_id IS NOT NULL)
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Inspection records are immutable and cannot be modified';
  RETURN NULL;
END;
$$;