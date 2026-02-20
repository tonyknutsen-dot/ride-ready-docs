
-- 1) Add ride_code to rides (short code derived from ride name)
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS ride_code text;

-- 2) Auto-populate ride_code for existing rides (first letters of each word, uppercase, max 4 chars)
UPDATE public.rides
SET ride_code = UPPER(LEFT(
  array_to_string(
    ARRAY(SELECT LEFT(word, 1) FROM unnest(string_to_array(ride_name, ' ')) AS word WHERE word <> ''),
    ''
  ), 4
))
WHERE ride_code IS NULL;

-- 3) Add full_document_id to compliance_events
ALTER TABLE public.compliance_events ADD COLUMN IF NOT EXISTS full_document_id text;

-- 4) Sequence tracking table (one row per ride per year)
CREATE TABLE IF NOT EXISTS public.compliance_record_sequences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  completion_year integer NOT NULL,
  current_sequence integer NOT NULL DEFAULT 0,
  UNIQUE(ride_id, completion_year)
);

ALTER TABLE public.compliance_record_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sequences"
  ON public.compliance_record_sequences FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert sequences"
  ON public.compliance_record_sequences FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update sequences"
  ON public.compliance_record_sequences FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 5) Atomic function to generate next compliance record number
CREATE OR REPLACE FUNCTION public.generate_compliance_record_number(
  p_ride_id uuid,
  p_completion_year integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ride_code text;
  v_seq integer;
  v_full_id text;
BEGIN
  -- Get ride code
  SELECT ride_code INTO v_ride_code FROM public.rides WHERE id = p_ride_id;
  IF v_ride_code IS NULL OR v_ride_code = '' THEN
    -- Fallback: generate from ride name
    SELECT UPPER(LEFT(
      array_to_string(
        ARRAY(SELECT LEFT(word, 1) FROM unnest(string_to_array(ride_name, ' ')) AS word WHERE word <> ''),
        ''
      ), 4
    )) INTO v_ride_code FROM public.rides WHERE id = p_ride_id;
    
    UPDATE public.rides SET ride_code = v_ride_code WHERE id = p_ride_id;
  END IF;

  -- Atomically increment sequence
  INSERT INTO public.compliance_record_sequences (ride_id, completion_year, current_sequence)
  VALUES (p_ride_id, p_completion_year, 1)
  ON CONFLICT (ride_id, completion_year)
  DO UPDATE SET current_sequence = compliance_record_sequences.current_sequence + 1
  RETURNING current_sequence INTO v_seq;

  -- Format: [RIDE_CODE]-CR-[YEAR]-[SEQUENCE]
  v_full_id := v_ride_code || '-CR-' || p_completion_year::text || '-' || LPAD(v_seq::text, 4, '0');

  RETURN v_full_id;
END;
$function$;
