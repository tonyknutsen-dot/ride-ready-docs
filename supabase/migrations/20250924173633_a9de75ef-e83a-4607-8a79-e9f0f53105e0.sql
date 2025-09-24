-- Expand check system to support multiple frequencies
ALTER TABLE public.daily_check_templates ADD COLUMN check_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (check_frequency IN ('daily', 'monthly', 'annual', 'custom'));
ALTER TABLE public.daily_check_templates ADD COLUMN custom_interval_days INTEGER DEFAULT NULL;
ALTER TABLE public.daily_check_templates ADD COLUMN description TEXT DEFAULT NULL;

-- Rename tables to be more generic
ALTER TABLE public.daily_checks RENAME TO inspection_checks;
ALTER TABLE public.daily_check_results RENAME TO inspection_check_results;

-- Update foreign key references
ALTER TABLE public.inspection_check_results RENAME COLUMN daily_check_id TO inspection_check_id;

-- Add frequency tracking to checks
ALTER TABLE public.inspection_checks ADD COLUMN check_frequency TEXT NOT NULL DEFAULT 'daily';

-- Create NDT schedules table
CREATE TABLE public.ndt_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  schedule_name TEXT NOT NULL,
  component_description TEXT NOT NULL,
  ndt_method TEXT NOT NULL,
  frequency_months INTEGER NOT NULL,
  last_inspection_date DATE,
  next_inspection_due DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create NDT inspection reports table
CREATE TABLE public.ndt_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ndt_schedule_id UUID NOT NULL REFERENCES public.ndt_schedules(id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  inspector_name TEXT NOT NULL,
  inspection_company TEXT,
  inspection_date DATE NOT NULL,
  ndt_method TEXT NOT NULL,
  component_tested TEXT NOT NULL,
  test_results TEXT NOT NULL CHECK (test_results IN ('pass', 'fail', 'conditional')),
  defects_found TEXT,
  recommendations TEXT,
  next_inspection_due DATE,
  certificate_number TEXT,
  report_file_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create annual in-service inspection reports table
CREATE TABLE public.annual_inspection_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  inspection_year INTEGER NOT NULL,
  inspector_name TEXT NOT NULL,
  inspection_company TEXT NOT NULL,
  inspection_date DATE NOT NULL,
  certificate_number TEXT,
  inspection_status TEXT NOT NULL CHECK (inspection_status IN ('pass', 'fail', 'conditional')),
  conditions_notes TEXT,
  recommendations TEXT,
  next_inspection_due DATE,
  report_file_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ride_id, inspection_year)
);

-- Enable RLS on new tables
ALTER TABLE public.ndt_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ndt_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annual_inspection_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage NDT schedules for their rides" 
ON public.ndt_schedules FOR ALL 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage NDT reports for their rides" 
ON public.ndt_reports FOR ALL 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage annual inspection reports for their rides" 
ON public.annual_inspection_reports FOR ALL 
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add triggers
CREATE TRIGGER update_ndt_schedules_updated_at
BEFORE UPDATE ON public.ndt_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_ndt_schedules_ride_user ON public.ndt_schedules(ride_id, user_id);
CREATE INDEX idx_ndt_schedules_due_date ON public.ndt_schedules(next_inspection_due) WHERE is_active = true;
CREATE INDEX idx_ndt_reports_schedule_date ON public.ndt_reports(ndt_schedule_id, inspection_date);
CREATE INDEX idx_annual_reports_ride_year ON public.annual_inspection_reports(ride_id, inspection_year);

-- Update existing indexes
DROP INDEX IF EXISTS idx_daily_checks_user_ride_date;
DROP INDEX IF EXISTS idx_daily_check_results_check_id;
CREATE INDEX idx_inspection_checks_user_ride_date ON public.inspection_checks(user_id, ride_id, check_date);
CREATE INDEX idx_inspection_check_results_check_id ON public.inspection_check_results(inspection_check_id);