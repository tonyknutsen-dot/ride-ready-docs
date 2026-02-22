
-- Create ride_daily_status table (upsert-friendly, one row per ride per day)
CREATE TABLE public.ride_daily_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  status_date date NOT NULL DEFAULT CURRENT_DATE,
  is_operating boolean NOT NULL DEFAULT false,
  updated_by uuid NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(ride_id, status_date)
);

-- Create ride_daily_status_log table (append-only audit trail)
CREATE TABLE public.ride_daily_status_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  status_date date NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  changed_by uuid NOT NULL,
  changed_by_name text,
  new_is_operating boolean NOT NULL,
  reason text
);

-- Enable RLS
ALTER TABLE public.ride_daily_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_daily_status_log ENABLE ROW LEVEL SECURITY;

-- RLS for ride_daily_status: owners of the ride can manage, staff can view/update assigned rides
CREATE POLICY "Owners can manage ride daily status"
  ON public.ride_daily_status FOR ALL
  USING (
    ride_id IN (SELECT id FROM public.rides WHERE user_id = auth.uid())
  )
  WITH CHECK (
    ride_id IN (SELECT id FROM public.rides WHERE user_id = auth.uid())
  );

CREATE POLICY "Staff can view ride daily status for assigned rides"
  ON public.ride_daily_status FOR SELECT
  USING (staff_can_access_ride(auth.uid(), ride_id));

CREATE POLICY "Staff can upsert ride daily status for assigned rides"
  ON public.ride_daily_status FOR INSERT
  WITH CHECK (staff_can_access_ride(auth.uid(), ride_id));

CREATE POLICY "Staff can update ride daily status for assigned rides"
  ON public.ride_daily_status FOR UPDATE
  USING (staff_can_access_ride(auth.uid(), ride_id));

CREATE POLICY "Deny anonymous access to ride_daily_status"
  ON public.ride_daily_status FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- RLS for ride_daily_status_log
CREATE POLICY "Owners can manage ride daily status log"
  ON public.ride_daily_status_log FOR ALL
  USING (
    ride_id IN (SELECT id FROM public.rides WHERE user_id = auth.uid())
  )
  WITH CHECK (
    ride_id IN (SELECT id FROM public.rides WHERE user_id = auth.uid())
  );

CREATE POLICY "Staff can view ride daily status log for assigned rides"
  ON public.ride_daily_status_log FOR SELECT
  USING (staff_can_access_ride(auth.uid(), ride_id));

CREATE POLICY "Staff can insert ride daily status log for assigned rides"
  ON public.ride_daily_status_log FOR INSERT
  WITH CHECK (staff_can_access_ride(auth.uid(), ride_id));

CREATE POLICY "No one can update or delete log entries"
  ON public.ride_daily_status_log FOR DELETE
  USING (false);

CREATE POLICY "No one can update log entries"
  ON public.ride_daily_status_log FOR UPDATE
  USING (false);

CREATE POLICY "Deny anonymous access to ride_daily_status_log"
  ON public.ride_daily_status_log FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Index for fast lookups
CREATE INDEX idx_ride_daily_status_ride_date ON public.ride_daily_status(ride_id, status_date);
CREATE INDEX idx_ride_daily_status_log_ride_date ON public.ride_daily_status_log(ride_id, status_date);
