
-- Add event_category column to compliance_events
ALTER TABLE public.compliance_events
ADD COLUMN event_category text NOT NULL DEFAULT 'regulatory';

-- Set all existing events to regulatory
-- (operational events don't exist yet)

-- Add index for filtering
CREATE INDEX idx_compliance_events_category ON public.compliance_events(event_category);
