-- Add security_barrier to timeline_events view for defense-in-depth
-- The view already has security_invoker=true so RLS from underlying tables applies
ALTER VIEW public.timeline_events SET (security_barrier = true);