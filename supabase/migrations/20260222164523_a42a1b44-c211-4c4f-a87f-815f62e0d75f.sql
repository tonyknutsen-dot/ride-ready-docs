
-- Fix SECURITY DEFINER view by explicitly setting SECURITY INVOKER
-- This ensures the view respects the querying user's RLS policies
CREATE OR REPLACE VIEW public.timeline_events
WITH (security_invoker = true) AS

-- 1. Operational Checks
SELECT
  c.created_at AS event_datetime,
  c.ride_id,
  r.ride_name,
  r.ride_code,
  'CHECK' AS event_type,
  COALESCE(t.template_name, 'Operational Check') AS title,
  c.check_frequency || ' check — ' || COALESCE(c.status, 'unknown') AS description,
  c.id AS reference_id,
  c.inspector_name AS created_by_name,
  CASE 
    WHEN c.status = 'completed' THEN 'Passed'
    WHEN c.status = 'failed' THEN 'Failed'
    ELSE c.status
  END AS status,
  NULL::text AS pdf_url,
  c.user_id
FROM checks c
JOIN rides r ON r.id = c.ride_id
LEFT JOIN daily_check_templates t ON t.id = c.template_id
WHERE c.is_test_data = false

UNION ALL

-- 2. Defects
SELECT
  d.reported_at AS event_datetime,
  d.ride_id,
  r.ride_name,
  r.ride_code,
  'DEFECT' AS event_type,
  'Defect: ' || LEFT(d.description, 80) AS title,
  d.severity::text || ' — ' || d.status::text AS description,
  d.id AS reference_id,
  NULL AS created_by_name,
  CASE
    WHEN d.status = 'resolved' THEN 'Resolved'
    WHEN d.status = 'open' THEN 'Open'
    ELSE d.status::text
  END AS status,
  NULL::text AS pdf_url,
  d.user_id
FROM defects d
JOIN rides r ON r.id = d.ride_id
WHERE d.is_test_data = false

UNION ALL

-- 3. Maintenance Records
SELECT
  m.created_at AS event_datetime,
  m.ride_id,
  r.ride_name,
  r.ride_code,
  'MAINTENANCE' AS event_type,
  m.maintenance_type || ': ' || LEFT(m.description, 60) AS title,
  COALESCE('By ' || m.performed_by, 'Maintenance logged') AS description,
  m.id AS reference_id,
  m.performed_by AS created_by_name,
  'Logged' AS status,
  NULL::text AS pdf_url,
  m.user_id
FROM maintenance_records m
JOIN rides r ON r.id = m.ride_id
WHERE m.is_test_data = false

UNION ALL

-- 4. Compliance Events
SELECT
  COALESCE(ce.completed_at, ce.created_at) AS event_datetime,
  ce.ride_id,
  COALESCE(r.ride_name, 'Global') AS ride_name,
  COALESCE(r.ride_code, '—') AS ride_code,
  'COMPLIANCE' AS event_type,
  ce.event_name AS title,
  ce.event_type || ' — ' || ce.status AS description,
  ce.id AS reference_id,
  ce.completed_by_name AS created_by_name,
  CASE
    WHEN ce.status = 'completed' THEN 'Completed'
    WHEN ce.status = 'scheduled' THEN 'Scheduled'
    WHEN ce.status = 'overdue' THEN 'Overdue'
    ELSE ce.status
  END AS status,
  NULL::text AS pdf_url,
  ce.user_id
FROM compliance_events ce
LEFT JOIN rides r ON r.id = ce.ride_id

UNION ALL

-- 5. Inspection Record Amendments
SELECT
  ir.created_at AS event_datetime,
  ir.ride_id,
  r.ride_name,
  r.ride_code,
  'AMENDMENT' AS event_type,
  'Amendment v' || ir.version || ': ' || COALESCE(ir.template_name, 'Check Record') AS title,
  COALESCE(ir.amendment_reason, 'Record created') AS description,
  ir.id AS reference_id,
  ir.inspector_name AS created_by_name,
  CASE
    WHEN ir.superseded_by_id IS NOT NULL THEN 'Superseded'
    ELSE 'Active'
  END AS status,
  ir.pdf_file_path AS pdf_url,
  ir.user_id
FROM inspection_records ir
JOIN rides r ON r.id = ir.ride_id
WHERE ir.version > 1 OR ir.superseded_by_id IS NOT NULL;
