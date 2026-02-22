
-- Create table for tracking daily ride operation status
CREATE TABLE public.ride_operation_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  operation_date date NOT NULL,
  is_operating boolean NOT NULL DEFAULT true,
  set_by uuid NOT NULL,
  set_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (ride_id, operation_date)
);

-- Enable RLS
ALTER TABLE public.ride_operation_days ENABLE ROW LEVEL SECURITY;

-- Owners can manage their ride operation days
CREATE POLICY "Owners can manage ride operation days"
  ON public.ride_operation_days
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = ride_id AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = ride_id AND r.user_id = auth.uid()
    )
  );

-- Staff can view operation days for assigned rides
CREATE POLICY "Staff can view ride operation days"
  ON public.ride_operation_days
  FOR SELECT
  USING (staff_can_access_ride(auth.uid(), ride_id));

-- Managers can set operation status for assigned rides
CREATE POLICY "Managers can set ride operation days"
  ON public.ride_operation_days
  FOR ALL
  USING (
    staff_can_access_ride(auth.uid(), ride_id)
    AND get_staff_permission(auth.uid(), (
      SELECT om.organisation_id FROM organisation_members om
      WHERE om.user_id = auth.uid() AND om.is_active = true
      LIMIT 1
    )) = 'manager'::staff_role
  )
  WITH CHECK (
    staff_can_access_ride(auth.uid(), ride_id)
    AND get_staff_permission(auth.uid(), (
      SELECT om.organisation_id FROM organisation_members om
      WHERE om.user_id = auth.uid() AND om.is_active = true
      LIMIT 1
    )) = 'manager'::staff_role
  );

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to ride_operation_days"
  ON public.ride_operation_days
  FOR ALL
  USING (auth.role() = 'authenticated'::text);

-- Create index for fast lookup
CREATE INDEX idx_ride_operation_days_lookup ON public.ride_operation_days (ride_id, operation_date);

COMMENT ON TABLE public.ride_operation_days IS 'Tracks whether a ride is operating on a given day. Default assumption is NOT operating unless a record exists with is_operating=true.';
