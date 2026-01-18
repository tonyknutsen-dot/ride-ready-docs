-- ============================================
-- Remove Email Storage from Bug Reports
-- For better privacy - use user_id references only
-- ============================================

-- Drop the user_email column
ALTER TABLE public.bug_reports DROP COLUMN IF EXISTS user_email;