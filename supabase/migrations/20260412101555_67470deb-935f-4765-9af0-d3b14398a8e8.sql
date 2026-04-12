-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can insert own pressure sessions" ON public.pressure_sessions;

-- Recreate with proper ownership check
CREATE POLICY "Users can insert own pressure sessions"
ON public.pressure_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND subscription_allows_writes(auth.uid())
);
