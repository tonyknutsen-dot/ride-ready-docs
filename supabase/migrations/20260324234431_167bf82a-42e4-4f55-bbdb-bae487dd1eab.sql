-- Fix 1: Update has_role() to enforce expires_at check
-- Expired roles should no longer grant elevated privileges
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Fix 2: Update is_tester() to also enforce expires_at check
CREATE OR REPLACE FUNCTION public.is_tester(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'tester'
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Fix 3: Add RLS protection directly on profiles_safe view
-- The view already uses security_invoker=true, but adding explicit RLS
-- provides defense-in-depth
ALTER VIEW public.profiles_safe SET (security_barrier = true);
