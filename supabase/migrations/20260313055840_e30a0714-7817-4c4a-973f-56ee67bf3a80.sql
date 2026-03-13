
-- 1. Rename "Kiddie Rides" to "Kiddie Rides (coin operated)"
UPDATE ride_categories
SET name = 'Kiddie Rides (coin operated)'
WHERE id = '911f0fa5-c43d-4825-bf1c-3d7d31065e1d';

-- 2. Move "Simulators" from Games to Attractions
UPDATE ride_categories
SET category_group = 'Attractions'
WHERE id = '32ec2202-c223-48dc-8278-37a323a170c7';
