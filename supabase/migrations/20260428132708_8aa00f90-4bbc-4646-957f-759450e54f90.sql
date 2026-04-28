CREATE OR REPLACE FUNCTION public.submit_check_atomic(
  p_user_id uuid,
  p_ride_id uuid,
  p_template_id uuid,
  p_inspector_name text,
  p_check_date date,
  p_check_frequency text,
  p_status text,
  p_notes text DEFAULT NULL,
  p_weather_conditions text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_signature_data text DEFAULT NULL,
  p_compliance_officer text DEFAULT NULL,
  p_environment_notes text DEFAULT NULL,
  p_start_notice_acknowledged boolean DEFAULT false,
  p_start_notice_acknowledged_at timestamptz DEFAULT NULL,
  p_start_notice_acknowledged_by uuid DEFAULT NULL,
  p_start_notice_snapshot text DEFAULT NULL,
  p_finish_notice_acknowledged boolean DEFAULT false,
  p_finish_notice_acknowledged_at timestamptz DEFAULT NULL,
  p_finish_notice_acknowledged_by text DEFAULT NULL,
  p_finish_notice_snapshot text DEFAULT NULL,
  p_results jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_ride_owner_id uuid;
  v_check_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.subscription_allows_writes(v_actor_id) THEN
    RAISE EXCEPTION 'Writes are not allowed for this account';
  END IF;

  SELECT user_id INTO v_ride_owner_id
  FROM public.rides
  WHERE id = p_ride_id;

  IF v_ride_owner_id IS NULL THEN
    RAISE EXCEPTION 'Equipment not found';
  END IF;

  IF p_user_id <> v_ride_owner_id THEN
    RAISE EXCEPTION 'Check owner does not match equipment owner';
  END IF;

  IF v_actor_id <> p_user_id AND NOT public.staff_can_access_ride(v_actor_id, p_ride_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.checks (
    user_id,
    ride_id,
    template_id,
    inspector_name,
    check_date,
    check_frequency,
    status,
    notes,
    weather_conditions,
    location,
    signature_data,
    compliance_officer,
    environment_notes,
    start_notice_acknowledged,
    start_notice_acknowledged_at,
    start_notice_acknowledged_by,
    start_notice_snapshot,
    finish_notice_acknowledged,
    finish_notice_acknowledged_at,
    finish_notice_acknowledged_by,
    finish_notice_snapshot,
    performed_by_user_id
  ) VALUES (
    p_user_id,
    p_ride_id,
    p_template_id,
    p_inspector_name,
    COALESCE(p_check_date, CURRENT_DATE),
    p_check_frequency,
    p_status,
    p_notes,
    p_weather_conditions,
    p_location,
    p_signature_data,
    p_compliance_officer,
    p_environment_notes,
    COALESCE(p_start_notice_acknowledged, false),
    p_start_notice_acknowledged_at,
    p_start_notice_acknowledged_by,
    p_start_notice_snapshot,
    COALESCE(p_finish_notice_acknowledged, false),
    p_finish_notice_acknowledged_at,
    p_finish_notice_acknowledged_by,
    p_finish_notice_snapshot,
    v_actor_id
  )
  RETURNING id INTO v_check_id;

  IF jsonb_typeof(COALESCE(p_results, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Results must be an array';
  END IF;

  INSERT INTO public.check_results (
    check_id,
    template_item_id,
    is_checked,
    result,
    notes
  )
  SELECT
    v_check_id,
    r.template_item_id,
    COALESCE(r.is_checked, false),
    COALESCE(r.result, 'na'),
    NULLIF(r.notes, '')
  FROM jsonb_to_recordset(COALESCE(p_results, '[]'::jsonb)) AS r(
    template_item_id uuid,
    is_checked boolean,
    result text,
    notes text
  );

  RETURN v_check_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_check_atomic(
  uuid, uuid, uuid, text, date, text, text, text, text, text, text, text, text,
  boolean, timestamptz, uuid, text, boolean, timestamptz, text, text, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_check_atomic(
  uuid, uuid, uuid, text, date, text, text, text, text, text, text, text, text,
  boolean, timestamptz, uuid, text, boolean, timestamptz, text, text, jsonb
) TO authenticated;