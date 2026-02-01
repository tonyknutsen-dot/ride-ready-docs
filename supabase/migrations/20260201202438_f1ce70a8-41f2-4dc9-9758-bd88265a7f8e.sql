-- Drop the existing restrictive policy for viewing documents
DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;

-- Create a new policy that allows:
-- 1. Users to view their own documents (folder matches their user_id)
-- 2. Staff members to view documents belonging to their organisation owner
CREATE POLICY "Users can view their own documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'ride-documents' 
  AND (
    -- Owner can view their own documents
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    -- Staff can view documents belonging to their organisation owner
    EXISTS (
      SELECT 1 FROM public.organisation_members om
      JOIN public.organisations o ON o.id = om.organisation_id
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND o.owner_id::text = (storage.foldername(name))[1]
    )
  )
);

-- Also update defect-photos policy for staff access
DROP POLICY IF EXISTS "Users can view their own defect photos" ON storage.objects;

CREATE POLICY "Users can view their own defect photos" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'defect-photos' 
  AND (
    -- Owner can view their own photos
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    -- Staff can view photos belonging to their organisation owner
    EXISTS (
      SELECT 1 FROM public.organisation_members om
      JOIN public.organisations o ON o.id = om.organisation_id
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND o.owner_id::text = (storage.foldername(name))[1]
    )
  )
);