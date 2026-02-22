
ALTER TABLE public.profiles
ADD COLUMN requires_operational_checks boolean NOT NULL DEFAULT true;
