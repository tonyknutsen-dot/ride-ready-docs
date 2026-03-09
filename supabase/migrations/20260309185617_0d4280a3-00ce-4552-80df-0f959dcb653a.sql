-- Add extended anemometer traceability columns to wind_speed_logs
ALTER TABLE public.wind_speed_logs 
  ADD COLUMN IF NOT EXISTS anemometer_type text DEFAULT null,
  ADD COLUMN IF NOT EXISTS anemometer_calibration_date text DEFAULT null,
  ADD COLUMN IF NOT EXISTS anemometer_notes text DEFAULT null;