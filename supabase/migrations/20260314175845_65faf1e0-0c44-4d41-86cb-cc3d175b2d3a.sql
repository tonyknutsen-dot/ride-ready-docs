-- ride-documents: add subscription check to INSERT policy
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'ride-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND public.subscription_allows_writes(auth.uid())
);

-- defect-photos: add subscription check to INSERT policy
DROP POLICY IF EXISTS "Users can upload defect photos to their folder" ON storage.objects;
CREATE POLICY "Users can upload defect photos to their folder"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'defect-photos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND public.subscription_allows_writes(auth.uid())
);

-- bug-attachments: add subscription check to INSERT policy
DROP POLICY IF EXISTS "Users can upload bug attachments" ON storage.objects;
CREATE POLICY "Users can upload bug attachments"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'bug-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND public.subscription_allows_writes(auth.uid())
);