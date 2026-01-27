-- Add category column to check_library_items for grouping under headings
ALTER TABLE public.check_library_items 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'General';

-- Update existing items with sensible default categories based on common patterns
-- These are predefined categories: Restraints, Structure, Control Systems, Safety Devices, Electrical, Mechanical, Hydraulic/Pneumatic, General

-- Create index for faster category lookups
CREATE INDEX IF NOT EXISTS idx_check_library_items_category ON public.check_library_items(category);

-- Add category column to user_submitted_check_items for consistency
ALTER TABLE public.user_submitted_check_items 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'General';

-- Create index for faster category lookups on submissions
CREATE INDEX IF NOT EXISTS idx_user_submitted_check_items_category ON public.user_submitted_check_items(category);