
-- ============================================================
-- Section A: Remove PIPA / ADIPS / RPII wording from library items
-- ============================================================

-- 1. risk_library_items: anchor-point wording
UPDATE public.risk_library_items
SET label = 'Minimum anchor points and anchorage arrangement in accordance with the applicable standard and manufacturer guidance'
WHERE id = '22cf1f9d-7e3a-4b8c-9d1e-5f6a7b8c9d0e';

-- 2. check_library_items: certificate validity
UPDATE public.check_library_items
SET label = 'Annual inspection certificate valid'
WHERE id = 'ce41a7a4-1234-4b8c-9d1e-5f6a7b8c9d0e';

-- 3. check_library_items: annual inspection
UPDATE public.check_library_items
SET label = 'Annual independent inspection'
WHERE id = '34127147-5678-4b8c-9d1e-5f6a7b8c9d0e';


-- ============================================================
-- Section B: Create wind_speed_logs table
-- ============================================================

CREATE TABLE public.wind_speed_logs (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL,
  ride_id         uuid        NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  log_date        date        NOT NULL DEFAULT CURRENT_DATE,
  log_time        time        NOT NULL DEFAULT LOCALTIME,
  wind_speed      numeric     NOT NULL,
  wind_unit       text        NOT NULL DEFAULT 'mph',
  recorded_by     text        NOT NULL,
  location        text,
  anemometer_make text,
  anemometer_model text,
  anemometer_serial text,
  action_taken    text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Performance index
CREATE INDEX idx_wind_speed_logs_ride_date
  ON public.wind_speed_logs (ride_id, log_date DESC);

-- Enable RLS
ALTER TABLE public.wind_speed_logs ENABLE ROW LEVEL SECURITY;

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to wind_speed_logs"
  ON public.wind_speed_logs AS RESTRICTIVE FOR ALL
  USING (auth.role() = 'authenticated');

-- Owners can do everything
CREATE POLICY "Owners can manage their wind speed logs"
  ON public.wind_speed_logs AS RESTRICTIVE FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Staff can view logs for assigned rides
CREATE POLICY "Staff can view wind logs for assigned rides"
  ON public.wind_speed_logs AS RESTRICTIVE FOR SELECT
  USING (staff_can_access_ride(auth.uid(), ride_id));

-- Staff can insert logs for assigned rides
CREATE POLICY "Staff can insert wind logs for assigned rides"
  ON public.wind_speed_logs AS RESTRICTIVE FOR INSERT
  WITH CHECK (staff_can_access_ride(auth.uid(), ride_id));
