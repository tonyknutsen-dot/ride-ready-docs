-- Add column to track when risk level was manually overridden
ALTER TABLE public.risk_assessment_items 
ADD COLUMN IF NOT EXISTS is_manually_overridden BOOLEAN DEFAULT FALSE;

-- Add comment explaining the field
COMMENT ON COLUMN public.risk_assessment_items.is_manually_overridden IS 'True when the risk level was manually set by assessor professional judgment instead of calculated';