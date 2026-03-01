
-- Drop the problematic ALL policies that don't have proper WITH CHECK for INSERT
DROP POLICY IF EXISTS "Deny anonymous access to wind_speed_logs" ON public.wind_speed_logs;
DROP POLICY IF EXISTS "Owners can manage their wind speed logs" ON public.wind_speed_logs;

-- Replace with explicit per-operation policies for owners
CREATE POLICY "Owners can select wind logs"
  ON public.wind_speed_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can insert wind logs"
  ON public.wind_speed_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update wind logs"
  ON public.wind_speed_logs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete wind logs"
  ON public.wind_speed_logs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
