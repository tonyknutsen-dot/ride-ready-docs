-- Add document version control setting to profiles
ALTER TABLE public.profiles 
ADD COLUMN enable_document_versioning boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.enable_document_versioning IS 'When enabled, uploading a document with the same name creates a new version. When disabled, replaces the old document completely.';