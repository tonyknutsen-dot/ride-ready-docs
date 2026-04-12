
-- Add invited_email column to organisation_members for reliable email resolution
ALTER TABLE public.organisation_members ADD COLUMN IF NOT EXISTS invited_email text;

-- Backfill from staff_invites where possible
UPDATE public.organisation_members om
SET invited_email = si.email
FROM public.staff_invites si
WHERE si.organisation_id = om.organisation_id
  AND si.status = 'accepted'
  AND om.invited_email IS NULL
  AND EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = om.user_id AND au.email = si.email
  );

-- Backfill the specific known member directly
UPDATE public.organisation_members
SET invited_email = 'info@knutssoftware.co.uk'
WHERE user_id = '1faaf0c4-d8ec-4af2-a700-aadf9d763bc9'
  AND invited_email IS NULL;
