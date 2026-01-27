-- Clean up partial migration
DROP TABLE IF EXISTS public.staff_invites CASCADE;
DROP TABLE IF EXISTS public.staff_equipment_assignments CASCADE;
DROP TABLE IF EXISTS public.organisation_members CASCADE;
DROP TABLE IF EXISTS public.organisations CASCADE;
DROP FUNCTION IF EXISTS public.is_org_owner CASCADE;
DROP FUNCTION IF EXISTS public.is_org_member CASCADE;
DROP FUNCTION IF EXISTS public.get_staff_permission CASCADE;
DROP FUNCTION IF EXISTS public.staff_can_access_ride CASCADE;
DROP TYPE IF EXISTS public.staff_permission CASCADE;

-- Phase 1: Staff Management Database Foundation

-- 1. Create staff_permission enum
CREATE TYPE public.staff_permission AS ENUM ('checks_only', 'checks_maintenance', 'full_access');

-- 2. Create organisations table
CREATE TABLE public.organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Create organisation_members table
CREATE TABLE public.organisation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  permission_level public.staff_permission NOT NULL DEFAULT 'checks_only',
  invited_by UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organisation_id, user_id)
);

-- 4. Create staff_equipment_assignments table
CREATE TABLE public.staff_equipment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.organisation_members(id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID NOT NULL,
  UNIQUE(member_id, ride_id)
);

-- 5. Create staff_invites table
CREATE TABLE public.staff_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  permission_level public.staff_permission NOT NULL DEFAULT 'checks_only',
  invite_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(invite_token)
);

-- Create indexes
CREATE INDEX idx_organisations_owner ON public.organisations(owner_id);
CREATE INDEX idx_organisation_members_user ON public.organisation_members(user_id);
CREATE INDEX idx_organisation_members_org ON public.organisation_members(organisation_id);
CREATE INDEX idx_staff_equipment_member ON public.staff_equipment_assignments(member_id);
CREATE INDEX idx_staff_equipment_ride ON public.staff_equipment_assignments(ride_id);
CREATE INDEX idx_staff_invites_token ON public.staff_invites(invite_token);
CREATE INDEX idx_staff_invites_email ON public.staff_invites(email);
CREATE INDEX idx_staff_invites_org ON public.staff_invites(organisation_id);

-- Enable RLS
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_equipment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_org_owner(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organisations
    WHERE id = _org_id AND owner_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organisation_members
    WHERE organisation_id = _org_id AND user_id = _user_id AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.get_staff_permission(_user_id UUID, _org_id UUID)
RETURNS public.staff_permission
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT permission_level FROM public.organisation_members
  WHERE organisation_id = _org_id AND user_id = _user_id AND is_active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.staff_can_access_ride(_user_id UUID, _ride_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rides WHERE id = _ride_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.staff_equipment_assignments sea
    JOIN public.organisation_members om ON sea.member_id = om.id
    WHERE sea.ride_id = _ride_id AND om.user_id = _user_id AND om.is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.organisation_members om
    JOIN public.organisations o ON om.organisation_id = o.id
    WHERE om.user_id = _user_id AND om.is_active = true
      AND NOT EXISTS (SELECT 1 FROM public.staff_equipment_assignments sea2 WHERE sea2.member_id = om.id)
      AND EXISTS (SELECT 1 FROM public.rides r WHERE r.id = _ride_id AND r.user_id = o.owner_id)
  )
$$;