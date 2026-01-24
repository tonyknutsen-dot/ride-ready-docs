-- Fix the SECURITY DEFINER view issue by setting SECURITY INVOKER
-- This ensures the view uses the querying user's permissions, not the creator's
ALTER VIEW public.profiles_safe SET (security_invoker = on);