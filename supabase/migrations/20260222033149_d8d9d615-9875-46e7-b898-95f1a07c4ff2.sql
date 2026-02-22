
-- Create a security definer function to check if a user can create/modify calendar events
-- Returns true for org owners (controllers) and managers only
CREATE OR REPLACE FUNCTION public.can_create_calendar_event(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if user is an org owner (controller)
  SELECT EXISTS (
    SELECT 1 FROM public.organisations WHERE owner_id = _user_id
  )
  OR
  -- Check if user is a manager in any org
  EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE user_id = _user_id
      AND is_active = true
      AND permission_level = 'manager'
  )
$$;

-- Add restrictive INSERT policy: only controller/manager can insert compliance events
-- (The existing "Owners can manage their compliance events" already covers owners with ALL)
-- We need a restrictive policy that blocks supervisor/staff from INSERT
CREATE POLICY "Only controller or manager can insert events"
ON public.compliance_events
FOR INSERT
WITH CHECK (
  can_create_calendar_event(auth.uid())
);

-- Add restrictive policy for UPDATE on non-completion fields
-- Note: The existing "Staff can update operational compliance events" allows staff to update
-- operational events (for marking complete). We add a restrictive policy for general updates
-- but allow completion updates through the existing complete_event() function (SECURITY DEFINER).
CREATE POLICY "Only controller or manager can delete events"
ON public.compliance_events
FOR DELETE
USING (
  can_create_calendar_event(auth.uid())
);
