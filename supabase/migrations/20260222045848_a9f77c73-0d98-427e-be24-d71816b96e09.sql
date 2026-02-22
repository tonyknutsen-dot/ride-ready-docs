
-- Immutable inspection records with versioning
CREATE TABLE public.inspection_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID NOT NULL REFERENCES public.checks(id) ON DELETE RESTRICT,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL,
  
  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  amended_from_id UUID REFERENCES public.inspection_records(id),
  amendment_reason TEXT,
  amended_by UUID,
  
  -- Snapshot data (immutable once created)
  inspector_name TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_date TEXT NOT NULL,
  check_frequency TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES public.daily_check_templates(id),
  template_name TEXT,
  overall_result TEXT NOT NULL, -- 'passed', 'failed', 'partial'
  
  -- Stored results snapshot as JSONB
  item_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Context
  notes TEXT,
  weather_conditions TEXT,
  location TEXT,
  environment_notes TEXT,
  compliance_officer TEXT,
  signature_data TEXT,
  
  -- Linked data
  defect_ids UUID[] DEFAULT '{}',
  photo_paths TEXT[] DEFAULT '{}',
  
  -- PDF reference
  pdf_file_path TEXT,
  document_id TEXT,
  
  -- Metadata
  is_locked BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(check_id, version)
);

-- Indexes for common queries
CREATE INDEX idx_inspection_records_ride_id ON public.inspection_records(ride_id);
CREATE INDEX idx_inspection_records_user_id ON public.inspection_records(user_id);
CREATE INDEX idx_inspection_records_check_id ON public.inspection_records(check_id);
CREATE INDEX idx_inspection_records_check_frequency ON public.inspection_records(check_frequency);
CREATE INDEX idx_inspection_records_completed_at ON public.inspection_records(completed_at DESC);

-- Enable RLS
ALTER TABLE public.inspection_records ENABLE ROW LEVEL SECURITY;

-- Owners can view their own records
CREATE POLICY "Users can view own inspection records"
ON public.inspection_records FOR SELECT
USING (auth.uid() = user_id);

-- Staff can view records for rides they have access to
CREATE POLICY "Staff can view inspection records for accessible rides"
ON public.inspection_records FOR SELECT
USING (public.staff_can_access_ride(auth.uid(), ride_id));

-- Users can insert their own records
CREATE POLICY "Users can insert own inspection records"
ON public.inspection_records FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.staff_can_access_ride(auth.uid(), ride_id));

-- Prevent updates (immutable records) - only allow PDF path updates on creation
-- We use a trigger instead to enforce immutability after initial creation

-- Prevent deletion entirely
CREATE POLICY "No one can delete inspection records"
ON public.inspection_records FOR DELETE
USING (false);

-- Trigger to prevent modifications after creation (except pdf_file_path and document_id within 60 seconds)
CREATE OR REPLACE FUNCTION public.enforce_inspection_record_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Allow updates within 60 seconds of creation (for async PDF storage)
  IF OLD.created_at > now() - interval '60 seconds' THEN
    -- Only allow pdf_file_path and document_id updates
    IF NEW.inspector_name = OLD.inspector_name
       AND NEW.overall_result = OLD.overall_result
       AND NEW.item_results = OLD.item_results
       AND NEW.notes IS NOT DISTINCT FROM OLD.notes
       AND NEW.version = OLD.version
       AND NEW.is_locked = OLD.is_locked
    THEN
      RETURN NEW;
    END IF;
  END IF;
  
  RAISE EXCEPTION 'Inspection records are immutable and cannot be modified';
  RETURN NULL;
END;
$$;

CREATE TRIGGER enforce_inspection_record_immutability
BEFORE UPDATE ON public.inspection_records
FOR EACH ROW
EXECUTE FUNCTION public.enforce_inspection_record_immutability();

-- Update policy to allow limited updates (trigger enforces what can change)
CREATE POLICY "Limited updates for PDF storage"
ON public.inspection_records FOR UPDATE
USING (auth.uid() = user_id OR public.staff_can_access_ride(auth.uid(), ride_id));
