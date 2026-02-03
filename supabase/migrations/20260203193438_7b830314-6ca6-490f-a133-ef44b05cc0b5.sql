
-- Assign demo documents to demo rides for user f18a7425-d2b1-4b28-b3b8-7fd8f12c5697
-- Link Safety Certificate to Ferris Wheel Demo
UPDATE public.documents 
SET ride_id = '9d9a2d84-c606-48b8-be56-0a3caaa29dbc'
WHERE id = 'd47db85b-2244-4ba2-8b2e-b8bc9e09bd79' 
  AND user_id = 'f18a7425-d2b1-4b28-b3b8-7fd8f12c5697';

-- Link Insurance Policy to Carousel Test Unit
UPDATE public.documents 
SET ride_id = '260d81b1-82ae-47f4-a08d-faa4b47c7a58'
WHERE id = '35c2b092-d9b8-474c-84ca-c3daa47e50b6'
  AND user_id = 'f18a7425-d2b1-4b28-b3b8-7fd8f12c5697';

-- Link DOC Certificate to Roller Coaster Sample  
UPDATE public.documents 
SET ride_id = '8e08b2bc-036b-45dd-a189-e615b0f138d7'
WHERE id = '7907f7df-6aa5-49b5-bf2f-0053d517f855'
  AND user_id = 'f18a7425-d2b1-4b28-b3b8-7fd8f12c5697';

-- Keep Operating Manual as a global document (is_global = true)
UPDATE public.documents 
SET is_global = true
WHERE id = '6463262f-6067-49c5-8506-02035cc45b80'
  AND user_id = 'f18a7425-d2b1-4b28-b3b8-7fd8f12c5697';

-- Create sample check record PDFs that will show in Send Documents
INSERT INTO public.documents (user_id, ride_id, document_name, document_type, file_path, is_test_data, notes, uploaded_at)
VALUES 
  ('f18a7425-d2b1-4b28-b3b8-7fd8f12c5697', '9d9a2d84-c606-48b8-be56-0a3caaa29dbc', 
   'Daily Check - Ferris Wheel Demo - 01 Feb 2026', 'check_record', 
   'check-records/demo-check-1.pdf', true, 'Exported safety check record', now() - interval '2 days'),
  ('f18a7425-d2b1-4b28-b3b8-7fd8f12c5697', '260d81b1-82ae-47f4-a08d-faa4b47c7a58', 
   'Daily Check - Carousel Test Unit - 28 Jan 2026', 'check_record', 
   'check-records/demo-check-2.pdf', true, 'Exported safety check record', now() - interval '6 days')
ON CONFLICT DO NOTHING;
