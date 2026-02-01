-- Fix staff access condition in storage SELECT policies (bug was referencing storage.foldername(o.name))

ALTER POLICY "Users can view their own documents"
ON storage.objects
USING (
  bucket_id = 'ride-documents'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.organisation_members om
      JOIN public.organisations o ON o.id = om.organisation_id
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND o.owner_id::text = (storage.foldername(name))[1]
    )
  )
);

ALTER POLICY "Users can view their own defect photos"
ON storage.objects
USING (
  bucket_id = 'defect-photos'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.organisation_members om
      JOIN public.organisations o ON o.id = om.organisation_id
      WHERE om.user_id = auth.uid()
        AND om.is_active = true
        AND o.owner_id::text = (storage.foldername(name))[1]
    )
  )
);