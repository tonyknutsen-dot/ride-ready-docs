
-- Update complete_event to calculate next due from completion date instead of original due_date
CREATE OR REPLACE FUNCTION public.complete_event(
  p_event_id uuid,
  p_completion_date date DEFAULT CURRENT_DATE,
  p_completion_notes text DEFAULT NULL,
  p_evidence_urls text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event RECORD;
  v_new_event_id uuid;
  v_next_due date;
  v_interval_unit text;
  v_interval_value int;
  v_parts text[];
  v_result jsonb;
BEGIN
  SELECT * INTO v_event
  FROM public.compliance_events
  WHERE id = p_event_id
    AND (user_id = auth.uid() OR staff_can_access_ride(auth.uid(), ride_id));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found or access denied';
  END IF;

  IF v_event.status = 'completed' THEN
    RAISE EXCEPTION 'Event is already completed';
  END IF;

  UPDATE public.compliance_events
  SET status = 'completed',
      completed_at = now(),
      completed_by = auth.uid(),
      completion_notes = p_completion_notes,
      evidence_urls = CASE WHEN array_length(p_evidence_urls, 1) > 0 THEN p_evidence_urls ELSE evidence_urls END
  WHERE id = p_event_id;

  v_result := jsonb_build_object(
    'completed_event_id', p_event_id,
    'created_next', false
  );

  IF v_event.is_recurring = true 
     AND v_event.recurrence_rule IS NOT NULL 
     AND v_event.auto_create_next = true THEN
    
    v_parts := string_to_array(v_event.recurrence_rule, ':');
    IF array_length(v_parts, 1) = 2 THEN
      v_interval_unit := v_parts[1];
      v_interval_value := v_parts[2]::int;

      -- Calculate next due date from COMPLETION DATE (not original due_date)
      CASE v_interval_unit
        WHEN 'days' THEN v_next_due := p_completion_date + (v_interval_value || ' days')::interval;
        WHEN 'weeks' THEN v_next_due := p_completion_date + (v_interval_value * 7 || ' days')::interval;
        WHEN 'months' THEN v_next_due := p_completion_date + (v_interval_value || ' months')::interval;
        WHEN 'years' THEN v_next_due := p_completion_date + (v_interval_value || ' years')::interval;
        ELSE v_next_due := NULL;
      END CASE;

      IF v_next_due IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.compliance_events
          WHERE series_id = v_event.series_id
            AND due_date = v_next_due
            AND status != 'cancelled'
        ) THEN
          INSERT INTO public.compliance_events (
            user_id, ride_id, category, event_type, event_name, due_date,
            status, notes, is_recurring, recurrence_rule, recurrence_anchor_date,
            series_id, auto_create_next, reminder_days, reminder_enabled,
            advance_notice_days, source_event_id
          ) VALUES (
            v_event.user_id, v_event.ride_id, v_event.category, v_event.event_type,
            v_event.event_name, v_next_due, 'open', v_event.notes,
            true, v_event.recurrence_rule, v_event.recurrence_anchor_date,
            v_event.series_id, v_event.auto_create_next, v_event.reminder_days,
            v_event.reminder_enabled, v_event.advance_notice_days, p_event_id
          ) RETURNING id INTO v_new_event_id;

          UPDATE public.compliance_events
          SET next_event_id = v_new_event_id
          WHERE id = p_event_id;

          v_result := jsonb_build_object(
            'completed_event_id', p_event_id,
            'created_next', true,
            'next_event_id', v_new_event_id,
            'next_due_date', v_next_due
          );
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN v_result;
END;
$function$;
