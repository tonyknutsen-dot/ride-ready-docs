-- Remove staff write access to compliance_events (staff should only view)
DROP POLICY IF EXISTS "Staff can update compliance events for assigned rides" ON public.compliance_events;