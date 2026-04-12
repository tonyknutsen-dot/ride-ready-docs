-- Fix organisation_members defaults: calendar should be false, maintenance should be true for staff
ALTER TABLE public.organisation_members ALTER COLUMN can_access_calendar SET DEFAULT false;
ALTER TABLE public.organisation_members ALTER COLUMN can_access_maintenance SET DEFAULT true;