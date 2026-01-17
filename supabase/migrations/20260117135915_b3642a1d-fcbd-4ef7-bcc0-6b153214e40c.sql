-- Add unblock_token column to blocked_ips table for secure quick-unblock links
ALTER TABLE public.blocked_ips
ADD COLUMN IF NOT EXISTS unblock_token text UNIQUE;

-- Create an index on unblock_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_blocked_ips_unblock_token ON public.blocked_ips(unblock_token) WHERE unblock_token IS NOT NULL;