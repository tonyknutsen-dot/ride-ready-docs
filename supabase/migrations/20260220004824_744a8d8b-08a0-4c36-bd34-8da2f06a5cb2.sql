
-- Drop the existing unique constraint on (ride_id, completion_year)
ALTER TABLE public.compliance_record_sequences 
  ADD COLUMN doc_type text NOT NULL DEFAULT 'CR';

-- Drop old unique constraint and add new one including doc_type
ALTER TABLE public.compliance_record_sequences
  DROP CONSTRAINT IF EXISTS compliance_record_sequences_ride_id_completion_year_key;

ALTER TABLE public.compliance_record_sequences
  ADD CONSTRAINT compliance_record_sequences_ride_id_year_doctype_key 
  UNIQUE (ride_id, completion_year, doc_type);

-- Replace the function to accept doc_type parameter
CREATE OR REPLACE FUNCTION public.generate_compliance_record_number(
  p_ride_id uuid, 
  p_completion_year integer,
  p_doc_type text DEFAULT 'CR'
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
    SELECT UPPER(LEFT(
      array_to_string(
        ARRAY(SELECT LEFT(word, 1) FROM unnest(string_to_array(ride_name, ' ')) AS word WHERE word <> ''),
        ''
      ), 4
    )) INTO v_ride_code FROM public.rides WHERE id = p_ride_id;
    
    UPDATE public.rides SET ride_code = v_ride_code WHERE id = p_ride_id;
  END IF;

  -- Atomically increment sequence for this ride + year + doc_type
  INSERT INTO public.compliance_record_sequences (ride_id, completion_year, doc_type, current_sequence)
  VALUES (p_ride_id, p_completion_year, p_doc_type, 1)
  ON CONFLICT (ride_id, completion_year, doc_type)
  DO UPDATE SET current_sequence = compliance_record_sequences.current_sequence + 1
  RETURNING current_sequence INTO v_seq;

  -- Format: [RIDE_CODE]-[DOC_TYPE]-[YEAR]-[SEQUENCE]
  v_full_id := v_ride_code || '-' || p_doc_type || '-' || p_completion_year::text || '-' || LPAD(v_seq::text, 4, '0');

  RETURN v_full_id;
END;
$function$;
