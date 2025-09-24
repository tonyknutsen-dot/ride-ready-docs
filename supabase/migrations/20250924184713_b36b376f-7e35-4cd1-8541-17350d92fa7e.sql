-- Add support for monthly and annual check templates
ALTER TABLE daily_check_templates 
  ADD COLUMN IF NOT EXISTS template_type text DEFAULT 'daily' CHECK (template_type IN ('daily', 'monthly', 'annual', 'custom'));

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  is_read BOOLEAN DEFAULT false,
  related_table TEXT,
  related_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create maintenance_records table
CREATE TABLE IF NOT EXISTS public.maintenance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ride_id UUID NOT NULL,
  maintenance_type TEXT NOT NULL,
  description TEXT NOT NULL,
  cost DECIMAL(10,2),
  maintenance_date DATE NOT NULL,
  performed_by TEXT,
  parts_replaced TEXT,
  next_maintenance_due DATE,
  notes TEXT,
  document_ids UUID[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create compliance_templates table for regulatory compliance
CREATE TABLE IF NOT EXISTS public.compliance_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  category_id UUID,
  requirements JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Create RLS policies for maintenance_records
CREATE POLICY "Users can manage their own maintenance records" 
ON public.maintenance_records 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for compliance_templates
CREATE POLICY "Users can view compliance templates" 
ON public.compliance_templates 
FOR SELECT 
USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_user_id ON public.maintenance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_ride_id ON public.maintenance_records(ride_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_date ON public.maintenance_records(maintenance_date DESC);

-- Add triggers for updated_at
CREATE TRIGGER update_maintenance_records_updated_at
BEFORE UPDATE ON public.maintenance_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_templates_updated_at
BEFORE UPDATE ON public.compliance_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();