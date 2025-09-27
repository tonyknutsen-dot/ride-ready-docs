-- Add version control fields to documents table
ALTER TABLE public.documents 
ADD COLUMN version_number text DEFAULT '1.0',
ADD COLUMN is_latest_version boolean DEFAULT true,
ADD COLUMN replaced_document_id uuid REFERENCES public.documents(id),
ADD COLUMN version_notes text;