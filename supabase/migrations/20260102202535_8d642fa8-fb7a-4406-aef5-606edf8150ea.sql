-- Add explicit RLS policies to deny anonymous access on all sensitive tables
-- This ensures that even if RLS is enabled, anonymous users cannot access any data

-- Create a helper function to check if user is authenticated
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'authenticated'
$$;

-- Profiles table - deny anonymous
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR ALL
USING (auth.role() = 'authenticated');

-- Saved recipients table - deny anonymous  
CREATE POLICY "Deny anonymous access to saved_recipients"
ON public.saved_recipients
FOR ALL
USING (auth.role() = 'authenticated');

-- Marketing contacts table - deny anonymous
CREATE POLICY "Deny anonymous access to marketing_contacts"
ON public.marketing_contacts
FOR ALL
USING (auth.role() = 'authenticated');

-- Support messages table - deny anonymous
CREATE POLICY "Deny anonymous access to support_messages"
ON public.support_messages
FOR ALL
USING (auth.role() = 'authenticated');

-- Checks table - deny anonymous
CREATE POLICY "Deny anonymous access to checks"
ON public.checks
FOR ALL
USING (auth.role() = 'authenticated');

-- Documents table - deny anonymous
CREATE POLICY "Deny anonymous access to documents"
ON public.documents
FOR ALL
USING (auth.role() = 'authenticated');

-- Rides table - deny anonymous
CREATE POLICY "Deny anonymous access to rides"
ON public.rides
FOR ALL
USING (auth.role() = 'authenticated');

-- Maintenance records table - deny anonymous
CREATE POLICY "Deny anonymous access to maintenance_records"
ON public.maintenance_records
FOR ALL
USING (auth.role() = 'authenticated');

-- Risk assessments table - deny anonymous
CREATE POLICY "Deny anonymous access to risk_assessments"
ON public.risk_assessments
FOR ALL
USING (auth.role() = 'authenticated');

-- NDT reports table - deny anonymous
CREATE POLICY "Deny anonymous access to ndt_reports"
ON public.ndt_reports
FOR ALL
USING (auth.role() = 'authenticated');

-- Annual inspection reports table - deny anonymous
CREATE POLICY "Deny anonymous access to annual_inspection_reports"
ON public.annual_inspection_reports
FOR ALL
USING (auth.role() = 'authenticated');

-- Email campaigns table - deny anonymous
CREATE POLICY "Deny anonymous access to email_campaigns"
ON public.email_campaigns
FOR ALL
USING (auth.role() = 'authenticated');

-- Email templates table - deny anonymous
CREATE POLICY "Deny anonymous access to email_templates"
ON public.email_templates
FOR ALL
USING (auth.role() = 'authenticated');

-- Feature requests table - deny anonymous
CREATE POLICY "Deny anonymous access to feature_requests"
ON public.feature_requests
FOR ALL
USING (auth.role() = 'authenticated');

-- Notifications table - deny anonymous
CREATE POLICY "Deny anonymous access to notifications"
ON public.notifications
FOR ALL
USING (auth.role() = 'authenticated');

-- Inspection schedules table - deny anonymous
CREATE POLICY "Deny anonymous access to inspection_schedules"
ON public.inspection_schedules
FOR ALL
USING (auth.role() = 'authenticated');

-- NDT schedules table - deny anonymous
CREATE POLICY "Deny anonymous access to ndt_schedules"
ON public.ndt_schedules
FOR ALL
USING (auth.role() = 'authenticated');

-- Daily check templates table - deny anonymous
CREATE POLICY "Deny anonymous access to daily_check_templates"
ON public.daily_check_templates
FOR ALL
USING (auth.role() = 'authenticated');

-- Check results table - deny anonymous
CREATE POLICY "Deny anonymous access to check_results"
ON public.check_results
FOR ALL
USING (auth.role() = 'authenticated');

-- Risk assessment items table - deny anonymous
CREATE POLICY "Deny anonymous access to risk_assessment_items"
ON public.risk_assessment_items
FOR ALL
USING (auth.role() = 'authenticated');

-- Risk assessment audit log table - deny anonymous
CREATE POLICY "Deny anonymous access to risk_assessment_audit_log"
ON public.risk_assessment_audit_log
FOR ALL
USING (auth.role() = 'authenticated');

-- Campaign recipients table - deny anonymous
CREATE POLICY "Deny anonymous access to campaign_recipients"
ON public.campaign_recipients
FOR ALL
USING (auth.role() = 'authenticated');

-- User roles table - deny anonymous
CREATE POLICY "Deny anonymous access to user_roles"
ON public.user_roles
FOR ALL
USING (auth.role() = 'authenticated');

-- Daily check template items - deny anonymous
CREATE POLICY "Deny anonymous access to daily_check_template_items"
ON public.daily_check_template_items
FOR ALL
USING (auth.role() = 'authenticated');

-- Document type requests - deny anonymous
CREATE POLICY "Deny anonymous access to document_type_requests"
ON public.document_type_requests
FOR ALL
USING (auth.role() = 'authenticated');

-- Ride type requests - deny anonymous
CREATE POLICY "Deny anonymous access to ride_type_requests"
ON public.ride_type_requests
FOR ALL
USING (auth.role() = 'authenticated');