
-- Add offline completion tracking fields to compliance_events
ALTER TABLE public.compliance_events
  ADD COLUMN IF NOT EXISTS completion_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS completed_offline boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS synced_at timestamp with time zone;

-- Add a comment for clarity
COMMENT ON COLUMN public.compliance_events.completion_status IS 'pending_sync or synced';
COMMENT ON COLUMN public.compliance_events.completed_offline IS 'Whether this was completed while offline';
COMMENT ON COLUMN public.compliance_events.synced_at IS 'When the offline completion was synced to server';
