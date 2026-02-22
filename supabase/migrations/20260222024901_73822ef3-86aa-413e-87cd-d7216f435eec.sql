
ALTER TABLE public.rides
ADD COLUMN requires_operational_checks boolean NOT NULL DEFAULT true;

-- Default stalls/kiosks/static assets to false based on category name patterns
UPDATE public.rides r
SET requires_operational_checks = false
FROM public.ride_categories rc
WHERE r.category_id = rc.id
AND rc.name ILIKE ANY(ARRAY['%stall%', '%kiosk%', '%generator%', '%booth%', '%static%', '%food%', '%game%']);
