-- Add expiry date to the test safety certificate (warning state - expires in 2 weeks)
UPDATE public.documents 
SET expires_at = (now() + interval '14 days')::date
WHERE user_id = 'f18a7425-d2b1-4b28-b3b8-7fd8f12c5697'
  AND document_type IN ('declaration_of_compliance', 'doc_certificate', 'safety_certificate', 'inspection_certificate')
  AND is_test_data = true;