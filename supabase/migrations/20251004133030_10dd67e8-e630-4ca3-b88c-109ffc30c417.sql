-- Create risk assessments table
CREATE TABLE public.risk_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ride_id UUID NOT NULL,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  assessor_name TEXT NOT NULL,
  review_date DATE,
  overall_status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create risk assessment items table
CREATE TABLE public.risk_assessment_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  risk_assessment_id UUID NOT NULL,
  hazard_description TEXT NOT NULL,
  who_at_risk TEXT NOT NULL,
  existing_controls TEXT,
  risk_level TEXT NOT NULL DEFAULT 'medium',
  likelihood TEXT NOT NULL DEFAULT 'possible',
  severity TEXT NOT NULL DEFAULT 'moderate',
  additional_actions TEXT,
  action_owner TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessment_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for risk_assessments
CREATE POLICY "Users can manage their own risk assessments"
ON public.risk_assessments
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for risk_assessment_items
CREATE POLICY "Users can manage items for their risk assessments"
ON public.risk_assessment_items
FOR ALL
USING (
  risk_assessment_id IN (
    SELECT id FROM public.risk_assessments WHERE user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_risk_assessments_updated_at
BEFORE UPDATE ON public.risk_assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();