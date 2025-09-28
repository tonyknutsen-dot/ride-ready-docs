-- Create inspection schedules table for tracking various inspection due dates
CREATE TABLE public.inspection_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ride_id UUID NOT NULL,
  inspection_type TEXT NOT NULL, -- 'in-service', 'electrical', 'ndt', 'structural', 'hydraulic', etc.
  inspection_name TEXT NOT NULL,
  due_date DATE NOT NULL,
  advance_notice_days INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  last_notification_sent TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.inspection_schedules ENABLE ROW LEVEL SECURITY;

-- Create policies for inspection schedules
CREATE POLICY "Users can manage their own inspection schedules" 
ON public.inspection_schedules 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_inspection_schedules_updated_at
BEFORE UPDATE ON public.inspection_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient querying of due inspections
CREATE INDEX idx_inspection_schedules_due_date ON public.inspection_schedules(due_date, is_active) WHERE is_active = true;