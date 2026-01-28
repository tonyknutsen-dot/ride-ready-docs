-- Add expiry_reminder_sent column to staff_invites for tracking reminder emails
ALTER TABLE public.staff_invites 
ADD COLUMN IF NOT EXISTS expiry_reminder_sent BOOLEAN DEFAULT false;