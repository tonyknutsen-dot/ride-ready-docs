-- Fix the notifications insert policy - only allow service role inserts
-- Edge functions using service role keys bypass RLS anyway
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create a more restrictive policy that only allows authenticated users to insert their own notifications
-- This prevents spam while allowing legitimate system notifications via service role
CREATE POLICY "Users can insert their own notifications" 
ON public.notifications 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);