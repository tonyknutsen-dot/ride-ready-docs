
DROP POLICY IF EXISTS "document-previews: owner read" ON storage.objects;
DROP POLICY IF EXISTS "document-previews: admin read" ON storage.objects;

CREATE POLICY "document-previews: owner read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'document-previews'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "document-previews: admin read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'document-previews'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
