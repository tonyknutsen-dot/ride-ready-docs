-- Create enum for defect severity
CREATE TYPE public.defect_severity AS ENUM ('non_urgent', 'urgent', 'stop_operation');

-- Create enum for defect status
CREATE TYPE public.defect_status AS ENUM ('open', 'acknowledged', 'in_progress', 'resolved');

-- Create defects table
CREATE TABLE public.defects (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    check_id UUID REFERENCES public.checks(id) ON DELETE CASCADE,
    ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    description TEXT NOT NULL,
    severity defect_severity NOT NULL DEFAULT 'non_urgent',
    status defect_status NOT NULL DEFAULT 'open',
    photo_paths TEXT[] DEFAULT '{}',
    location_on_ride TEXT,
    reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by TEXT,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    is_test_data BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Deny anonymous access to defects"
ON public.defects
FOR ALL
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage their own defects"
ON public.defects
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger for test data flag
CREATE TRIGGER set_defects_test_data
    BEFORE INSERT OR UPDATE ON public.defects
    FOR EACH ROW
    EXECUTE FUNCTION public.set_test_data_flag();

-- Trigger for updated_at
CREATE TRIGGER update_defects_updated_at
    BEFORE UPDATE ON public.defects
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for defect photos
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('defect-photos', 'defect-photos', false, 10485760);

-- Storage policies for defect photos
CREATE POLICY "Users can upload defect photos to their folder"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'defect-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own defect photos"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'defect-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own defect photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'defect-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);