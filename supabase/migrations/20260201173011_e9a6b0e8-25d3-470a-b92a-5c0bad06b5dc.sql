-- Add granular feature permissions to organisation_members
-- This replaces the tier-based system with individual feature toggles

ALTER TABLE public.organisation_members
ADD COLUMN can_access_calendar boolean NOT NULL DEFAULT true,
ADD COLUMN can_access_documents boolean NOT NULL DEFAULT false,
ADD COLUMN can_access_checks boolean NOT NULL DEFAULT true,
ADD COLUMN can_access_maintenance boolean NOT NULL DEFAULT false,
ADD COLUMN can_access_risk_assessments boolean NOT NULL DEFAULT false,
ADD COLUMN can_access_send_documents boolean NOT NULL DEFAULT false;

-- Migrate existing permission levels to new columns
UPDATE public.organisation_members
SET 
  can_access_calendar = true,
  can_access_checks = true,
  can_access_documents = CASE WHEN permission_level = 'full_access' THEN true ELSE false END,
  can_access_maintenance = CASE WHEN permission_level IN ('checks_maintenance', 'full_access') THEN true ELSE false END,
  can_access_risk_assessments = CASE WHEN permission_level = 'full_access' THEN true ELSE false END,
  can_access_send_documents = CASE WHEN permission_level = 'full_access' THEN true ELSE false END;

-- Add same columns to staff_invites so permissions are set at invite time
ALTER TABLE public.staff_invites
ADD COLUMN can_access_calendar boolean NOT NULL DEFAULT true,
ADD COLUMN can_access_documents boolean NOT NULL DEFAULT false,
ADD COLUMN can_access_checks boolean NOT NULL DEFAULT true,
ADD COLUMN can_access_maintenance boolean NOT NULL DEFAULT false,
ADD COLUMN can_access_risk_assessments boolean NOT NULL DEFAULT false,
ADD COLUMN can_access_send_documents boolean NOT NULL DEFAULT false;

-- Migrate existing invites based on permission_level
UPDATE public.staff_invites
SET 
  can_access_calendar = true,
  can_access_checks = true,
  can_access_documents = CASE WHEN permission_level = 'full_access' THEN true ELSE false END,
  can_access_maintenance = CASE WHEN permission_level IN ('checks_maintenance', 'full_access') THEN true ELSE false END,
  can_access_risk_assessments = CASE WHEN permission_level = 'full_access' THEN true ELSE false END,
  can_access_send_documents = CASE WHEN permission_level = 'full_access' THEN true ELSE false END;

-- Create a helper function to check staff feature access
CREATE OR REPLACE FUNCTION public.staff_can_access_feature(_user_id uuid, _feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _feature
    WHEN 'calendar' THEN COALESCE(can_access_calendar, true)
    WHEN 'documents' THEN COALESCE(can_access_documents, false)
    WHEN 'checks' THEN COALESCE(can_access_checks, true)
    WHEN 'maintenance' THEN COALESCE(can_access_maintenance, false)
    WHEN 'risk_assessments' THEN COALESCE(can_access_risk_assessments, false)
    WHEN 'send_documents' THEN COALESCE(can_access_send_documents, false)
    ELSE false
  END
  FROM public.organisation_members
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1
$$;