DROP POLICY IF EXISTS "Users can view invites sent to their email" ON public.staff_invites;

CREATE POLICY "Users can view invites sent to their email"
ON public.staff_invites
FOR SELECT
TO authenticated
USING (email = lower(coalesce(auth.jwt() ->> 'email', '')));