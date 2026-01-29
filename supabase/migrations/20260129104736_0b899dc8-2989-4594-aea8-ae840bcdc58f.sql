-- Add check_result column to check_results table (pass, fail, na)
-- Keep is_checked for backward compatibility but add a new result column

ALTER TABLE public.check_results
ADD COLUMN result text DEFAULT 'na';

-- Add constraint to ensure valid values
ALTER TABLE public.check_results
ADD CONSTRAINT check_results_result_check 
CHECK (result IN ('pass', 'fail', 'na'));

-- Update existing records: is_checked = true → 'pass', is_checked = false → 'na'
UPDATE public.check_results 
SET result = CASE 
  WHEN is_checked = true THEN 'pass' 
  ELSE 'na' 
END;