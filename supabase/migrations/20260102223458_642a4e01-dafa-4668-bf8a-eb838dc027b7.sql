-- Fix security: Restrict reference tables to authenticated users only

-- Ride categories
DROP POLICY IF EXISTS "Anyone can view ride categories" ON public.ride_categories;
CREATE POLICY "Authenticated users can view ride categories" 
ON public.ride_categories 
FOR SELECT 
TO authenticated
USING (true);

-- Technical bulletins (table exists but not used - still secure it)
DROP POLICY IF EXISTS "Anyone can view technical bulletins" ON public.technical_bulletins;
CREATE POLICY "Authenticated users can view technical bulletins" 
ON public.technical_bulletins 
FOR SELECT 
TO authenticated
USING (true);

-- Compliance templates
DROP POLICY IF EXISTS "Users can view compliance templates" ON public.compliance_templates;
CREATE POLICY "Authenticated users can view compliance templates" 
ON public.compliance_templates 
FOR SELECT 
TO authenticated
USING (true);