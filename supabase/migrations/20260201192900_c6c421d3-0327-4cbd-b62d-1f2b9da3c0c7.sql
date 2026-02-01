-- 1) Safe subscription context for staff (returns org owner's subscription fields)
-- This avoids giving staff direct SELECT access to profiles (which contains sensitive Stripe IDs).
CREATE OR REPLACE FUNCTION public.get_subscription_context()
RETURNS TABLE (
  profile_user_id uuid,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  subscription_status text,
  subscription_plan text,
  billing_cycle text,
  extra_items_count integer,
  current_period_end timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH org AS (
    SELECT o.owner_id
    FROM public.organisation_members om
    JOIN public.organisations o ON o.id = om.organisation_id
    WHERE om.user_id = auth.uid()
      AND om.is_active = true
    LIMIT 1
  ), target AS (
    SELECT COALESCE((SELECT owner_id FROM org), auth.uid()) AS target_user_id
  )
  SELECT
    p.user_id AS profile_user_id,
    p.trial_started_at,
    p.trial_ends_at,
    p.subscription_status,
    p.subscription_plan,
    p.billing_cycle,
    p.extra_items_count,
    p.current_period_end
  FROM public.profiles p
  JOIN target t ON t.target_user_id = p.user_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_subscription_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subscription_context() TO authenticated;

-- 2) Align staff document access with granular feature permissions
-- Old policy required permission_level = 'full_access' which no longer matches the checkbox-based model.
DROP POLICY IF EXISTS "Staff can view documents for assigned rides" ON public.documents;

CREATE POLICY "Staff can view documents for assigned rides"
ON public.documents
FOR SELECT
USING (
  (
    ride_id IS NULL
    AND is_global = true
    AND public.staff_can_access_feature(auth.uid(), 'documents')
  )
  OR
  (
    ride_id IS NOT NULL
    AND public.staff_can_access_ride(auth.uid(), ride_id)
    AND public.staff_can_access_feature(auth.uid(), 'documents')
  )
);
