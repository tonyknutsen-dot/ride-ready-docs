
-- Add superseded_by_id column to inspection_records
ALTER TABLE public.inspection_records
ADD COLUMN superseded_by_id UUID REFERENCES public.inspection_records(id);

CREATE INDEX idx_inspection_records_superseded ON public.inspection_records(superseded_by_id);
