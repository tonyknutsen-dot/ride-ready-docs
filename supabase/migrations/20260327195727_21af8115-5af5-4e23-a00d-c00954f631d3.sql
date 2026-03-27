-- Add structured audit columns for richer event payloads
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS before_data jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS after_data jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS changed_fields text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS organisation_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS equipment_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS equipment_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS result text DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS context_hint text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reason text DEFAULT NULL;

-- Update the log_audit_event RPC to support new fields
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_resource_type text,
  p_resource_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_before_data jsonb DEFAULT NULL,
  p_after_data jsonb DEFAULT NULL,
  p_changed_fields text[] DEFAULT NULL,
  p_organisation_name text DEFAULT NULL,
  p_equipment_id uuid DEFAULT NULL,
  p_equipment_name text DEFAULT NULL,
  p_result text DEFAULT 'success',
  p_context_hint text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id, action, resource_type, resource_id, details,
    before_data, after_data, changed_fields,
    organisation_name, equipment_id, equipment_name,
    result, context_hint, reason
  )
  VALUES (
    auth.uid(), p_action, p_resource_type, p_resource_id, p_details,
    p_before_data, p_after_data, p_changed_fields,
    p_organisation_name, p_equipment_id, p_equipment_name,
    p_result, p_context_hint, p_reason
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;