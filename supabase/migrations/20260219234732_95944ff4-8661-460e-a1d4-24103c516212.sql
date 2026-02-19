
-- =============================================================
-- Create unified compliance_events table
-- =============================================================
CREATE TABLE public.compliance_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  ride_id uuid REFERENCES public.rides(id) ON DELETE CASCADE,
  category text NOT NULL, -- inspection | maintenance | doc_expiry | ndt
  event_type text NOT NULL, -- e.g. "electrical", "insurance-expiry", "preventive"
  event_name text NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled | completed | cancelled
  completed_at timestamptz,
  completed_by uuid,
  notes text,

  -- Recurrence fields
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_rule text, -- e.g. "months:12" or "years:1"
  recurrence_anchor_date date,
  recurrence_end_date date,
  series_id uuid,
  auto_create_next boolean NOT NULL DEFAULT true,

  -- Reminder fields
  reminder_days jsonb DEFAULT '[]'::jsonb, -- e.g. [90,60,30,14,7,3,1]
  reminder_enabled boolean NOT NULL DEFAULT true,

  -- Metadata
  advance_notice_days integer NOT NULL DEFAULT 30,
  source_table text, -- original table name for migrated records
  source_id uuid,   -- original record id for migrated records
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.compliance_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Deny anonymous access to compliance_events"
  ON public.compliance_events FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Owners can manage their compliance events"
  ON public.compliance_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can view compliance events for assigned rides"
  ON public.compliance_events FOR SELECT
  USING (
    ride_id IS NOT NULL AND staff_can_access_ride(auth.uid(), ride_id)
  );

CREATE POLICY "Staff can update compliance events for assigned rides"
  ON public.compliance_events FOR UPDATE
  USING (
    ride_id IS NOT NULL AND staff_can_access_ride(auth.uid(), ride_id)
  );

-- Performance indexes
CREATE INDEX idx_compliance_events_user_due_status 
  ON public.compliance_events (user_id, due_date, status);

CREATE INDEX idx_compliance_events_ride_due_status 
  ON public.compliance_events (ride_id, due_date, status);

CREATE INDEX idx_compliance_events_series 
  ON public.compliance_events (series_id) WHERE series_id IS NOT NULL;

-- Updated at trigger
CREATE TRIGGER update_compliance_events_updated_at
  BEFORE UPDATE ON public.compliance_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- Migrate existing data into compliance_events
-- =============================================================

-- 1. Migrate inspection_schedules
INSERT INTO public.compliance_events (
  user_id, ride_id, category, event_type, event_name, due_date, status,
  notes, advance_notice_days, is_recurring, recurrence_rule, 
  recurrence_anchor_date, series_id, source_table, source_id
)
SELECT
  is2.user_id,
  is2.ride_id,
  'inspection',
  is2.inspection_type,
  is2.inspection_name,
  is2.due_date,
  CASE WHEN is2.is_active = false THEN 'cancelled' ELSE 'scheduled' END,
  is2.notes,
  is2.advance_notice_days,
  CASE WHEN is2.schedule_type LIKE 'recurring%' THEN true ELSE false END,
  CASE 
    WHEN is2.notes LIKE '%[Recurring: every 1 year%' THEN 'years:1'
    WHEN is2.notes LIKE '%[Recurring: every 12 months%' THEN 'months:12'
    WHEN is2.notes LIKE '%[Recurring: every 6 months%' THEN 'months:6'
    WHEN is2.notes LIKE '%[Recurring: every 3 months%' THEN 'months:3'
    WHEN is2.notes LIKE '%[Recurring: every 1 month%' THEN 'months:1'
    ELSE NULL
  END,
  is2.due_date, -- anchor to original due date
  gen_random_uuid(), -- each gets a unique series_id
  'inspection_schedules',
  is2.id
FROM public.inspection_schedules is2
WHERE is2.is_active = true;

-- 2. Migrate ndt_schedules
INSERT INTO public.compliance_events (
  user_id, ride_id, category, event_type, event_name, due_date, status,
  notes, advance_notice_days, is_recurring, recurrence_rule,
  recurrence_anchor_date, series_id, source_table, source_id
)
SELECT
  ns.user_id,
  ns.ride_id,
  'ndt',
  ns.ndt_method,
  ns.schedule_name,
  COALESCE(ns.next_inspection_due, CURRENT_DATE),
  CASE WHEN ns.is_active = false THEN 'cancelled' ELSE 'scheduled' END,
  ns.notes,
  30,
  true,
  'months:' || ns.frequency_months::text,
  COALESCE(ns.next_inspection_due, CURRENT_DATE),
  gen_random_uuid(),
  'ndt_schedules',
  ns.id
FROM public.ndt_schedules ns
WHERE ns.is_active = true AND ns.next_inspection_due IS NOT NULL;

-- 3. Migrate maintenance_records (only those with next_maintenance_due)
INSERT INTO public.compliance_events (
  user_id, ride_id, category, event_type, event_name, due_date, status,
  notes, advance_notice_days, source_table, source_id
)
SELECT
  mr.user_id,
  mr.ride_id,
  'maintenance',
  mr.maintenance_type,
  mr.description,
  mr.next_maintenance_due,
  'scheduled',
  mr.notes,
  14,
  'maintenance_records',
  mr.id
FROM public.maintenance_records mr
WHERE mr.next_maintenance_due IS NOT NULL;

-- 4. Migrate documents with expiry dates
INSERT INTO public.compliance_events (
  user_id, ride_id, category, event_type, event_name, due_date, status,
  notes, advance_notice_days, reminder_days, source_table, source_id
)
SELECT
  d.user_id,
  d.ride_id,
  'doc_expiry',
  d.document_type,
  d.document_name || ' Expiry',
  d.expires_at,
  CASE WHEN d.expires_at < CURRENT_DATE THEN 'scheduled' ELSE 'scheduled' END,
  d.notes,
  60,
  '[60,30,14,7,1]'::jsonb,
  'documents',
  d.id
FROM public.documents d
WHERE d.expires_at IS NOT NULL 
  AND d.is_latest_version = true;

-- =============================================================
-- complete_event RPC function
-- =============================================================
CREATE OR REPLACE FUNCTION public.complete_event(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event RECORD;
  v_new_event_id uuid;
  v_next_due date;
  v_interval_unit text;
  v_interval_value int;
  v_parts text[];
  v_result jsonb;
BEGIN
  -- Get the event and verify ownership
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

  -- Mark as completed
  UPDATE public.compliance_events
  SET status = 'completed',
      completed_at = now(),
      completed_by = auth.uid()
  WHERE id = p_event_id;

  v_result := jsonb_build_object(
    'completed_event_id', p_event_id,
    'created_next', false
  );

  -- If recurring, create next occurrence
  IF v_event.is_recurring = true 
     AND v_event.recurrence_rule IS NOT NULL 
     AND v_event.auto_create_next = true THEN
    
    -- Parse recurrence_rule (format: "unit:value" e.g. "months:12")
    v_parts := string_to_array(v_event.recurrence_rule, ':');
    IF array_length(v_parts, 1) = 2 THEN
      v_interval_unit := v_parts[1];
      v_interval_value := v_parts[2]::int;

      -- Calculate next due date from current due_date (not today, to prevent drift)
      CASE v_interval_unit
        WHEN 'days' THEN v_next_due := v_event.due_date + (v_interval_value || ' days')::interval;
        WHEN 'weeks' THEN v_next_due := v_event.due_date + (v_interval_value * 7 || ' days')::interval;
        WHEN 'months' THEN v_next_due := v_event.due_date + (v_interval_value || ' months')::interval;
        WHEN 'years' THEN v_next_due := v_event.due_date + (v_interval_value || ' years')::interval;
        ELSE v_next_due := NULL;
      END CASE;

      IF v_next_due IS NOT NULL THEN
        -- Check for duplicate (same series + same due date)
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
            advance_notice_days
          ) VALUES (
            v_event.user_id, v_event.ride_id, v_event.category, v_event.event_type,
            v_event.event_name, v_next_due, 'scheduled', v_event.notes,
            true, v_event.recurrence_rule, v_event.recurrence_anchor_date,
            v_event.series_id, v_event.auto_create_next, v_event.reminder_days,
            v_event.reminder_enabled, v_event.advance_notice_days
          ) RETURNING id INTO v_new_event_id;

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
$$;
