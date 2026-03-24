
-- Fix overly broad RLS on compliance_record_sequences
-- Drop existing broad policies
DROP POLICY IF EXISTS "Authenticated users can read sequences" ON public.compliance_record_sequences;
DROP POLICY IF EXISTS "Authenticated users can insert sequences" ON public.compliance_record_sequences;
DROP POLICY IF EXISTS "Authenticated users can update sequences" ON public.compliance_record_sequences;

-- Replace with owner-scoped policy
CREATE POLICY "Ride owners can manage their sequences"
  ON public.compliance_record_sequences FOR ALL
  USING (ride_id IN (SELECT id FROM public.rides WHERE user_id = auth.uid()))
  WITH CHECK (ride_id IN (SELECT id FROM public.rides WHERE user_id = auth.uid()));
