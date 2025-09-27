-- Add owner field to rides table
ALTER TABLE public.rides 
ADD COLUMN owner_name text;