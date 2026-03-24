-- Add INSERT policy for admin users on ride_categories
CREATE POLICY "Admins can insert ride categories"
ON public.ride_categories
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add UPDATE policy for admin users on ride_categories
CREATE POLICY "Admins can update ride categories"
ON public.ride_categories
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));