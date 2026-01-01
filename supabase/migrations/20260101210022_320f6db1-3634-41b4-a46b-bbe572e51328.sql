-- Add is_suspended column to profiles
ALTER TABLE public.profiles 
ADD COLUMN is_suspended boolean NOT NULL DEFAULT false;

-- Add suspended_at timestamp
ALTER TABLE public.profiles 
ADD COLUMN suspended_at timestamp with time zone;

-- Add suspended_reason for admin notes
ALTER TABLE public.profiles 
ADD COLUMN suspended_reason text;