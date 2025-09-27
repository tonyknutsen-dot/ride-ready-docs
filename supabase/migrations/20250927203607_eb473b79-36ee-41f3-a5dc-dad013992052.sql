-- Update RLS policies for technical_bulletins to allow admin management
DROP POLICY IF EXISTS "Anyone can view technical bulletins" ON public.technical_bulletins;

-- Allow viewing bulletins for everyone
CREATE POLICY "Anyone can view technical bulletins" 
ON public.technical_bulletins 
FOR SELECT 
USING (true);

-- Allow admins to manage bulletins (users with advanced subscription for now)
CREATE POLICY "Advanced users can manage technical bulletins" 
ON public.technical_bulletins 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND subscription_status = 'advanced'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND subscription_status = 'advanced'
  )
);