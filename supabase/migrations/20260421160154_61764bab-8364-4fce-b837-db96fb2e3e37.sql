-- Add optional finish notice configuration to checklist templates.
ALTER TABLE public.daily_check_templates
  ADD COLUMN IF NOT EXISTS finish_notice_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS finish_notice_text text NULL;

-- Capture finish notice acknowledgement on completed checks.
ALTER TABLE public.checks
  ADD COLUMN IF NOT EXISTS finish_notice_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS finish_notice_acknowledged_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS finish_notice_acknowledged_by text NULL,
  ADD COLUMN IF NOT EXISTS finish_notice_snapshot text NULL;

-- One active linked defect per completed check item.
CREATE UNIQUE INDEX IF NOT EXISTS ux_defects_one_open_per_check_item
  ON public.defects (check_id, template_item_id)
  WHERE template_item_id IS NOT NULL AND status <> 'resolved';

-- Ensure defect notification function can be attached safely.
CREATE OR REPLACE FUNCTION public.notify_on_defect_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
     AND NEW.status = OLD.status
     AND NEW.description = OLD.description THEN
    RETURN NEW;
  END IF;

  SELECT ride_name INTO v_ride_name FROM public.rides WHERE id = NEW.ride_id;
  v_summary := left(coalesce(nullif(split_part(NEW.description, '.', 1), ''), 'Defect reported'), 80);

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

  INSERT INTO public.notifications (user_id, title, message, type, related_table, related_id)
  VALUES (NEW.user_id, v_title, v_message, v_type, 'defects', NEW.id)
  ON CONFLICT DO NOTHING;

  UPDATE public.notifications
     SET title = v_title,
         message = v_message,
         type = v_type,
         is_read = false,
         created_at = now()
   WHERE user_id = NEW.user_id
     AND related_table = 'defects'
     AND related_id = NEW.id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_on_defect_change ON public.defects;
CREATE TRIGGER trg_notify_on_defect_change
AFTER INSERT OR UPDATE OF severity, status, description ON public.defects
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_defect_change();