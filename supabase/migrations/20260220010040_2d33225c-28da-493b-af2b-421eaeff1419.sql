
-- Table for generated PDF registry with versioning + archive
CREATE TABLE public.ride_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  ride_code text NOT NULL,
  document_type text NOT NULL, -- CR, MR, TL, CH, IC, RA
  document_id text NOT NULL, -- e.g. TC-CR-2026-0001
  version integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  file_url text NOT NULL,
  related_event_id uuid,
  status text NOT NULL DEFAULT 'active', -- active / superseded
  -- Archive fields
  archived_at timestamp with time zone,
  archived_by uuid,
  archive_reason text,
  -- Metadata
  title text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_ride_documents_ride_id ON public.ride_documents(ride_id);
CREATE INDEX idx_ride_documents_document_id ON public.ride_documents(document_id);
CREATE INDEX idx_ride_documents_status ON public.ride_documents(status);
CREATE INDEX idx_ride_documents_archived ON public.ride_documents(archived_at);

-- Enable RLS
ALTER TABLE public.ride_documents ENABLE ROW LEVEL SECURITY;

-- Owners can manage their ride documents
CREATE POLICY "Owners can manage ride_documents"
ON public.ride_documents
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = ride_documents.ride_id AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = ride_documents.ride_id AND r.user_id = auth.uid()
  )
);

-- Staff can view ride documents for assigned rides
CREATE POLICY "Staff can view ride_documents"
ON public.ride_documents
FOR SELECT
USING (
  staff_can_access_ride(auth.uid(), ride_id)
  AND staff_can_access_feature(auth.uid(), 'documents')
);

-- Deny anonymous
CREATE POLICY "Deny anonymous access to ride_documents"
ON public.ride_documents
FOR ALL
USING (auth.role() = 'authenticated');
