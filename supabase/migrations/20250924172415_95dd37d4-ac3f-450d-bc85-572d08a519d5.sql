-- Create daily check templates table
CREATE TABLE public.daily_check_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create daily check template items table
CREATE TABLE public.daily_check_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.daily_check_templates(id) ON DELETE CASCADE,
  check_item_text TEXT NOT NULL,
  is_required BOOLEAN DEFAULT true,
  category TEXT DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create completed daily checks table
CREATE TABLE public.daily_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.daily_check_templates(id) ON DELETE CASCADE,
  inspector_name TEXT NOT NULL,
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'partial')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create daily check results table (individual check item results)
CREATE TABLE public.daily_check_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_check_id UUID NOT NULL REFERENCES public.daily_checks(id) ON DELETE CASCADE,
  template_item_id UUID NOT NULL REFERENCES public.daily_check_template_items(id) ON DELETE CASCADE,
  is_checked BOOLEAN NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pre-built check item library table
CREATE TABLE public.check_item_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  check_item_text TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.daily_check_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_check_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_item_library ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own daily check templates" 
ON public.daily_check_templates 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage template items for their templates" 
ON public.daily_check_template_items 
FOR ALL 
USING (template_id IN (SELECT id FROM public.daily_check_templates WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their own daily checks" 
ON public.daily_checks 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage results for their daily checks" 
ON public.daily_check_results 
FOR ALL 
USING (daily_check_id IN (SELECT id FROM public.daily_checks WHERE user_id = auth.uid()));

CREATE POLICY "Everyone can view check item library" 
ON public.check_item_library 
FOR SELECT 
USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_daily_check_templates_updated_at
BEFORE UPDATE ON public.daily_check_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_daily_check_templates_user_ride ON public.daily_check_templates(user_id, ride_id);
CREATE INDEX idx_daily_check_template_items_template ON public.daily_check_template_items(template_id);
CREATE INDEX idx_daily_checks_user_ride_date ON public.daily_checks(user_id, ride_id, check_date);
CREATE INDEX idx_daily_check_results_check_id ON public.daily_check_results(daily_check_id);
CREATE INDEX idx_check_item_library_category ON public.check_item_library(category);

-- Populate the check item library with pre-built components
INSERT INTO public.check_item_library (category, check_item_text, description, is_required, sort_order) VALUES
-- General safety checks (apply to all rides)
('general', 'Visual inspection of ride structure', 'Check for cracks, rust, or damage to main structure', true, 1),
('general', 'Safety barriers and gates secure', 'Ensure all barriers are properly secured and gates function correctly', true, 2),
('general', 'Emergency stop buttons functional', 'Test all emergency stop buttons and verify they work', true, 3),
('general', 'Safety signage visible and intact', 'Check that all safety signs are visible and undamaged', true, 4),
('general', 'Ground area clear of debris', 'Ensure operating area is clean and free of hazards', true, 5),
('general', 'Weather conditions suitable', 'Verify weather conditions are appropriate for operation', true, 6),

-- Chair O Plane specific checks
('chair_o_plane', 'Chair chains and connections secure', 'Inspect all chair chains for wear and secure connections', true, 1),
('chair_o_plane', 'Chair seats properly attached', 'Verify all seats are securely mounted to chains', true, 2),
('chair_o_plane', 'Center rotation mechanism smooth', 'Test rotation mechanism for smooth operation', true, 3),
('chair_o_plane', 'Chair swing clearance adequate', 'Check clearance between chairs and any obstacles', true, 4),

-- Dodgems specific checks
('dodgems', 'Floor surface clean and intact', 'Check floor for damage, cleanliness, and proper conductivity', true, 1),
('dodgems', 'Car bumpers in good condition', 'Inspect bumpers for damage or excessive wear', true, 2),
('dodgems', 'Electrical pickup poles secure', 'Verify pickup poles are properly attached and functioning', true, 3),
('dodgems', 'Track power supply operational', 'Test electrical supply to track system', true, 4),

-- Twist specific checks
('twist', 'Gondolas securely attached', 'Check all gondola mounting points and connections', true, 1),
('twist', 'Passenger restraint systems functional', 'Test all safety restraints and locking mechanisms', true, 2),
('twist', 'Hydraulic systems operating normally', 'Check hydraulic pressure and smooth operation', true, 3),
('twist', 'Twist mechanism lubricated', 'Verify adequate lubrication of moving parts', true, 4),

-- Big Wheel specific checks
('big_wheel', 'Gondola doors secure', 'Check all gondola doors close and lock properly', true, 1),
('big_wheel', 'Wheel rotation smooth', 'Test wheel rotation for smooth, consistent movement', true, 2),
('big_wheel', 'Loading platform stable', 'Verify loading platform is secure and level', true, 3),
('big_wheel', 'Height safety sensors working', 'Test sensors that monitor gondola positions', true, 4),

-- Carousel specific checks
('carousel', 'Horse/animal figures secure', 'Check all figures are properly mounted', true, 1),
('carousel', 'Center pole and bearings', 'Inspect center mechanism for smooth rotation', true, 2),
('carousel', 'Music system operational', 'Test sound system and music playback', false, 3),
('carousel', 'Lighting system functional', 'Check all decorative and safety lighting', false, 4),

-- Waltzers specific checks
('waltzers', 'Car spin mechanisms free', 'Test each car can spin freely without obstruction', true, 1),
('waltzers', 'Track surface level', 'Check track for level surface and secure mounting', true, 2),
('waltzers', 'Center drive system smooth', 'Verify main drive operates smoothly', true, 3),
('waltzers', 'Car safety restraints working', 'Test safety bars and restraints in each car', true, 4);