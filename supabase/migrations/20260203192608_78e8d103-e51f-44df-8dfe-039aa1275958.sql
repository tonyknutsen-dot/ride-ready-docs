
-- Insert sample rides for the tester
INSERT INTO public.rides (user_id, ride_name, category_id, manufacturer, serial_number, year_manufactured, is_test_data)
VALUES 
  ('6a5d9525-43b6-4a83-b512-9cedb4eec19c', 'Ferris Wheel Demo', 'd1d6acd3-40f7-4f9c-90ac-0c6c6531a467', 'Demo Manufacturer', 'SN-DEMO-001', 2020, true),
  ('6a5d9525-43b6-4a83-b512-9cedb4eec19c', 'Carousel Test Unit', 'e7a9ad18-45ab-41b0-a0c6-1f7a4c797eff', 'Test Rides Ltd', 'SN-DEMO-002', 2019, true),
  ('6a5d9525-43b6-4a83-b512-9cedb4eec19c', 'Roller Coaster Sample', '4438448c-c36b-4163-b517-f1002be74383', 'Sample Corp', 'SN-DEMO-003', 2021, true)
ON CONFLICT DO NOTHING;

-- Insert sample documents for the tester
INSERT INTO public.documents (user_id, document_name, document_type, file_path, is_test_data, notes, uploaded_at)
VALUES 
  ('6a5d9525-43b6-4a83-b512-9cedb4eec19c', 'Safety Certificate 2026', 'safety_certificate', 'demo/safety-cert-demo.pdf', true, 'Demo safety certificate', now() - interval '5 days'),
  ('6a5d9525-43b6-4a83-b512-9cedb4eec19c', 'Insurance Policy', 'insurance', 'demo/insurance-demo.pdf', true, 'Demo insurance document', now() - interval '10 days'),
  ('6a5d9525-43b6-4a83-b512-9cedb4eec19c', 'DOC Certificate', 'doc_certificate', 'demo/doc-cert-demo.pdf', true, 'Demo DOC certificate', now() - interval '3 days'),
  ('6a5d9525-43b6-4a83-b512-9cedb4eec19c', 'Operating Manual', 'manual', 'demo/manual-demo.pdf', true, 'Demo operating manual', now() - interval '15 days')
ON CONFLICT DO NOTHING;
