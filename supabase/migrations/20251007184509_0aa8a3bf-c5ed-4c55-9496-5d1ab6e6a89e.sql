-- Rename inspection_checks to checks for clarity (these are done by showmen)
ALTER TABLE inspection_checks RENAME TO checks;

-- Rename inspection_check_results to check_results
ALTER TABLE inspection_check_results RENAME TO check_results;

-- Update the foreign key column name in check_results
ALTER TABLE check_results RENAME COLUMN inspection_check_id TO check_id;

-- Add schedule_type to inspection_schedules to distinguish between checks and inspections
ALTER TABLE inspection_schedules 
ADD COLUMN IF NOT EXISTS schedule_type text NOT NULL DEFAULT 'inspection';

-- Add check constraint for schedule_type
ALTER TABLE inspection_schedules
ADD CONSTRAINT schedule_type_check CHECK (schedule_type IN ('check', 'inspection'));

-- Update RLS policies for renamed checks table
DROP POLICY IF EXISTS "Users can manage their own daily checks" ON checks;
CREATE POLICY "Users can manage their own checks" 
ON checks 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Update RLS policies for renamed check_results table
DROP POLICY IF EXISTS "Users can manage results for their daily checks" ON check_results;
CREATE POLICY "Users can manage results for their checks" 
ON check_results 
FOR ALL 
USING (check_id IN (
  SELECT id FROM checks WHERE user_id = auth.uid()
));

-- Add comment to clarify the distinction
COMMENT ON TABLE checks IS 'Daily, monthly, and yearly checks performed by showmen (operators)';
COMMENT ON TABLE annual_inspection_reports IS 'Annual inspections performed by independent inspectors or inspection bodies';
COMMENT ON TABLE ndt_reports IS 'NDT inspections performed by independent inspectors';
COMMENT ON TABLE inspection_schedules IS 'Schedules for both checks (operator-performed) and inspections (third-party performed)';

-- Update triggers to work with renamed tables
DROP TRIGGER IF EXISTS update_inspection_checks_updated_at ON checks;
CREATE TRIGGER update_checks_updated_at
  BEFORE UPDATE ON checks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();