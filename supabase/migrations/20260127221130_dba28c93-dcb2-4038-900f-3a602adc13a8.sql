-- Table to track user-submitted risk assessment hazards and controls for admin review
CREATE TABLE public.user_submitted_risk_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('hazard', 'control')),
  label text NOT NULL,
  category text DEFAULT 'General',
  ride_category_id uuid REFERENCES public.ride_categories(id) ON DELETE SET NULL,
  source_assessment_id uuid REFERENCES public.risk_assessments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  admin_notes text,
  similarity_group text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_submitted_risk_items ENABLE ROW LEVEL SECURITY;

-- Users can submit items
CREATE POLICY "Users can submit risk items"
ON public.user_submitted_risk_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own submissions
CREATE POLICY "Users can view their own risk submissions"
ON public.user_submitted_risk_items FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all submissions
CREATE POLICY "Admins can view all risk submissions"
ON public.user_submitted_risk_items FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update submissions (approve/reject)
CREATE POLICY "Admins can update risk submissions"
ON public.user_submitted_risk_items FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Admins can delete submissions
CREATE POLICY "Admins can delete risk submissions"
ON public.user_submitted_risk_items FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Indexes for admin queries
CREATE INDEX idx_user_submitted_risk_items_status ON public.user_submitted_risk_items(status);
CREATE INDEX idx_user_submitted_risk_items_type ON public.user_submitted_risk_items(item_type);
CREATE INDEX idx_user_submitted_risk_items_category ON public.user_submitted_risk_items(category);

-- Add trigger for updated_at
CREATE TRIGGER update_user_submitted_risk_items_updated_at
  BEFORE UPDATE ON public.user_submitted_risk_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();