
CREATE TABLE public.anemometer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  serial_number text,
  label text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.anemometer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own anemometer profiles"
  ON public.anemometer_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Deny anonymous access to anemometer_profiles"
  ON public.anemometer_profiles
  FOR ALL
  TO anon
  USING (false);
