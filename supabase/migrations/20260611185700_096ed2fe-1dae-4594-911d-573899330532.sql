CREATE POLICY "Admins can view all staff invites"
ON public.staff_invites
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));