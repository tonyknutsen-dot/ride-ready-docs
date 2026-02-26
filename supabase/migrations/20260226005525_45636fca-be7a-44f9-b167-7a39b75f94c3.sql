
-- ============================================================
-- Server-side subscription enforcement
-- Two functions + restrictive RLS policies on all data tables
-- ============================================================

-- 1) Check if a user's subscription allows write operations
--    Handles both owners and staff (checks org owner's subscription)
CREATE OR REPLACE FUNCTION public.subscription_allows_writes(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user_id uuid;
BEGIN
  -- Testers always allowed
  IF public.is_tester(_user_id) THEN RETURN true; END IF;

  -- If user is staff, check org owner's subscription instead
  SELECT o.owner_id INTO v_target_user_id
  FROM organisation_members om
  JOIN organisations o ON o.id = om.organisation_id
  WHERE om.user_id = _user_id AND om.is_active = true
  LIMIT 1;

  -- If not staff, check own subscription
  IF v_target_user_id IS NULL THEN
    v_target_user_id := _user_id;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = v_target_user_id
    AND (
      subscription_status IN ('active', 'past_due', 'basic', 'advanced')
      OR (subscription_status = 'trial' AND trial_ends_at > now())
    )
  );
END;
$$;

-- 2) Check if a user can add another billable ride (tier limit)
CREATE OR REPLACE FUNCTION public.can_add_billable_ride(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_status text;
  v_trial_end timestamptz;
  v_max_rides int;
  v_current_count int;
  v_is_billable boolean;
BEGIN
  -- Testers bypass
  IF public.is_tester(_user_id) THEN RETURN true; END IF;

  -- Get subscription info
  SELECT subscription_plan, subscription_status, trial_ends_at
  INTO v_plan, v_status, v_trial_end
  FROM profiles WHERE user_id = _user_id;

  -- Trial users: allow up to enterprise max (effectively unlimited during trial)
  IF v_status = 'trial' AND v_trial_end > now() THEN
    RETURN true;
  END IF;

  -- Expired users cannot add rides at all
  IF v_status NOT IN ('active', 'past_due', 'basic', 'advanced') THEN
    RETURN false;
  END IF;

  -- Determine max rides for plan
  v_max_rides := CASE COALESCE(v_plan, 'starter')
    WHEN 'starter' THEN 5
    WHEN 'operator' THEN 12
    WHEN 'professional' THEN 25
    WHEN 'enterprise' THEN 999999
    ELSE 5
  END;

  -- Count current billable rides
  SELECT COUNT(*) INTO v_current_count
  FROM rides r
  JOIN ride_categories rc ON r.category_id = rc.id
  WHERE r.user_id = _user_id AND rc.is_billable = true;

  RETURN v_current_count < v_max_rides;
END;
$$;

-- ============================================================
-- RESTRICTIVE policies: block writes when subscription expired
-- These AND with existing permissive policies
-- ============================================================

-- RIDES
CREATE POLICY "Block writes when subscription expired"
  ON public.rides AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (subscription_allows_writes(auth.uid()));

CREATE POLICY "Block ride insert at tier limit"
  ON public.rides AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (can_add_billable_ride(auth.uid()));

CREATE POLICY "Block ride updates when expired"
  ON public.rides AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (subscription_allows_writes(auth.uid()));

CREATE POLICY "Block ride deletes when expired"
  ON public.rides AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (subscription_allows_writes(auth.uid()));

-- DOCUMENTS
CREATE POLICY "Block doc writes when expired"
  ON public.documents AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (subscription_allows_writes(auth.uid()));

CREATE POLICY "Block doc updates when expired"
  ON public.documents AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (subscription_allows_writes(auth.uid()));

CREATE POLICY "Block doc deletes when expired"
  ON public.documents AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (subscription_allows_writes(auth.uid()));

-- CHECKS
CREATE POLICY "Block check writes when expired"
  ON public.checks AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (subscription_allows_writes(auth.uid()));

CREATE POLICY "Block check updates when expired"
  ON public.checks AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (subscription_allows_writes(auth.uid()));

CREATE POLICY "Block check deletes when expired"
  ON public.checks AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (subscription_allows_writes(auth.uid()));

-- DEFECTS
CREATE POLICY "Block defect writes when expired"
  ON public.defects AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (subscription_allows_writes(auth.uid()));

CREATE POLICY "Block defect updates when expired"
  ON public.defects AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (subscription_allows_writes(auth.uid()));

CREATE POLICY "Block defect deletes when expired"
  ON public.defects AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (subscription_allows_writes(auth.uid()));

-- MAINTENANCE_RECORDS
CREATE POLICY "Block maintenance writes when expired"
  ON public.maintenance_records AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (subscription_allows_writes(auth.uid()));

CREATE POLICY "Block maintenance updates when expired"
  ON public.maintenance_records AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (subscription_allows_writes(auth.uid()));

CREATE POLICY "Block maintenance deletes when expired"
  ON public.maintenance_records AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (subscription_allows_writes(auth.uid()));

-- COMPLIANCE_EVENTS
CREATE POLICY "Block compliance writes when expired"
  ON public.compliance_events AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (subscription_allows_writes(auth.uid()));

CREATE POLICY "Block compliance updates when expired"
  ON public.compliance_events AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (subscription_allows_writes(auth.uid()));

CREATE POLICY "Block compliance deletes when expired"
  ON public.compliance_events AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (subscription_allows_writes(auth.uid()));
