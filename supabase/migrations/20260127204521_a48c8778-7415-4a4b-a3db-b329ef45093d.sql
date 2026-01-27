-- Add schedule_document_id to ndt_schedules for linking the schedule document
ALTER TABLE public.ndt_schedules
ADD COLUMN schedule_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;

-- Add document_id to ndt_reports for linking the report document (instead of just file_path)
ALTER TABLE public.ndt_reports
ADD COLUMN document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_ndt_schedules_document ON public.ndt_schedules(schedule_document_id);
CREATE INDEX idx_ndt_reports_document ON public.ndt_reports(document_id);