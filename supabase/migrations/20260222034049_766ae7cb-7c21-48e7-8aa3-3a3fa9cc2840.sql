
-- Add equipment_access_mode column to organisation_members
ALTER TABLE public.organisation_members
ADD COLUMN IF NOT EXISTS equipment_access_mode text NOT NULL DEFAULT 'all';

-- Add a comment for documentation
COMMENT ON COLUMN public.organisation_members.equipment_access_mode IS 'Controls ride visibility: all = see all org rides, assigned = only assigned rides';

-- Update staff_can_access_ride to respect equipment_access_mode
CREATE OR REPLACE FUNCTION public.staff_can_access_ride(_user_id uuid, _ride_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Owner of the ride always has access
  SELECT EXISTS (
    SELECT 1 FROM public.rides WHERE id = _ride_id AND user_id = _user_id
  )
  OR
  -- Staff with explicit assignment always has access
  EXISTS (
    SELECT 1 FROM public.staff_equipment_assignments sea
    JOIN public.organisation_members om ON sea.member_id = om.id
    WHERE sea.ride_id = _ride_id AND om.user_id = _user_id AND om.is_active = true
  )
  OR
  -- Staff with equipment_access_mode = 'all' and NO explicit assignments
  -- has access to all rides owned by their org's owner
  EXISTS (
    SELECT 1 FROM public.organisation_members om
    JOIN public.organisations o ON om.organisation_id = o.id
    WHERE om.user_id = _user_id
      AND om.is_active = true
      AND om.equipment_access_mode = 'all'
      AND EXISTS (SELECT 1 FROM public.rides r WHERE r.id = _ride_id AND r.user_id = o.owner_id)
  )
$function$;
