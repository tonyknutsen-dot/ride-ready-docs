-- Fix: Equipment and Food Stalls must be billable
UPDATE ride_categories SET is_billable = true WHERE category_group IN ('Equipment', 'Food Stalls') AND is_billable = false;