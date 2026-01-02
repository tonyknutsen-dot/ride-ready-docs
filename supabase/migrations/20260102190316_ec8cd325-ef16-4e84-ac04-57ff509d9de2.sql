-- Update all existing data from 'preuse' to 'preopening'
UPDATE check_library_items SET frequency = 'preopening' WHERE frequency = 'preuse';
UPDATE checks SET check_frequency = 'preopening' WHERE check_frequency = 'preuse';
UPDATE daily_check_templates SET check_frequency = 'preopening' WHERE check_frequency = 'preuse';