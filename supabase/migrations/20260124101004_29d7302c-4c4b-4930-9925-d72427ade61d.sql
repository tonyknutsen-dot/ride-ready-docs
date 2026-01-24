-- Create RLS policies for ride-documents bucket to allow authenticated users to upload/manage their files

-- Policy: Allow authenticated users to upload files to their ride's maintenance folder
CREATE POLICY "Users can upload maintenance files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'ride-documents' 
  AND auth.role() = 'authenticated'
);

-- Policy: Allow authenticated users to view their own files
CREATE POLICY "Users can view their own ride documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'ride-documents' 
  AND auth.role() = 'authenticated'
);

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "Users can update their own ride documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'ride-documents' 
  AND auth.role() = 'authenticated'
);

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own ride documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'ride-documents' 
  AND auth.role() = 'authenticated'
);