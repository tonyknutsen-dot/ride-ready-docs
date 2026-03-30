
-- Unified platform settings / feature flags table
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT 'false',
  label text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Admin read
CREATE POLICY "Admins can read platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin write
CREATE POLICY "Admins can update platform settings"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin insert (for seeding)
CREATE POLICY "Admins can insert platform settings"
  ON public.platform_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed initial settings
INSERT INTO public.platform_settings (key, value, label, description, category) VALUES
  ('maintenance_mode', 'false', 'Maintenance Mode', 'When enabled, shows maintenance banner to all users.', 'platform_status'),
  ('maintenance_message', '', 'Maintenance Message', 'Message displayed during maintenance.', 'platform_status'),
  ('maintenance_internal_note', '', 'Maintenance Internal Note', 'Admin-only note about current maintenance.', 'platform_status'),
  ('public_enquiries_enabled', 'true', 'Public Enquiries', 'Allow public contact form submissions.', 'access'),
  ('early_access_enabled', 'true', 'Early Access Signups', 'Allow early access signup form.', 'access'),
  ('marketing_tools_enabled', 'true', 'Marketing Campaign Tools', 'Enable marketing campaign features.', 'access'),
  ('support_access_grants_enabled', 'true', 'Support Access Grants', 'Allow support access grant system.', 'access'),
  ('admin_system_health_enabled', 'true', 'System Health Page', 'Enable the System Health admin page.', 'feature_flag'),
  ('admin_email_log_enabled', 'true', 'Email Log Page', 'Enable the Email Log admin page.', 'feature_flag'),
  ('admin_jobs_queues_enabled', 'true', 'Jobs & Queues Page', 'Enable the Jobs & Queues admin page.', 'feature_flag'),
  ('release_note_title', '', 'Release Note Title', 'Current release or rollout title.', 'release'),
  ('release_note_body', '', 'Release Note Body', 'Current release or rollout notes.', 'release'),
  ('deployment_note', '', 'Last Deployment Note', 'Notes from most recent deployment.', 'release');
