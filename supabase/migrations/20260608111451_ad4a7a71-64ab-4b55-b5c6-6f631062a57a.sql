
UPDATE public.documents
SET preview_status = NULL,
    preview_failure_reason = NULL,
    preview_generated_at = NULL
WHERE preview_status = 'failed'
  AND preview_failure_reason LIKE 'upload_failed:Bucket not found%';
