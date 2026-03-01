-- Fix recursive and conflicting RLS for shared wind logs
-- Root cause: recursive policy chain wind_speed_logs -> wind_log_rides -> wind_speed_logs
-- and restrictive insert policy requiring ride_id for shared logs.

-- Ensure RLS is enabled
ALTER TABLE public.wind_speed_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wind_log_rides ENABLE ROW LEVEL SECURITY;

-- Drop problematic/legacy policies on wind_speed_logs
DROP POLICY IF EXISTS "Owners can select wind logs" ON public.wind_speed_logs;
DROP POLICY IF EXISTS "Owners can insert wind logs" ON public.wind_speed_logs;
DROP POLICY IF EXISTS "Owners can update wind logs" ON public.wind_speed_logs;
DROP POLICY IF EXISTS "Owners can delete wind logs" ON public.wind_speed_logs;
DROP POLICY IF EXISTS "Staff can insert wind logs" ON public.wind_speed_logs;
DROP POLICY IF EXISTS "Staff can insert wind logs for assigned rides" ON public.wind_speed_logs;
DROP POLICY IF EXISTS "Staff can view wind logs via junction" ON public.wind_speed_logs;

-- Drop problematic/legacy policies on wind_log_rides
DROP POLICY IF EXISTS "Owners can select wind log rides" ON public.wind_log_rides;
DROP POLICY IF EXISTS "Owners can insert wind log rides" ON public.wind_log_rides;
DROP POLICY IF EXISTS "Owners can delete wind log rides" ON public.wind_log_rides;
DROP POLICY IF EXISTS "Staff can view wind log rides" ON public.wind_log_rides;
DROP POLICY IF EXISTS "Staff can insert wind log rides" ON public.wind_log_rides;

-- wind_speed_logs policies (no recursion)
CREATE POLICY "Owners can select wind logs"
ON public.wind_speed_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert wind logs"
ON public.wind_speed_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update wind logs"
ON public.wind_speed_logs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can delete wind logs"
ON public.wind_speed_logs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Staff can read logs linked to rides they can access
CREATE POLICY "Staff can view wind logs via linked rides"
ON public.wind_speed_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.wind_log_rides wlr
    WHERE wlr.wind_log_id = wind_speed_logs.id
      AND public.staff_can_access_ride(auth.uid(), wlr.ride_id)
  )
);

-- Staff can insert logs on behalf of their org owner (user_id = owner_id)
CREATE POLICY "Staff can insert wind logs for owner"
ON public.wind_speed_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organisation_members om
    JOIN public.organisations o ON o.id = om.organisation_id
    WHERE om.user_id = auth.uid()
      AND om.is_active = true
      AND o.owner_id = wind_speed_logs.user_id
  )
);

-- wind_log_rides policies (reference rides only, no recursion)
CREATE POLICY "Owners can select wind log rides"
ON public.wind_log_rides
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = wind_log_rides.ride_id
      AND r.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can insert wind log rides"
ON public.wind_log_rides
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = wind_log_rides.ride_id
      AND r.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete wind log rides"
ON public.wind_log_rides
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = wind_log_rides.ride_id
      AND r.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can view wind log rides"
ON public.wind_log_rides
FOR SELECT
TO authenticated
USING (public.staff_can_access_ride(auth.uid(), ride_id));

CREATE POLICY "Staff can insert wind log rides"
ON public.wind_log_rides
FOR INSERT
TO authenticated
WITH CHECK (public.staff_can_access_ride(auth.uid(), ride_id));

CREATE POLICY "Staff can delete wind log rides"
ON public.wind_log_rides
FOR DELETE
TO authenticated
USING (public.staff_can_access_ride(auth.uid(), ride_id));