-- Phase 2: Auto-create organisations for existing users with rides
-- This creates an organisation for any user who has rides but no organisation

-- Function to auto-create organisation when a user creates their first ride
CREATE OR REPLACE FUNCTION public.auto_create_organisation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id uuid;
  user_company_name text;
BEGIN
  -- Check if user already has an organisation (as owner)
  SELECT id INTO org_id FROM public.organisations WHERE owner_id = NEW.user_id LIMIT 1;
  
  -- If no organisation exists, create one
  IF org_id IS NULL THEN
    -- Get company name from profile, fallback to 'My Organisation'
    SELECT COALESCE(company_name, 'My Organisation') INTO user_company_name
    FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
    
    INSERT INTO public.organisations (name, owner_id)
    VALUES (user_company_name, NEW.user_id)
    RETURNING id INTO org_id;
    
    RAISE LOG 'Auto-created organisation % for user %', org_id, NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-create organisation when first ride is added
CREATE TRIGGER trigger_auto_create_organisation
AFTER INSERT ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_organisation();

-- Backfill: Create organisations for existing users with rides
INSERT INTO public.organisations (name, owner_id)
SELECT 
  COALESCE(p.company_name, 'My Organisation'),
  r.user_id
FROM (SELECT DISTINCT user_id FROM public.rides) r
LEFT JOIN public.profiles p ON r.user_id = p.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.organisations o WHERE o.owner_id = r.user_id
);