
-- Drop existing staff policies that conflict
DROP POLICY IF EXISTS "Staff can view wind logs for assigned rides" ON public.wind_speed_logs;
DROP POLICY IF EXISTS "Staff can insert wind logs" ON public.wind_speed_logs;

-- Junction table: link one wind reading to multiple rides
CREATE TABLE public.wind_log_rides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wind_log_id uuid NOT NULL REFERENCES public.wind_speed_logs(id) ON DELETE CASCADE,
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(wind_log_id, ride_id)
);

CREATE INDEX idx_wind_log_rides_ride ON public.wind_log_rides(ride_id);
CREATE INDEX idx_wind_log_rides_log ON public.wind_log_rides(wind_log_id);

-- Make ride_id nullable (readings now linked via junction)
ALTER TABLE public.wind_speed_logs ALTER COLUMN ride_id DROP NOT NULL;

-- RLS on junction table
ALTER TABLE public.wind_log_rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can select wind log rides"
  ON public.wind_log_rides FOR SELECT TO authenticated
  USING (wind_log_id IN (SELECT id FROM public.wind_speed_logs WHERE user_id = auth.uid()));

CREATE POLICY "Owners can insert wind log rides"
  ON public.wind_log_rides FOR INSERT TO authenticated
  WITH CHECK (wind_log_id IN (SELECT id FROM public.wind_speed_logs WHERE user_id = auth.uid()));

CREATE POLICY "Owners can delete wind log rides"
  ON public.wind_log_rides FOR DELETE TO authenticated
  USING (wind_log_id IN (SELECT id FROM public.wind_speed_logs WHERE user_id = auth.uid()));

CREATE POLICY "Staff can view wind log rides"
  ON public.wind_log_rides FOR SELECT TO authenticated
  USING (staff_can_access_ride(auth.uid(), ride_id));

CREATE POLICY "Staff can insert wind log rides"
  ON public.wind_log_rides FOR INSERT TO authenticated
  WITH CHECK (staff_can_access_ride(auth.uid(), ride_id));

-- Staff policies on main table
CREATE POLICY "Staff can view wind logs via junction"
  ON public.wind_speed_logs FOR SELECT TO authenticated
  USING (id IN (SELECT wind_log_id FROM public.wind_log_rides WHERE staff_can_access_ride(auth.uid(), ride_id)));

CREATE POLICY "Staff can insert wind logs"
  ON public.wind_speed_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
