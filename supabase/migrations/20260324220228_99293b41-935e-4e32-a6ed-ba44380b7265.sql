-- Add DELETE policy for admin users on ride_categories
CREATE POLICY "Admins can delete ride categories"
ON public.ride_categories
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));