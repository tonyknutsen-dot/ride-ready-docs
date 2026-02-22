-- Allow staff to update ONLY operational compliance events (mark complete, log defects)
CREATE POLICY "Staff can update operational compliance events"
  ON public.compliance_events FOR UPDATE
  USING (
    event_category = 'operational'
    AND ride_id IS NOT NULL
    AND staff_can_access_ride(auth.uid(), ride_id)
  );