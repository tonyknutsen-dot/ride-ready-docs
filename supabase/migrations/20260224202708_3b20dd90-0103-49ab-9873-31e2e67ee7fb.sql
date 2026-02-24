-- Add awaiting_review to defect_status enum
ALTER TYPE public.defect_status ADD VALUE IF NOT EXISTS 'awaiting_review' BEFORE 'resolved';
