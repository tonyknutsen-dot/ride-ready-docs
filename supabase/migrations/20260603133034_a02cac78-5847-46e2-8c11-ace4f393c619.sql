DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'annual_inspection_reports','campaign_recipients','check_results','checks',
    'compliance_events','daily_check_template_items','daily_check_templates','defects',
    'document_share_items','document_shares','document_type_requests','documents',
    'email_campaigns','email_templates','feature_requests','inspection_schedules',
    'maintenance_records','ndt_reports','ndt_schedules','notifications','profiles',
    'ride_daily_status','ride_daily_status_log','ride_documents','ride_operation_days',
    'ride_type_requests','rides','risk_assessment_audit_log','risk_assessment_items',
    'risk_assessments','saved_recipients','support_access_grants','support_messages',
    'user_roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Deny anonymous access to ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO public USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')',
      'Require authenticated access to ' || t, t
    );
  END LOOP;
END $$;