-- Table to track user-submitted check items for admin review
CREATE TABLE public.user_submitted_check_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ride_category_id uuid REFERENCES public.ride_categories(id) ON DELETE SET NULL,
  label text NOT NULL,
  hint text,
  frequency text NOT NULL CHECK (frequency IN ('preopening', 'daily', 'monthly', 'yearly')),
  is_generic boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  admin_notes text,
  similarity_group uuid, -- Groups similar submissions together
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_submitted_check_items ENABLE ROW LEVEL SECURITY;

-- Users can submit items
CREATE POLICY "Users can submit check items"
ON public.user_submitted_check_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own submissions
CREATE POLICY "Users can view their own submissions"
ON public.user_submitted_check_items FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all submissions
CREATE POLICY "Admins can view all submissions"
ON public.user_submitted_check_items FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update submissions (approve/reject)
CREATE POLICY "Admins can update submissions"
ON public.user_submitted_check_items FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Admins can insert into check_library_items (for approvals)
CREATE POLICY "Admins can add to check library"
ON public.check_library_items FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Admins can update check library items
CREATE POLICY "Admins can update check library"
ON public.check_library_items FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Index for admin queries
CREATE INDEX idx_user_submitted_items_status ON public.user_submitted_check_items(status);
CREATE INDEX idx_user_submitted_items_category ON public.user_submitted_check_items(ride_category_id);
CREATE INDEX idx_user_submitted_items_frequency ON public.user_submitted_check_items(frequency);