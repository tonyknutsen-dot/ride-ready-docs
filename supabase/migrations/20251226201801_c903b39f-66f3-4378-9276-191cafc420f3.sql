-- Add category_group column to ride_categories
ALTER TABLE public.ride_categories 
ADD COLUMN category_group text NOT NULL DEFAULT 'Rides';

-- Update category groups based on category names
UPDATE public.ride_categories 
SET category_group = 'Food Stalls'
WHERE name IN (
  'Burger Van', 'Candy Floss', 'Crepe Stand', 'Donut Stall', 
  'Fish & Chips', 'Hot Dog Stand', 'Ice Cream Van', 'Jacket Potato',
  'Noodle Bar', 'Pizza Stall', 'Popcorn Stand', 'Sweet Stall', 
  'Tea & Coffee', 'Toffee Apple'
);

UPDATE public.ride_categories 
SET category_group = 'Games'
WHERE name IN (
  'Arcade Games', 'Basketball Hoops', 'Coconut Shy', 'Darts',
  'Hook-a-Duck', 'Hoopla', 'Penny Arcade', 'Ring Toss',
  'Shooting Gallery', 'Test Your Strength', 'Tombola'
);

UPDATE public.ride_categories 
SET category_group = 'Equipment'
WHERE name IN ('Generator');

-- Merge duplicate: Delete "Chair O Plane", keep "Chair-o-Plane"
-- First update any rides that reference "Chair O Plane" to use "Chair-o-Plane"
UPDATE public.rides 
SET category_id = (SELECT id FROM public.ride_categories WHERE name = 'Chair-o-Plane' LIMIT 1)
WHERE category_id = (SELECT id FROM public.ride_categories WHERE name = 'Chair O Plane' LIMIT 1);

-- Delete the duplicate category
DELETE FROM public.ride_categories WHERE name = 'Chair O Plane';

-- Merge "Big Wheel" into "Ferris Wheel"
UPDATE public.rides 
SET category_id = (SELECT id FROM public.ride_categories WHERE name = 'Ferris Wheel' LIMIT 1)
WHERE category_id = (SELECT id FROM public.ride_categories WHERE name = 'Big Wheel' LIMIT 1);

DELETE FROM public.ride_categories WHERE name = 'Big Wheel';