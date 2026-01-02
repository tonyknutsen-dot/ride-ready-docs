-- Remove 'preuse' from check_frequency enum
-- PostgreSQL doesn't allow direct removal of enum values, so we need to recreate the type

-- Step 1: Create new enum type without 'preuse'
CREATE TYPE check_frequency_new AS ENUM ('daily', 'monthly', 'yearly', 'preopening');

-- Step 2: Update columns to use new type
ALTER TABLE check_library_items 
  ALTER COLUMN frequency TYPE check_frequency_new 
  USING frequency::text::check_frequency_new;

ALTER TABLE checks 
  ALTER COLUMN check_frequency TYPE text;

ALTER TABLE daily_check_templates 
  ALTER COLUMN check_frequency TYPE text;

-- Step 3: Drop old enum and rename new one
DROP TYPE check_frequency;
ALTER TYPE check_frequency_new RENAME TO check_frequency;