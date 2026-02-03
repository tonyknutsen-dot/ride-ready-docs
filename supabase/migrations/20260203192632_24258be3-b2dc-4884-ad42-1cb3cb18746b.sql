
-- Create check templates for the demo rides
INSERT INTO public.daily_check_templates (user_id, ride_id, template_name, check_frequency, is_active)
VALUES 
  ('6a5d9525-43b6-4a83-b512-9cedb4eec19c', '78d062ea-79f5-440c-ba0c-ebbcb712f92a', 'Ferris Wheel Daily Check', 'daily', true),
  ('6a5d9525-43b6-4a83-b512-9cedb4eec19c', '3ad040f4-efc3-4de8-aadf-73bbe1972899', 'Carousel Daily Check', 'daily', true),
  ('6a5d9525-43b6-4a83-b512-9cedb4eec19c', '44e58b6f-a0b8-4c32-847a-8986088d1171', 'Roller Coaster Weekly Check', 'weekly', true)
ON CONFLICT DO NOTHING;

-- Insert maintenance records for demo rides
INSERT INTO public.maintenance_records (user_id, ride_id, maintenance_date, maintenance_type, description, performed_by, is_test_data)
VALUES 
  ('6a5d9525-43b6-4a83-b512-9cedb4eec19c', '78d062ea-79f5-440c-ba0c-ebbcb712f92a', now() - interval '7 days', 'Routine Inspection', 'Regular weekly maintenance check completed', 'Demo Technician', true),
  ('6a5d9525-43b6-4a83-b512-9cedb4eec19c', '3ad040f4-efc3-4de8-aadf-73bbe1972899', now() - interval '14 days', 'Lubrication', 'Lubricated all bearings and pivot points', 'Demo Engineer', true),
  ('6a5d9525-43b6-4a83-b512-9cedb4eec19c', '44e58b6f-a0b8-4c32-847a-8986088d1171', now() - interval '30 days', 'Safety Inspection', 'Annual safety inspection completed - all systems passed', 'Demo Inspector', true)
ON CONFLICT DO NOTHING;
