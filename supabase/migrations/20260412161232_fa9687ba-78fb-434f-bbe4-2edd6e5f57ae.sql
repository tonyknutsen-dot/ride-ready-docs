
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS expiry_acknowledged_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expiry_acknowledged_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expiry_acknowledgement_note text DEFAULT NULL;

COMMENT ON COLUMN public.documents.expiry_acknowledged_at IS 'When the document expiry was reviewed and acknowledged';
COMMENT ON COLUMN public.documents.expiry_acknowledged_by IS 'User who acknowledged the expiry';
COMMENT ON COLUMN public.documents.expiry_acknowledgement_note IS 'Optional note when acknowledging expiry';
