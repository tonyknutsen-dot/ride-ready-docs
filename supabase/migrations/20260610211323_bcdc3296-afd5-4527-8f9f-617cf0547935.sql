
-- 1. Widen support_messages status check to include awaiting_user and archived
ALTER TABLE public.support_messages DROP CONSTRAINT IF EXISTS support_messages_status_check;
ALTER TABLE public.support_messages ADD CONSTRAINT support_messages_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'waiting_on_user'::text, 'resolved'::text, 'archived'::text]));

-- 2. Admin-only RPC to return equipment counts per user, bypassing RLS safely
CREATE OR REPLACE FUNCTION public.admin_get_equipment_counts(_user_ids uuid[])
RETURNS TABLE(user_id uuid, equipment_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
    SELECT r.user_id, COUNT(*)::bigint AS equipment_count
    FROM public.rides r
    WHERE r.user_id = ANY(_user_ids)
    GROUP BY r.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_equipment_counts(uuid[]) TO authenticated;
