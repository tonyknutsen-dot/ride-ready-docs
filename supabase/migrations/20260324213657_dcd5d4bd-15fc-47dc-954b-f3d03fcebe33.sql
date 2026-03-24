ALTER TABLE public.ride_categories 
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS approved_from_request_id uuid REFERENCES public.ride_type_requests(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ride_categories_archived ON public.ride_categories(is_archived);
CREATE INDEX IF NOT EXISTS idx_ride_categories_group ON public.ride_categories(category_group);