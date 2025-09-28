-- Remove retail stalls (but keep generators)
DELETE FROM public.ride_categories WHERE name IN (
  'Toy Stall',
  'Clothing Stall', 
  'Jewellery Stall',
  'Souvenir Stall',
  'Book Stall',
  'Craft Stall',
  'Plant Stall',
  'Antique Stall',
  'Toilet Block',
  'Information Stall',
  'First Aid',
  'Lost Property',
  'Ticket Office'
);

-- Keep Generator as it's still needed