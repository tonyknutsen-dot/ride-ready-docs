
-- Seed demo data for the currently logged-in tester account (f18a7425-d2b1-4b28-b3b8-7fd8f12c5697)
DO $$
DECLARE
  v_user uuid := 'f18a7425-d2b1-4b28-b3b8-7fd8f12c5697';
  v_cat1 uuid := 'd1d6acd3-40f7-4f9c-90ac-0c6c6531a467';
  v_cat2 uuid := 'e7a9ad18-45ab-41b0-a0c6-1f7a4c797eff';
  v_cat3 uuid := '4438448c-c36b-4163-b517-f1002be74383';

  r1 uuid;
  r2 uuid;
  r3 uuid;

  t1 uuid;
  t2 uuid;
  t3 uuid;
BEGIN
  -- Rides (avoid duplicates by name)
  INSERT INTO public.rides (user_id, ride_name, category_id, manufacturer, serial_number, year_manufactured, is_test_data)
  SELECT v_user, 'Ferris Wheel Demo', v_cat1, 'Demo Manufacturer', 'SN-DEMO-101', 2020, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.rides WHERE user_id = v_user AND ride_name = 'Ferris Wheel Demo'
  );

  INSERT INTO public.rides (user_id, ride_name, category_id, manufacturer, serial_number, year_manufactured, is_test_data)
  SELECT v_user, 'Carousel Test Unit', v_cat2, 'Test Rides Ltd', 'SN-DEMO-102', 2019, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.rides WHERE user_id = v_user AND ride_name = 'Carousel Test Unit'
  );

  INSERT INTO public.rides (user_id, ride_name, category_id, manufacturer, serial_number, year_manufactured, is_test_data)
  SELECT v_user, 'Roller Coaster Sample', v_cat3, 'Sample Corp', 'SN-DEMO-103', 2021, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.rides WHERE user_id = v_user AND ride_name = 'Roller Coaster Sample'
  );

  SELECT id INTO r1 FROM public.rides WHERE user_id = v_user AND ride_name = 'Ferris Wheel Demo' LIMIT 1;
  SELECT id INTO r2 FROM public.rides WHERE user_id = v_user AND ride_name = 'Carousel Test Unit' LIMIT 1;
  SELECT id INTO r3 FROM public.rides WHERE user_id = v_user AND ride_name = 'Roller Coaster Sample' LIMIT 1;

  -- Documents (avoid duplicates by name)
  INSERT INTO public.documents (user_id, document_name, document_type, file_path, is_test_data, notes, uploaded_at)
  SELECT v_user, 'Safety Certificate 2026', 'safety_certificate', 'demo/safety-cert-demo.pdf', true, 'Demo safety certificate', now() - interval '5 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.documents WHERE user_id = v_user AND document_name = 'Safety Certificate 2026'
  );

  INSERT INTO public.documents (user_id, document_name, document_type, file_path, is_test_data, notes, uploaded_at)
  SELECT v_user, 'Insurance Policy', 'insurance', 'demo/insurance-demo.pdf', true, 'Demo insurance document', now() - interval '10 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.documents WHERE user_id = v_user AND document_name = 'Insurance Policy'
  );

  INSERT INTO public.documents (user_id, document_name, document_type, file_path, is_test_data, notes, uploaded_at)
  SELECT v_user, 'DOC Certificate', 'doc_certificate', 'demo/doc-cert-demo.pdf', true, 'Demo DOC certificate', now() - interval '3 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.documents WHERE user_id = v_user AND document_name = 'DOC Certificate'
  );

  INSERT INTO public.documents (user_id, document_name, document_type, file_path, is_test_data, notes, uploaded_at)
  SELECT v_user, 'Operating Manual', 'manual', 'demo/manual-demo.pdf', true, 'Demo operating manual', now() - interval '15 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.documents WHERE user_id = v_user AND document_name = 'Operating Manual'
  );

  -- Check templates
  INSERT INTO public.daily_check_templates (user_id, ride_id, template_name, check_frequency, is_active, is_archived)
  SELECT v_user, r1, 'Ferris Wheel Daily Check', 'daily', true, false
  WHERE r1 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.daily_check_templates WHERE user_id = v_user AND template_name = 'Ferris Wheel Daily Check'
  );

  INSERT INTO public.daily_check_templates (user_id, ride_id, template_name, check_frequency, is_active, is_archived)
  SELECT v_user, r2, 'Carousel Daily Check', 'daily', true, false
  WHERE r2 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.daily_check_templates WHERE user_id = v_user AND template_name = 'Carousel Daily Check'
  );

  INSERT INTO public.daily_check_templates (user_id, ride_id, template_name, check_frequency, is_active, is_archived)
  SELECT v_user, r3, 'Roller Coaster Weekly Check', 'weekly', true, false
  WHERE r3 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.daily_check_templates WHERE user_id = v_user AND template_name = 'Roller Coaster Weekly Check'
  );

  SELECT id INTO t1 FROM public.daily_check_templates WHERE user_id = v_user AND template_name = 'Ferris Wheel Daily Check' LIMIT 1;
  SELECT id INTO t2 FROM public.daily_check_templates WHERE user_id = v_user AND template_name = 'Carousel Daily Check' LIMIT 1;
  SELECT id INTO t3 FROM public.daily_check_templates WHERE user_id = v_user AND template_name = 'Roller Coaster Weekly Check' LIMIT 1;

  -- Checks (so Overview shows "recent checks")
  INSERT INTO public.checks (user_id, ride_id, template_id, inspector_name, check_date, check_frequency, status, is_test_data)
  SELECT v_user, r1, t1, 'Demo Inspector', (now() - interval '2 days')::date, 'daily', 'completed', true
  WHERE r1 IS NOT NULL AND t1 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.checks WHERE user_id = v_user AND ride_id = r1 AND check_date = (now() - interval '2 days')::date
  );

  INSERT INTO public.checks (user_id, ride_id, template_id, inspector_name, check_date, check_frequency, status, is_test_data)
  SELECT v_user, r2, t2, 'Demo Inspector', (now() - interval '6 days')::date, 'daily', 'completed', true
  WHERE r2 IS NOT NULL AND t2 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.checks WHERE user_id = v_user AND ride_id = r2 AND check_date = (now() - interval '6 days')::date
  );

  -- Maintenance
  INSERT INTO public.maintenance_records (user_id, ride_id, maintenance_date, maintenance_type, description, performed_by, is_test_data)
  SELECT v_user, r1, (now() - interval '7 days')::date, 'Routine Inspection', 'Regular weekly maintenance check completed', 'Demo Technician', true
  WHERE r1 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_records WHERE user_id = v_user AND ride_id = r1 AND maintenance_type = 'Routine Inspection'
  );

  INSERT INTO public.maintenance_records (user_id, ride_id, maintenance_date, maintenance_type, description, performed_by, is_test_data)
  SELECT v_user, r2, (now() - interval '14 days')::date, 'Lubrication', 'Lubricated all bearings and pivot points', 'Demo Engineer', true
  WHERE r2 IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.maintenance_records WHERE user_id = v_user AND ride_id = r2 AND maintenance_type = 'Lubrication'
  );

END $$;
