
-- =============================================
-- PRESSURE READINGS MODULE + INSTRUMENT TRACEABILITY
-- =============================================

-- 1. Pressure Reader Profiles (reusable instrument library)
CREATE TABLE public.pressure_reader_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reader_type TEXT NOT NULL DEFAULT 'digital',
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT,
  label TEXT,
  unit TEXT NOT NULL DEFAULT 'psi',
  last_calibration_date DATE,
  instrument_notes TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pressure_reader_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pressure reader profiles"
  ON public.pressure_reader_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pressure reader profiles"
  ON public.pressure_reader_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pressure reader profiles"
  ON public.pressure_reader_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pressure reader profiles"
  ON public.pressure_reader_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Pressure Sessions (session header)
CREATE TABLE public.pressure_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_time TIME NOT NULL DEFAULT CURRENT_TIME,
  session_type TEXT NOT NULL DEFAULT 'pre-opening',
  taken_by TEXT NOT NULL,
  site_name TEXT NOT NULL,
  site_address TEXT NOT NULL DEFAULT '',
  notes TEXT,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  reader_type TEXT,
  reader_make TEXT,
  reader_model TEXT,
  reader_serial TEXT,
  reader_unit TEXT NOT NULL DEFAULT 'psi',
  reader_calibration_date DATE,
  reader_notes TEXT,
  reader_profile_id UUID REFERENCES public.pressure_reader_profiles(id),
  is_test_data BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pressure_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pressure sessions"
  ON public.pressure_sessions FOR SELECT
  USING (auth.uid() = user_id OR public.staff_can_access_ride(auth.uid(), ride_id));

CREATE POLICY "Users can insert own pressure sessions"
  ON public.pressure_sessions FOR INSERT
  WITH CHECK (public.subscription_allows_writes(auth.uid()));

CREATE POLICY "Users can update own pressure sessions"
  ON public.pressure_sessions FOR UPDATE
  USING (auth.uid() = user_id OR public.staff_can_access_ride(auth.uid(), ride_id));

CREATE POLICY "Users can delete own pressure sessions"
  ON public.pressure_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_pressure_sessions_ride ON public.pressure_sessions(ride_id);
CREATE INDEX idx_pressure_sessions_user ON public.pressure_sessions(user_id);
CREATE INDEX idx_pressure_sessions_date ON public.pressure_sessions(session_date DESC);

-- 3. Pressure Session Lines (per-section readings)
CREATE TABLE public.pressure_session_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.pressure_sessions(id) ON DELETE CASCADE,
  section_number INTEGER NOT NULL DEFAULT 1,
  section_name TEXT NOT NULL DEFAULT 'Main',
  reading_taken_at TIME,
  pressure_value NUMERIC(8,2),
  pressure_unit TEXT NOT NULL DEFAULT 'psi',
  reading_point TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pressure_session_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pressure lines via session"
  ON public.pressure_session_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.pressure_sessions ps
    WHERE ps.id = pressure_session_lines.session_id
    AND (ps.user_id = auth.uid() OR public.staff_can_access_ride(auth.uid(), ps.ride_id))
  ));

CREATE POLICY "Users can insert pressure lines"
  ON public.pressure_session_lines FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pressure_sessions ps
    WHERE ps.id = pressure_session_lines.session_id
    AND (ps.user_id = auth.uid() OR public.staff_can_access_ride(auth.uid(), ps.ride_id))
  ));

CREATE POLICY "Users can update pressure lines"
  ON public.pressure_session_lines FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.pressure_sessions ps
    WHERE ps.id = pressure_session_lines.session_id
    AND (ps.user_id = auth.uid() OR public.staff_can_access_ride(auth.uid(), ps.ride_id))
  ));

CREATE POLICY "Users can delete pressure lines"
  ON public.pressure_session_lines FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.pressure_sessions ps
    WHERE ps.id = pressure_session_lines.session_id
    AND ps.user_id = auth.uid()
  ));

CREATE INDEX idx_pressure_lines_session ON public.pressure_session_lines(session_id);

-- 4. Add pressure config fields to rides table
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS pressure_monitoring_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_multi_sectional BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS section_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS section_config JSONB DEFAULT '[]'::jsonb;

-- 5. Extend anemometer_profiles with instrument traceability fields
ALTER TABLE public.anemometer_profiles
  ADD COLUMN IF NOT EXISTS anemometer_type TEXT DEFAULT 'digital',
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'mph',
  ADD COLUMN IF NOT EXISTS last_calibration_date DATE,
  ADD COLUMN IF NOT EXISTS instrument_notes TEXT;

-- 6. Set test_data flag trigger for pressure sessions
CREATE TRIGGER set_pressure_sessions_test_data
  BEFORE INSERT OR UPDATE ON public.pressure_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_test_data_flag();

-- 7. Updated_at triggers
CREATE TRIGGER update_pressure_sessions_updated_at
  BEFORE UPDATE ON public.pressure_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pressure_reader_profiles_updated_at
  BEFORE UPDATE ON public.pressure_reader_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
