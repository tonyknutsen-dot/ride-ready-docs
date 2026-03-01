
-- =============================================
-- 1) Create risk_library_items table
-- =============================================
CREATE TABLE public.risk_library_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_type TEXT NOT NULL CHECK (item_type IN ('hazard', 'control')),
  equipment_group TEXT NOT NULL DEFAULT 'general',
  category TEXT NOT NULL DEFAULT 'General',
  label TEXT NOT NULL,
  hint TEXT,
  ride_category_id UUID REFERENCES public.ride_categories(id),
  sort_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 2) RLS on risk_library_items
-- =============================================
ALTER TABLE public.risk_library_items ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active items
CREATE POLICY "Authenticated users can read active risk library items"
  ON public.risk_library_items
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only admins can insert
CREATE POLICY "Admins can insert risk library items"
  ON public.risk_library_items
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update
CREATE POLICY "Admins can update risk library items"
  ON public.risk_library_items
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 3) Add equipment_group to user_submitted_risk_items
-- =============================================
ALTER TABLE public.user_submitted_risk_items
  ADD COLUMN IF NOT EXISTS equipment_group TEXT NOT NULL DEFAULT 'general';

-- =============================================
-- 4) Indexes
-- =============================================
CREATE INDEX idx_risk_library_items_type_group
  ON public.risk_library_items (item_type, equipment_group)
  WHERE is_active = true;

CREATE INDEX idx_risk_library_items_category
  ON public.risk_library_items (category)
  WHERE is_active = true;
