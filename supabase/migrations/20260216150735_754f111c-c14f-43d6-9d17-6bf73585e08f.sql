
-- Add is_billable column to ride_categories for asset classification
-- Rides and Inflatables count toward pricing; Stalls, Games, Equipment are free within paid plans
ALTER TABLE public.ride_categories ADD COLUMN IF NOT EXISTS is_billable boolean NOT NULL DEFAULT true;

-- Set free categories (stalls, kiosks, games, generators, equipment, support)
UPDATE public.ride_categories SET is_billable = false WHERE category_group IN ('Food Stalls', 'Games', 'Equipment');

-- Ensure Rides, Attractions, Inflatables are billable (they should already be true by default)
UPDATE public.ride_categories SET is_billable = true WHERE category_group IN ('Rides', 'Attractions', 'Inflatables', 'Thrill Rides', 'Family Rides', 'Kiddie Rides');
