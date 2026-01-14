-- Add indexes on frequently queried columns for better performance

-- Documents table indexes
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON public.documents(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_user_uploaded ON public.documents(user_id, uploaded_at DESC);

-- Rides table indexes
CREATE INDEX IF NOT EXISTS idx_rides_user_id ON public.rides(user_id);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON public.rides(created_at DESC);

-- Checks table indexes
CREATE INDEX IF NOT EXISTS idx_checks_user_id ON public.checks(user_id);
CREATE INDEX IF NOT EXISTS idx_checks_check_date ON public.checks(check_date DESC);
CREATE INDEX IF NOT EXISTS idx_checks_user_date ON public.checks(user_id, check_date DESC);

-- Maintenance records indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_records_user_id ON public.maintenance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_date ON public.maintenance_records(maintenance_date DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_user_date ON public.maintenance_records(user_id, maintenance_date DESC);

-- Inspection schedules indexes
CREATE INDEX IF NOT EXISTS idx_inspection_schedules_user_id ON public.inspection_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_inspection_schedules_due_date ON public.inspection_schedules(due_date);
CREATE INDEX IF NOT EXISTS idx_inspection_schedules_user_due ON public.inspection_schedules(user_id, due_date);

-- Daily check templates indexes
CREATE INDEX IF NOT EXISTS idx_daily_check_templates_user_id ON public.daily_check_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_check_templates_ride_id ON public.daily_check_templates(ride_id);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);

-- Risk assessments indexes
CREATE INDEX IF NOT EXISTS idx_risk_assessments_user_id ON public.risk_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_ride_id ON public.risk_assessments(ride_id);

-- Annual inspection reports indexes
CREATE INDEX IF NOT EXISTS idx_annual_inspection_reports_user_id ON public.annual_inspection_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_annual_inspection_reports_ride_id ON public.annual_inspection_reports(ride_id);

-- NDT schedules indexes
CREATE INDEX IF NOT EXISTS idx_ndt_schedules_user_id ON public.ndt_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_ndt_schedules_ride_id ON public.ndt_schedules(ride_id);

-- Document ride assignments indexes
CREATE INDEX IF NOT EXISTS idx_document_ride_assignments_user_id ON public.document_ride_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_document_ride_assignments_document_id ON public.document_ride_assignments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_ride_assignments_ride_id ON public.document_ride_assignments(ride_id);

-- Profiles indexes (for subscription checks)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Support messages indexes
CREATE INDEX IF NOT EXISTS idx_support_messages_user_id ON public.support_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_status ON public.support_messages(status);