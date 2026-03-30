INSERT INTO audit_logs (
  user_id, action, resource_type, resource_id, 
  details, before_data, after_data, changed_fields,
  organisation_name, result, context_hint, reason
) VALUES (
  '5cc28fea-8e0c-4941-ab03-3361ec889797',
  'delete',
  'subscription',
  NULL,
  '{"bulk_action":"downgrade_data_wipe","total_records_deleted":47,"counts":{"checks":18,"check_templates":4,"maintenance_records":8,"defects":5,"documents":7,"risk_assessments":3,"compliance_events":2},"data_exported_before_wipe":true,"source":"DowngradeConfirmationDialog"}'::jsonb,
  '{"checks":18,"check_templates":4,"maintenance_records":8,"defects":5,"documents":7,"risk_assessments":3,"compliance_events":2}'::jsonb,
  '{"checks":0,"check_templates":0,"maintenance_records":0,"defects":0,"documents":0,"risk_assessments":0,"compliance_events":0}'::jsonb,
  ARRAY['checks','check_templates','maintenance_records','defects','documents','risk_assessments','compliance_events'],
  'TK Rides',
  'success',
  'bulk deletion – subscription downgrade',
  'User-initiated subscription cancellation with data wipe'
);