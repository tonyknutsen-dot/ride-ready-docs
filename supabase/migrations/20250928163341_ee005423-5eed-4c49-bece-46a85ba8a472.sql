-- Update daily_check_templates to better support all inspection frequencies
ALTER TABLE daily_check_templates 
  ALTER COLUMN check_frequency TYPE text,
  ALTER COLUMN template_type TYPE text;

-- Add check constraint for valid frequencies
ALTER TABLE daily_check_templates 
  ADD CONSTRAINT valid_check_frequency 
  CHECK (check_frequency IN ('daily', 'weekly', 'monthly', 'yearly', 'custom'));

-- Add check constraint for valid template types  
ALTER TABLE daily_check_templates 
  ADD CONSTRAINT valid_template_type 
  CHECK (template_type IN ('daily', 'weekly', 'monthly', 'yearly', 'custom'));

-- Update inspection_checks to support all frequencies
ALTER TABLE inspection_checks 
  ALTER COLUMN check_frequency TYPE text;

-- Add check constraint for inspection check frequencies
ALTER TABLE inspection_checks 
  ADD CONSTRAINT valid_inspection_frequency 
  CHECK (check_frequency IN ('daily', 'weekly', 'monthly', 'yearly', 'custom'));

-- Add additional fields to inspection_checks for better compliance tracking
ALTER TABLE inspection_checks 
  ADD COLUMN signature_data text,
  ADD COLUMN weather_conditions text,
  ADD COLUMN environment_notes text,
  ADD COLUMN compliance_officer text;