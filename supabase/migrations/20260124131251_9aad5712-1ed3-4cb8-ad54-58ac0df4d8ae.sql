-- Fix overly permissive storage policies from migration 20260124101004
-- These policies allow any authenticated user to access any file, bypassing user isolation

-- Drop the overly permissive policies that only check auth.role() = 'authenticated'
DROP POLICY IF EXISTS "Users can upload maintenance files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own ride documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own ride documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own ride documents" ON storage.objects;

-- The original user-scoped policies from migration 20250924171207 will remain active:
-- These correctly use: auth.uid()::text = (storage.foldername(name))[1]
-- Which ensures users can only access files in their own folder