-- Create check frequency enum if not exists
DO $$ BEGIN
  CREATE TYPE public.check_frequency AS ENUM ('daily', 'monthly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create check library items table
CREATE TABLE IF NOT EXISTS public.check_library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  frequency public.check_frequency NOT NULL,
  ride_category_id uuid NULL REFERENCES public.ride_categories(id) ON DELETE SET NULL,
  hint text NULL,
  risk_level text NULL CHECK (risk_level IN ('low','med','high')),
  is_active boolean NOT NULL DEFAULT true,
  sort_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cli_freq ON public.check_library_items(frequency);
CREATE INDEX IF NOT EXISTS idx_cli_cat ON public.check_library_items(ride_category_id);
CREATE INDEX IF NOT EXISTS idx_cli_active ON public.check_library_items(is_active);

-- Enable RLS
ALTER TABLE public.check_library_items ENABLE ROW LEVEL SECURITY;

-- Read-only for all authenticated users (the library is shared)
DROP POLICY IF EXISTS "cli_sel" ON public.check_library_items;
CREATE POLICY "cli_sel" ON public.check_library_items
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Seed initial library items (generic + ride-type specific)
INSERT INTO public.check_library_items (label, frequency, ride_category_id, hint, risk_level, sort_index)
VALUES
-- DAILY — generic
('Emergency stop (E-Stop) test', 'daily', NULL, 'Press to confirm instant stop', 'high', 10),
('Restraints/doors secured', 'daily', NULL, 'Check latches, interlocks, pins', 'high', 20),
('Operator station clear', 'daily', NULL, 'No drinks/objects, controls labelled', 'med', 30),
('Area fencing/barriers secure', 'daily', NULL, 'No gaps, trip hazards removed', 'med', 40),
('Power / cables safe', 'daily', NULL, 'No exposed conductors, strain relief OK', 'high', 50),
('Weather conditions check', 'daily', NULL, 'Wind speed, rain, temperature within limits', 'high', 60),
('Ground conditions stable', 'daily', NULL, 'No sinking, shifting, or soft ground', 'high', 70),
('Lighting functional', 'daily', NULL, 'All ride and queue lighting operational', 'med', 80),
('Queue barriers intact', 'daily', NULL, 'Rope, posts, gates secure', 'low', 90),
('Signage visible', 'daily', NULL, 'Height, age, health warnings clear', 'med', 100),

-- MONTHLY — generic
('Lubrication points serviced', 'monthly', NULL, 'Apply as per manual', 'med', 10),
('Fasteners torque check', 'monthly', NULL, 'Critical joints per manual', 'high', 20),
('Hydraulic leaks inspection', 'monthly', NULL, 'Hoses, rams, connectors', 'high', 30),
('Electrical connections tight', 'monthly', NULL, 'Terminals, plugs, earth bonds', 'high', 40),
('Wear indicators checked', 'monthly', NULL, 'Bearings, chains, belts, pads', 'high', 50),
('Fire extinguisher check', 'monthly', NULL, 'Pressure gauge, access clear', 'med', 60),
('First aid kit stocked', 'monthly', NULL, 'Supplies in date, kit accessible', 'low', 70),

-- YEARLY — generic
('Full structural inspection', 'yearly', NULL, 'Cracks, corrosion, deformation', 'high', 10),
('Control system function test', 'yearly', NULL, 'Interlocks, sensors, PLC I/O', 'high', 20),
('Load testing', 'yearly', NULL, 'Rated capacity verification', 'high', 30),
('NDT inspection scheduled', 'yearly', NULL, 'Non-destructive testing of critical welds', 'high', 40),
('Insurance documentation current', 'yearly', NULL, 'Public liability, employer liability', 'high', 50),
('Staff training records updated', 'yearly', NULL, 'Operator competency, emergency procedures', 'med', 60),
('Risk assessments reviewed', 'yearly', NULL, 'RA, method statements, COSHH', 'high', 70)
ON CONFLICT DO NOTHING;