-- Create junction table for document-ride assignments
CREATE TABLE public.document_ride_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  user_id UUID NOT NULL,
  UNIQUE(document_id, ride_id)
);

-- Enable Row Level Security
ALTER TABLE public.document_ride_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own document assignments" 
ON public.document_ride_assignments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own document assignments" 
ON public.document_ride_assignments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own document assignments" 
ON public.document_ride_assignments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_document_ride_assignments_document ON public.document_ride_assignments(document_id);
CREATE INDEX idx_document_ride_assignments_ride ON public.document_ride_assignments(ride_id);