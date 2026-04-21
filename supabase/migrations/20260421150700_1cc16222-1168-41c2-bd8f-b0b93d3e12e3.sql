-- Pass 1A: Library kind column + defect→notification trigger (severity values: non_urgent | urgent | stop_operation)

ALTER TABLE public.check_library_items
  ADD COLUMN IF NOT EXISTS item_kind text NOT NULL DEFAULT 'operational';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_library_items_item_kind_chk'
  ) THEN
    ALTER TABLE public.check_library_items
      ADD CONSTRAINT check_library_items_item_kind_chk
      CHECK (item_kind IN ('operational', 'compliance', 'document'));
  END IF;
END$$;

UPDATE public.check_library_items
SET item_kind = 'compliance'
WHERE category = 'Compliance'
   OR label ILIKE '%insurance%'
   OR label ILIKE '%risk assessment%annual review%'
   OR label ILIKE '%documentation audit%'
   OR label ILIKE '%gas safety certificate%'
   OR label ILIKE '%RPII%'
   OR label ILIKE '%ADIPS%'
   OR label ILIKE '%PIPA%';

CREATE INDEX IF NOT EXISTS idx_check_library_items_kind_freq
  ON public.check_library_items (item_kind, frequency, equipment_group)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.notify_on_defect_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ride_name text;
  v_title text;
  v_message text;
  v_type text;
  v_summary text;
BEGIN
  IF NEW.status = 'resolved' THEN
    UPDATE public.notifications
       SET is_read = true
     WHERE related_table = 'defects'
       AND related_id = NEW.id
       AND is_read = false;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.severity = OLD.severity
     AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT ride_name INTO v_ride_name FROM public.rides WHERE id = NEW.ride_id;
  v_summary := left(coalesce(split_part(NEW.description, '.', 1), ''), 80);

  IF NEW.severity = 'stop_operation' THEN
    v_title := 'Stop Use: ' || coalesce(v_ride_name, 'equipment');
    v_type := 'error';
  ELSIF NEW.severity = 'urgent' THEN
    v_title := 'Repair needed: ' || coalesce(v_ride_name, 'equipment');
    v_type := 'warning';
  ELSE
    v_title := 'Open defect: ' || coalesce(v_ride_name, 'equipment');
    v_type := 'info';
  END IF;

  v_message := v_summary || '. Reported just now.';

  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
     WHERE user_id = NEW.user_id
       AND related_table = 'defects'
       AND related_id = NEW.id
       AND is_read = false
  ) THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
    VALUES (NEW.user_id, v_title, v_message, v_type, 'defects', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_defect_change ON public.defects;
CREATE TRIGGER trg_notify_on_defect_change
AFTER INSERT OR UPDATE OF severity, status ON public.defects
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_defect_change();

INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
SELECT
  d.user_id,
  CASE
    WHEN d.severity = 'stop_operation' THEN 'Stop Use: ' || coalesce(r.ride_name, 'equipment')
    WHEN d.severity = 'urgent' THEN 'Repair needed: ' || coalesce(r.ride_name, 'equipment')
    ELSE 'Open defect: ' || coalesce(r.ride_name, 'equipment')
  END,
  left(coalesce(split_part(d.description, '.', 1), ''), 80) || '.',
  CASE
    WHEN d.severity = 'stop_operation' THEN 'error'
    WHEN d.severity = 'urgent' THEN 'warning'
    ELSE 'info'
  END,
  'defects',
  d.id
FROM public.defects d
LEFT JOIN public.rides r ON r.id = d.ride_id
WHERE d.status != 'resolved'
  AND d.is_test_data = false
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.related_table = 'defects' AND n.related_id = d.id AND n.is_read = false
  );