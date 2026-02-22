-- Add auto_generated to compliance_events
ALTER TABLE public.compliance_events ADD COLUMN auto_generated boolean NOT NULL DEFAULT false;

-- Drop dependent RLS policies
DROP POLICY IF EXISTS "Staff can create maintenance for assigned rides" ON public.maintenance_records;
DROP POLICY IF EXISTS "Staff can view maintenance for assigned rides" ON public.maintenance_records;

-- Drop dependent function
DROP FUNCTION IF EXISTS public.get_staff_permission(uuid, uuid);

-- Convert columns to text first (removes enum dependency)
ALTER TABLE public.organisation_members ALTER COLUMN permission_level DROP DEFAULT;
ALTER TABLE public.organisation_members ALTER COLUMN permission_level TYPE text USING permission_level::text;

ALTER TABLE public.staff_invites ALTER COLUMN permission_level DROP DEFAULT;
ALTER TABLE public.staff_invites ALTER COLUMN permission_level TYPE text USING permission_level::text;

-- Now safe to drop old enum
DROP TYPE public.staff_permission;

-- Create new enum
CREATE TYPE public.staff_role AS ENUM ('manager', 'supervisor', 'staff');

-- Update data to new values
UPDATE public.organisation_members SET permission_level = CASE permission_level
  WHEN 'full_access' THEN 'manager'
  WHEN 'checks_maintenance' THEN 'supervisor'
  WHEN 'checks_only' THEN 'staff'
  ELSE 'staff'
END;

UPDATE public.staff_invites SET permission_level = CASE permission_level
  WHEN 'full_access' THEN 'manager'
  WHEN 'checks_maintenance' THEN 'supervisor'
  WHEN 'checks_only' THEN 'staff'
  ELSE 'staff'
END;

-- Convert columns to new enum type
ALTER TABLE public.organisation_members ALTER COLUMN permission_level TYPE staff_role USING permission_level::staff_role;
ALTER TABLE public.organisation_members ALTER COLUMN permission_level SET DEFAULT 'staff'::staff_role;

ALTER TABLE public.staff_invites ALTER COLUMN permission_level TYPE staff_role USING permission_level::staff_role;
ALTER TABLE public.staff_invites ALTER COLUMN permission_level SET DEFAULT 'staff'::staff_role;

-- Recreate function with new return type
CREATE OR REPLACE FUNCTION public.get_staff_permission(_user_id uuid, _org_id uuid)
 RETURNS staff_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT permission_level FROM public.organisation_members
  WHERE organisation_id = _org_id AND user_id = _user_id AND is_active = true
  LIMIT 1
$$;

-- Recreate maintenance RLS policies with new enum
CREATE POLICY "Staff can create maintenance for assigned rides"
  ON public.maintenance_records FOR INSERT
  WITH CHECK (
    staff_can_access_ride(auth.uid(), ride_id)
    AND get_staff_permission(auth.uid(), (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND is_active = true LIMIT 1
    )) IN ('manager'::staff_role, 'supervisor'::staff_role)
  );

CREATE POLICY "Staff can view maintenance for assigned rides"
  ON public.maintenance_records FOR SELECT
  USING (
    staff_can_access_ride(auth.uid(), ride_id)
    AND get_staff_permission(auth.uid(), (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND is_active = true LIMIT 1
    )) IN ('manager'::staff_role, 'supervisor'::staff_role)
  );