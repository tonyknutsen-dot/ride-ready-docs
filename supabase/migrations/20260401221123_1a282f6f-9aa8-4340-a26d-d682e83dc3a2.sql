-- Support access RLS for maintenance_records
CREATE POLICY "Admin support access can view maintenance records"
ON public.maintenance_records FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') AND admin_has_support_access(auth.uid(), user_id));

-- Support access RLS for risk_assessments
CREATE POLICY "Admin support access can view risk assessments"
ON public.risk_assessments FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') AND admin_has_support_access(auth.uid(), user_id));

-- Support access RLS for risk_assessment_items (join to parent)
CREATE POLICY "Admin support access can view risk assessment items"
ON public.risk_assessment_items FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin') AND EXISTS (
    SELECT 1 FROM public.risk_assessments ra
    WHERE ra.id = risk_assessment_items.risk_assessment_id
      AND admin_has_support_access(auth.uid(), ra.user_id)
  )
);

-- Support access RLS for wind_speed_logs
CREATE POLICY "Admin support access can view wind logs"
ON public.wind_speed_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') AND admin_has_support_access(auth.uid(), user_id));

-- Support access RLS for wind_log_rides (join to wind log)
CREATE POLICY "Admin support access can view wind log rides"
ON public.wind_log_rides FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin') AND EXISTS (
    SELECT 1 FROM public.wind_speed_logs wsl
    WHERE wsl.id = wind_log_rides.wind_log_id
      AND admin_has_support_access(auth.uid(), wsl.user_id)
  )
);

-- Support access RLS for anemometer_profiles
CREATE POLICY "Admin support access can view anemometer profiles"
ON public.anemometer_profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') AND admin_has_support_access(auth.uid(), user_id));

-- Support access RLS for pressure_sessions
CREATE POLICY "Admin support access can view pressure sessions"
ON public.pressure_sessions FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') AND admin_has_support_access(auth.uid(), user_id));

-- Support access RLS for pressure_session_lines (join to session)
CREATE POLICY "Admin support access can view pressure session lines"
ON public.pressure_session_lines FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin') AND EXISTS (
    SELECT 1 FROM public.pressure_sessions ps
    WHERE ps.id = pressure_session_lines.session_id
      AND admin_has_support_access(auth.uid(), ps.user_id)
  )
);

-- Support access RLS for pressure_reader_profiles
CREATE POLICY "Admin support access can view pressure reader profiles"
ON public.pressure_reader_profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') AND admin_has_support_access(auth.uid(), user_id));

-- Support access RLS for ndt_schedules
CREATE POLICY "Admin support access can view NDT schedules"
ON public.ndt_schedules FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') AND admin_has_support_access(auth.uid(), user_id));

-- Support access RLS for ndt_reports
CREATE POLICY "Admin support access can view NDT reports"
ON public.ndt_reports FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') AND admin_has_support_access(auth.uid(), user_id));

-- Support access RLS for ride_documents (via ride owner)
CREATE POLICY "Admin support access can view ride documents"
ON public.ride_documents FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin') AND EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = ride_documents.ride_id
      AND admin_has_support_access(auth.uid(), r.user_id)
  )
);

-- Support access RLS for inspection_schedules
CREATE POLICY "Admin support access can view inspection schedules"
ON public.inspection_schedules FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') AND admin_has_support_access(auth.uid(), user_id));

-- Support access RLS for document_shares
CREATE POLICY "Admin support access can view document shares"
ON public.document_shares FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') AND admin_has_support_access(auth.uid(), user_id));