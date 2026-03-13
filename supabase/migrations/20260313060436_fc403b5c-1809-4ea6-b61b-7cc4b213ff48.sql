
-- 1. Move "Jumping Castle" from Rides to Inflatables
UPDATE ride_categories
SET category_group = 'Inflatables'
WHERE id = '6eed57f2-86a8-40ff-bbed-a822abc70bb6';

-- Reassign its type-specific check_library_items from 'rides' to 'inflatables'
UPDATE check_library_items
SET equipment_group = 'inflatables'
WHERE ride_category_id = '6eed57f2-86a8-40ff-bbed-a822abc70bb6';

-- 2. Remove duplicate "Crepes" — keep "Crepe Stand" as the canonical name
DELETE FROM ride_categories
WHERE id = '6c3fd58e-9a08-496a-ae04-d8e8f6828b91';

-- 3. Remove duplicate "Tilt-A-Whirl" (keep "Tilt-a-Whirl")
DELETE FROM ride_categories
WHERE id = '84c7ed27-a0c4-4458-a09f-35c65bad9226';
