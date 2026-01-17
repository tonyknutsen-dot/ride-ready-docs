-- Add geographic information columns to blocked_ips table
ALTER TABLE public.blocked_ips
ADD COLUMN IF NOT EXISTS country_code text,
ADD COLUMN IF NOT EXISTS country_name text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS region text,
ADD COLUMN IF NOT EXISTS isp text;

-- Create index for country analysis
CREATE INDEX IF NOT EXISTS idx_blocked_ips_country ON public.blocked_ips(country_code) WHERE country_code IS NOT NULL;