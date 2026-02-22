
-- Backfill inspection_records from existing completed checks
-- This is a one-time migration to populate records for checks completed before the inspection_records table existed

INSERT INTO public.inspection_records (
  check_id, ride_id, user_id, inspector_name, check_date, check_frequency,
  template_id, template_name, notes, weather_conditions, environment_notes,
  compliance_officer, location, signature_data, overall_result,
  version, is_locked, completed_at, item_results, defect_ids
)
SELECT
  c.id AS check_id,
  c.ride_id,
  c.user_id,
  c.inspector_name,
  c.check_date::text,
  c.check_frequency,
  c.template_id,
  t.template_name,
  c.notes,
  c.weather_conditions,
  c.environment_notes,
  c.compliance_officer,
  c.location,
  c.signature_data,
  c.status AS overall_result,
  1 AS version,
  true AS is_locked,
  c.created_at AS completed_at,
  COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'template_item_id', cr.template_item_id,
        'check_item_text', dti.check_item_text,
        'category', COALESCE(dti.category, 'general'),
        'result', COALESCE(cr.result, CASE WHEN cr.is_checked THEN 'pass' ELSE 'fail' END),
        'notes', cr.notes
      ) ORDER BY COALESCE(dti.sort_order, 0)
    )
    FROM check_results cr
    JOIN daily_check_template_items dti ON cr.template_item_id = dti.id
    WHERE cr.check_id = c.id),
    '[]'::jsonb
  ) AS item_results,
  COALESCE(
    ARRAY(SELECT d.id FROM defects d WHERE d.check_id = c.id),
    '{}'::uuid[]
  ) AS defect_ids
FROM checks c
LEFT JOIN daily_check_templates t ON c.template_id = t.id
WHERE c.status IN ('completed', 'passed')
  AND c.ride_id = 'ccc6e97e-3527-4dc1-b356-43a1fc591c59'
  AND NOT EXISTS (
    SELECT 1 FROM inspection_records ir WHERE ir.check_id = c.id AND ir.version = 1
  );
