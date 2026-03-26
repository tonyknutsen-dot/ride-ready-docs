-- Allow admins to update early_access_signups (for retry import flow)
CREATE POLICY "Admins can update early access signups"
ON public.early_access_signups
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));