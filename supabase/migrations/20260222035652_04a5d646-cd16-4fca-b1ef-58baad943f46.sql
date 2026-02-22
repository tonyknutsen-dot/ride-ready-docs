
-- Add start notice fields to check templates
ALTER TABLE public.daily_check_templates
  ADD COLUMN IF NOT EXISTS start_notice_text text,
  ADD COLUMN IF NOT EXISTS start_notice_required boolean NOT NULL DEFAULT false;

-- Add start notice acknowledgement fields to checks (completed check runs)
ALTER TABLE public.checks
  ADD COLUMN IF NOT EXISTS start_notice_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS start_notice_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS start_notice_acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS start_notice_snapshot text;
