-- Add country column to profiles table for region-appropriate terminology
ALTER TABLE public.profiles 
ADD COLUMN country TEXT DEFAULT 'GB';