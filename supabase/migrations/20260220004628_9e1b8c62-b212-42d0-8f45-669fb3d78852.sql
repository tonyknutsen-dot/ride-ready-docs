
-- Function to generate a unique ride_code from ride_name
CREATE OR REPLACE FUNCTION public.generate_ride_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
  v_base text;
  v_suffix integer := 2;
  v_exists boolean;
  v_words text[];
  v_filler text[] := ARRAY['the','and','of','a','an','in','on','at','to','for','is','it'];
BEGIN
  -- Only generate if ride_code is not already set
  IF NEW.ride_code IS NOT NULL AND NEW.ride_code <> '' THEN
    RETURN NEW;
  END IF;

  -- Split name into words, filter filler words, take first letter of each
  SELECT array_agg(LEFT(w, 1))
  INTO v_words
  FROM unnest(string_to_array(NEW.ride_name, ' ')) AS w
  WHERE w <> '' AND LOWER(w) != ALL(v_filler);

  v_base := UPPER(LEFT(array_to_string(COALESCE(v_words, ARRAY[LEFT(NEW.ride_name, 1)]), ''), 4));

  IF v_base = '' THEN
    v_base := 'X';
  END IF;

  -- Check for duplicates
  v_code := v_base;
  LOOP
    SELECT EXISTS(SELECT 1 FROM public.rides WHERE ride_code = v_code AND id <> NEW.id) INTO v_exists;
    EXIT WHEN NOT v_exists;
    v_code := LEFT(v_base, 3) || v_suffix::text;
    v_suffix := v_suffix + 1;
  END LOOP;

  NEW.ride_code := v_code;
  RETURN NEW;
END;
$function$;

-- Trigger: only on INSERT (don't regenerate on name change)
DROP TRIGGER IF EXISTS trg_generate_ride_code ON public.rides;
CREATE TRIGGER trg_generate_ride_code
  BEFORE INSERT ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_ride_code();
