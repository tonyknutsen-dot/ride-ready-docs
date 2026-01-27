-- Add risk assessment settings to profiles table for customizable reduction percentages
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS risk_settings jsonb DEFAULT '{"existingControlsReduction": 20, "additionalActionsReduction": 15}'::jsonb;

COMMENT ON COLUMN public.profiles.risk_settings IS 'User-customizable risk assessment calculation settings (reduction percentages)';