
-- 1) encryption_keys: make deny-all RESTRICTIVE
DROP POLICY IF EXISTS "Deny all direct access to encryption_keys" ON public.encryption_keys;

CREATE POLICY "Restrictive deny all on encryption_keys"
ON public.encryption_keys
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- 2) check_results: staff SELECT scoped via staff_can_access_ride (org-scoped)
CREATE POLICY "Staff can view check results for accessible equipment"
ON public.check_results
FOR SELECT
TO authenticated
USING (
  check_id IN (
    SELECT c.id FROM public.checks c
    WHERE public.staff_can_access_ride(auth.uid(), c.ride_id)
  )
);

-- 3) compliance_record_sequences: staff SELECT scoped via staff_can_access_ride
CREATE POLICY "Staff can view sequences for accessible equipment"
ON public.compliance_record_sequences
FOR SELECT
TO authenticated
USING (
  public.staff_can_access_ride(auth.uid(), ride_id)
);
