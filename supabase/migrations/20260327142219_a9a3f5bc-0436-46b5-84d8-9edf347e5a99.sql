-- Deny all client-side writes to billing_sync_log
-- Only the stripe-webhook edge function writes here using service_role (bypasses RLS)

CREATE POLICY "Deny insert for all users"
ON public.billing_sync_log
FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "Deny update for all users"
ON public.billing_sync_log
FOR UPDATE TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for all users"
ON public.billing_sync_log
FOR DELETE TO authenticated
USING (false);