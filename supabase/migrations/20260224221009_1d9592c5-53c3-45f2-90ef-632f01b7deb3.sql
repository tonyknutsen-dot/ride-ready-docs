-- Add per-ride setting: pre-opening check covers daily check
ALTER TABLE public.rides
ADD COLUMN preopening_covers_daily boolean NOT NULL DEFAULT false;