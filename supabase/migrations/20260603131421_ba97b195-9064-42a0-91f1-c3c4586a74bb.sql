
-- Phase 1: account isolation + onboarding bootstrap (server side only)

-- 1a. Harden auto_create_organisation: skip if user is already an active staff
--     member of another org (invited staff accepting an invite must not get
--     a fresh owned organisation created behind their back).
CREATE OR REPLACE FUNCTION public.auto_create_organisation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  org_id uuid;
  user_company_name text;
  is_staff_elsewhere boolean;
BEGIN
  -- Skip if user already owns an organisation
  SELECT id INTO org_id FROM public.organisations WHERE owner_id = NEW.user_id LIMIT 1;
  IF org_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if user is an active member of any organisation they don't own
  -- (i.e. they were invited as staff to someone else's org)
  SELECT EXISTS (
    SELECT 1
    FROM public.organisation_members om
    JOIN public.organisations o ON o.id = om.organisation_id
    WHERE om.user_id = NEW.user_id
      AND om.is_active = true
      AND o.owner_id <> NEW.user_id
  ) INTO is_staff_elsewhere;

  IF is_staff_elsewhere THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(company_name, 'My Organisation') INTO user_company_name
  FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;

  INSERT INTO public.organisations (name, owner_id)
  VALUES (COALESCE(user_company_name, 'My Organisation'), NEW.user_id)
  RETURNING id INTO org_id;

  RAISE LOG 'Auto-created organisation % for user %', org_id, NEW.user_id;
  RETURN NEW;
END;
$function$;

-- 1b. Wire the triggers on profiles (idempotent)
DROP TRIGGER IF EXISTS trg_initialize_user_trial ON public.profiles;
CREATE TRIGGER trg_initialize_user_trial
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_trial();

DROP TRIGGER IF EXISTS trg_auto_create_organisation ON public.profiles;
CREATE TRIGGER trg_auto_create_organisation
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_organisation();

-- 2a. Notification purge function: remove stale notifications for a user
--     whose membership in an organisation has just been deactivated/removed.
--     Scopes the purge by org owner across known related_table values.
CREATE OR REPLACE FUNCTION public.purge_notifications_for_removed_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_owner_id uuid;
  v_deleted int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    SELECT owner_id INTO v_owner_id FROM public.organisations WHERE id = OLD.organisation_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only fire when membership is being deactivated
    IF NEW.is_active = false AND OLD.is_active = true THEN
      v_user_id := OLD.user_id;
      SELECT owner_id INTO v_owner_id FROM public.organisations WHERE id = OLD.organisation_id;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  IF v_user_id IS NULL OR v_owner_id IS NULL OR v_user_id = v_owner_id THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Defects owned by the org owner
  DELETE FROM public.notifications n
  WHERE n.user_id = v_user_id
    AND n.related_table = 'defects'
    AND n.related_id IN (SELECT id FROM public.defects WHERE user_id = v_owner_id);

  -- Documents owned by the org owner
  DELETE FROM public.notifications n
  WHERE n.user_id = v_user_id
    AND n.related_table = 'documents'
    AND n.related_id IN (SELECT id FROM public.documents WHERE user_id = v_owner_id);

  -- Rides/equipment owned by the org owner
  DELETE FROM public.notifications n
  WHERE n.user_id = v_user_id
    AND n.related_table = 'rides'
    AND n.related_id IN (SELECT id FROM public.rides WHERE user_id = v_owner_id);

  -- Compliance events for that owner's rides
  DELETE FROM public.notifications n
  WHERE n.user_id = v_user_id
    AND n.related_table = 'compliance_events'
    AND n.related_id IN (SELECT id FROM public.compliance_events WHERE user_id = v_owner_id);

  -- Checks for that owner
  DELETE FROM public.notifications n
  WHERE n.user_id = v_user_id
    AND n.related_table = 'checks'
    AND n.related_id IN (SELECT id FROM public.checks WHERE user_id = v_owner_id);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE LOG 'purge_notifications_for_removed_member: user=% org_owner=% rows_in_last_batch=%', v_user_id, v_owner_id, v_deleted;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2b. Wire the purge trigger
DROP TRIGGER IF EXISTS trg_purge_notifications_on_member_removal ON public.organisation_members;
CREATE TRIGGER trg_purge_notifications_on_member_removal
  AFTER UPDATE OR DELETE ON public.organisation_members
  FOR EACH ROW
  EXECUTE FUNCTION public.purge_notifications_for_removed_member();

-- 3. One-time backfill for info@knutssoftware.co.uk (user 1faaf0c4-...)
--    - create owned organisation if missing
--    - purge stale notifications scoped to TK Inspections (org 1899de03-...)
DO $$
DECLARE
  v_user_id uuid := '1faaf0c4-d8ec-4af2-a700-aadf9d763bc9';
  v_old_org_id uuid := '1899de03-dc17-4d7e-92e1-16d3722510b3';
  v_old_owner uuid;
  v_company text;
  v_org_id uuid;
BEGIN
  -- Backfill owned org
  SELECT id INTO v_org_id FROM public.organisations WHERE owner_id = v_user_id LIMIT 1;
  IF v_org_id IS NULL THEN
    SELECT COALESCE(NULLIF(company_name, ''), 'My Organisation')
      INTO v_company FROM public.profiles WHERE user_id = v_user_id;
    INSERT INTO public.organisations (name, owner_id)
    VALUES (COALESCE(v_company, 'My Organisation'), v_user_id);
  END IF;

  -- Purge stale notifications scoped to old org's owner
  SELECT owner_id INTO v_old_owner FROM public.organisations WHERE id = v_old_org_id;
  IF v_old_owner IS NOT NULL THEN
    DELETE FROM public.notifications n
    WHERE n.user_id = v_user_id
      AND (
        (n.related_table = 'defects'
           AND n.related_id IN (SELECT id FROM public.defects WHERE user_id = v_old_owner))
        OR (n.related_table = 'documents'
           AND n.related_id IN (SELECT id FROM public.documents WHERE user_id = v_old_owner))
        OR (n.related_table = 'rides'
           AND n.related_id IN (SELECT id FROM public.rides WHERE user_id = v_old_owner))
        OR (n.related_table = 'compliance_events'
           AND n.related_id IN (SELECT id FROM public.compliance_events WHERE user_id = v_old_owner))
        OR (n.related_table = 'checks'
           AND n.related_id IN (SELECT id FROM public.checks WHERE user_id = v_old_owner))
      );
  END IF;
END $$;
