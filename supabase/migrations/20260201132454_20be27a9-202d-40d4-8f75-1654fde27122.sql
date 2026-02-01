-- Add column to track when signups were imported to marketing
ALTER TABLE public.early_access_signups
ADD COLUMN imported_to_marketing_at timestamp with time zone DEFAULT NULL;