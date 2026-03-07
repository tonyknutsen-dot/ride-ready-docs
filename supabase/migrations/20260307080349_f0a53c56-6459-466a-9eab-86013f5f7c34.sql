
-- User security settings table for lock screen / PIN / idle lock
CREATE TABLE public.user_security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  lock_pin_hash text,
  idle_lock_minutes integer DEFAULT 15,
  remember_device_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own security settings"
ON public.user_security_settings
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own security settings"
ON public.user_security_settings
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own security settings"
ON public.user_security_settings
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Trigger to auto-update updated_at
CREATE TRIGGER update_security_settings_updated_at
  BEFORE UPDATE ON public.user_security_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
