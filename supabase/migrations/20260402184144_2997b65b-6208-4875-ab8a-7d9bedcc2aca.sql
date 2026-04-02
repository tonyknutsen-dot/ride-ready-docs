-- Add soft-delete column
ALTER TABLE public.marketing_contacts 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Change FK from CASCADE to SET NULL so campaign history survives contact deletion
ALTER TABLE public.campaign_recipients
  DROP CONSTRAINT IF EXISTS campaign_recipients_contact_id_fkey;

ALTER TABLE public.campaign_recipients
  ADD CONSTRAINT campaign_recipients_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES marketing_contacts(id) ON DELETE SET NULL;

-- Make contact_id nullable to support SET NULL
ALTER TABLE public.campaign_recipients
  ALTER COLUMN contact_id DROP NOT NULL;

-- Add index for soft-delete queries
CREATE INDEX IF NOT EXISTS idx_marketing_contacts_deleted 
  ON public.marketing_contacts (user_id, deleted_at) 
  WHERE deleted_at IS NULL;