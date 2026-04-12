
-- Fix staff_invites table defaults
ALTER TABLE public.staff_invites ALTER COLUMN can_access_calendar SET DEFAULT false;
ALTER TABLE public.staff_invites ALTER COLUMN can_access_maintenance SET DEFAULT true;

-- Fix organisation_members table defaults (belt-and-suspenders, may already be correct from prior migration)
ALTER TABLE public.organisation_members ALTER COLUMN can_access_calendar SET DEFAULT false;
ALTER TABLE public.organisation_members ALTER COLUMN can_access_maintenance SET DEFAULT true;

-- Fix the existing staff member row with wrong permissions
UPDATE public.organisation_members
SET can_access_calendar = false,
    can_access_documents = false,
    can_access_risk_assessments = false,
    can_access_send_documents = false,
    can_access_maintenance = true,
    can_access_checks = true
WHERE user_id = '1faaf0c4-d8ec-4af2-a700-aadf9d763bc9'
  AND is_active = true;

-- Fix the staff_can_access_feature function defaults to match the correct staff model
CREATE OR REPLACE FUNCTION public.staff_can_access_feature(_user_id uuid, _feature text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT CASE _feature
    WHEN 'calendar' THEN COALESCE(can_access_calendar, false)
    WHEN 'documents' THEN COALESCE(can_access_documents, false)
    WHEN 'checks' THEN COALESCE(can_access_checks, true)
    WHEN 'maintenance' THEN COALESCE(can_access_maintenance, true)
    WHEN 'risk_assessments' THEN COALESCE(can_access_risk_assessments, false)
    WHEN 'send_documents' THEN COALESCE(can_access_send_documents, false)
    ELSE false
  END
  FROM public.organisation_members
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1
$$;
