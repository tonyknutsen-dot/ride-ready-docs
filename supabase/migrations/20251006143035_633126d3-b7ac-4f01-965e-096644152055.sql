-- Create feature_requests table
CREATE TABLE IF NOT EXISTS public.feature_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_title TEXT NOT NULL,
  feature_description TEXT NOT NULL,
  use_case TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'planned', 'in_progress', 'completed', 'declined')),
  admin_notes TEXT,
  votes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own feature requests
CREATE POLICY "Users can view their own feature requests"
  ON public.feature_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own feature requests
CREATE POLICY "Users can create feature requests"
  ON public.feature_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own feature requests (only certain fields)
CREATE POLICY "Users can update their own feature requests"
  ON public.feature_requests
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can view all feature requests
CREATE POLICY "Admins can view all feature requests"
  ON public.feature_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Admins can update all feature requests
CREATE POLICY "Admins can update all feature requests"
  ON public.feature_requests
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_feature_requests_updated_at
  BEFORE UPDATE ON public.feature_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_feature_requests_user_id ON public.feature_requests(user_id);
CREATE INDEX idx_feature_requests_status ON public.feature_requests(status);
CREATE INDEX idx_feature_requests_created_at ON public.feature_requests(created_at DESC);