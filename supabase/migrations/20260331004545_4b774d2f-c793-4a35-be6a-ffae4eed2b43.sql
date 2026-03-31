-- Remove profiles table from Realtime publication
-- No application code subscribes to profiles changes via Realtime,
-- and publishing it exposes profile change events to any authenticated user
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;