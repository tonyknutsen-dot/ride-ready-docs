-- Add is_test_data column to key tables
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.checks ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.risk_assessments ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT false;

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_rides_is_test_data ON public.rides(is_test_data);
CREATE INDEX IF NOT EXISTS idx_documents_is_test_data ON public.documents(is_test_data);
CREATE INDEX IF NOT EXISTS idx_checks_is_test_data ON public.checks(is_test_data);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_is_test_data ON public.maintenance_records(is_test_data);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_is_test_data ON public.risk_assessments(is_test_data);

-- Create a function to automatically set is_test_data based on user role
CREATE OR REPLACE FUNCTION public.set_test_data_flag()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the user creating/updating the record is a tester
  IF public.is_tester(auth.uid()) THEN
    NEW.is_test_data := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for each table to auto-set the flag on insert
CREATE TRIGGER set_rides_test_data_flag
  BEFORE INSERT ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.set_test_data_flag();

CREATE TRIGGER set_documents_test_data_flag
  BEFORE INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_test_data_flag();

CREATE TRIGGER set_checks_test_data_flag
  BEFORE INSERT ON public.checks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_test_data_flag();

CREATE TRIGGER set_maintenance_records_test_data_flag
  BEFORE INSERT ON public.maintenance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.set_test_data_flag();

CREATE TRIGGER set_risk_assessments_test_data_flag
  BEFORE INSERT ON public.risk_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_test_data_flag();

-- Mark existing data from testers as test data
UPDATE public.rides SET is_test_data = true 
WHERE user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'tester');

UPDATE public.documents SET is_test_data = true 
WHERE user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'tester');

UPDATE public.checks SET is_test_data = true 
WHERE user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'tester');

UPDATE public.maintenance_records SET is_test_data = true 
WHERE user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'tester');

UPDATE public.risk_assessments SET is_test_data = true 
WHERE user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'tester');