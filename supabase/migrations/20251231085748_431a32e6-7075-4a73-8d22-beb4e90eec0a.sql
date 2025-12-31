-- Create table for saved recipients
CREATE TABLE public.saved_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization_type TEXT,
  notes TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_recipients ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own recipients
CREATE POLICY "Users can manage their own saved recipients"
ON public.saved_recipients
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_saved_recipients_updated_at
BEFORE UPDATE ON public.saved_recipients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();