-- Add support access read policies for admins on customer data tables.
-- These policies allow admins with a valid support_access_grant to read
-- customer operational data. Write access is NOT granted.

-- Rides: admin with support access can view customer rides
CREATE POLICY "Admin support access can view rides"
ON public.rides
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.admin_has_support_access(auth.uid(), user_id)
);

-- Documents: admin with support access can view customer documents
CREATE POLICY "Admin support access can view documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.admin_has_support_access(auth.uid(), user_id)
);

-- Checks: admin with support access can view customer checks
CREATE POLICY "Admin support access can view checks"
ON public.checks
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.admin_has_support_access(auth.uid(), user_id)
);

-- Defects: admin with support access can view customer defects
CREATE POLICY "Admin support access can view defects"
ON public.defects
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.admin_has_support_access(auth.uid(), user_id)
);

-- Inspection Records: admin with support access can view
CREATE POLICY "Admin support access can view inspection records"
ON public.inspection_records
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.admin_has_support_access(auth.uid(), user_id)
);

-- Compliance Events: admin with support access can view
CREATE POLICY "Admin support access can view compliance events"
ON public.compliance_events
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.admin_has_support_access(auth.uid(), user_id)
);

-- Daily Check Templates: admin with support access can view
CREATE POLICY "Admin support access can view check templates"
ON public.daily_check_templates
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.admin_has_support_access(auth.uid(), user_id)
);

-- Check Results: admin with support access can view (via check ownership)
CREATE POLICY "Admin support access can view check results"
ON public.check_results
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND (check_id IN (
    SELECT c.id FROM checks c
    WHERE public.admin_has_support_access(auth.uid(), c.user_id)
  ))
);

-- Annual Inspection Reports: admin with support access can view
CREATE POLICY "Admin support access can view annual inspections"
ON public.annual_inspection_reports
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.admin_has_support_access(auth.uid(), user_id)
);

-- Document Ride Assignments: admin with support access can view
CREATE POLICY "Admin support access can view doc assignments"
ON public.document_ride_assignments
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND public.admin_has_support_access(auth.uid(), user_id)
);