-- Phase 6: Update RLS policies for staff equipment access
-- This migration updates rides, checks, documents, and maintenance tables
-- to allow staff members to access records for their assigned equipment

-- =====================================================
-- RIDES TABLE: Allow staff to view assigned rides
-- =====================================================

-- Drop existing policy if it exists and recreate with staff access
DROP POLICY IF EXISTS "Users can manage their own rides" ON public.rides;

-- Owners can fully manage their rides
CREATE POLICY "Owners can manage their rides"
ON public.rides FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Staff can view rides assigned to them
CREATE POLICY "Staff can view assigned rides"
ON public.rides FOR SELECT
USING (staff_can_access_ride(auth.uid(), id));

-- =====================================================
-- CHECKS TABLE: Allow staff to manage checks for assigned rides
-- =====================================================

DROP POLICY IF EXISTS "Users can manage their own checks" ON public.checks;

-- Owners can fully manage their checks
CREATE POLICY "Owners can manage their checks"
ON public.checks FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Staff can view checks for assigned rides
CREATE POLICY "Staff can view checks for assigned rides"
ON public.checks FOR SELECT
USING (staff_can_access_ride(auth.uid(), ride_id));

-- Staff can create checks for assigned rides
CREATE POLICY "Staff can create checks for assigned rides"
ON public.checks FOR INSERT
WITH CHECK (staff_can_access_ride(auth.uid(), ride_id));

-- Staff can update checks they created
CREATE POLICY "Staff can update their checks"
ON public.checks FOR UPDATE
USING (
  staff_can_access_ride(auth.uid(), ride_id) AND
  EXISTS (
    SELECT 1 FROM organisation_members om
    WHERE om.user_id = auth.uid() AND om.is_active = true
  )
);

-- =====================================================
-- DOCUMENTS TABLE: Allow full_access staff to view documents
-- =====================================================

DROP POLICY IF EXISTS "Users can manage their own documents" ON public.documents;

-- Owners can fully manage their documents
CREATE POLICY "Owners can manage their documents"
ON public.documents FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Staff with full_access can view documents for assigned rides
CREATE POLICY "Staff can view documents for assigned rides"
ON public.documents FOR SELECT
USING (
  (ride_id IS NULL AND is_global = true) OR
  (ride_id IS NOT NULL AND staff_can_access_ride(auth.uid(), ride_id) AND
   get_staff_permission(auth.uid(), (
     SELECT organisation_id FROM organisation_members 
     WHERE user_id = auth.uid() AND is_active = true LIMIT 1
   )) = 'full_access')
);

-- =====================================================
-- MAINTENANCE_RECORDS TABLE: Allow staff with checks_maintenance+ to access
-- =====================================================

DROP POLICY IF EXISTS "Users can manage their own maintenance records" ON public.maintenance_records;

-- Owners can fully manage their maintenance records
CREATE POLICY "Owners can manage their maintenance records"
ON public.maintenance_records FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Staff can view maintenance for assigned rides (if they have permission)
CREATE POLICY "Staff can view maintenance for assigned rides"
ON public.maintenance_records FOR SELECT
USING (
  staff_can_access_ride(auth.uid(), ride_id) AND
  get_staff_permission(auth.uid(), (
    SELECT organisation_id FROM organisation_members 
    WHERE user_id = auth.uid() AND is_active = true LIMIT 1
  )) IN ('checks_maintenance', 'full_access')
);

-- Staff can create maintenance records for assigned rides
CREATE POLICY "Staff can create maintenance for assigned rides"
ON public.maintenance_records FOR INSERT
WITH CHECK (
  staff_can_access_ride(auth.uid(), ride_id) AND
  get_staff_permission(auth.uid(), (
    SELECT organisation_id FROM organisation_members 
    WHERE user_id = auth.uid() AND is_active = true LIMIT 1
  )) IN ('checks_maintenance', 'full_access')
);

-- =====================================================
-- DEFECTS TABLE: Allow staff to manage defects for assigned rides
-- =====================================================

DROP POLICY IF EXISTS "Users can manage their own defects" ON public.defects;

-- Owners can fully manage their defects
CREATE POLICY "Owners can manage their defects"
ON public.defects FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Staff can view defects for assigned rides
CREATE POLICY "Staff can view defects for assigned rides"
ON public.defects FOR SELECT
USING (staff_can_access_ride(auth.uid(), ride_id));

-- Staff can create defects for assigned rides
CREATE POLICY "Staff can create defects for assigned rides"
ON public.defects FOR INSERT
WITH CHECK (staff_can_access_ride(auth.uid(), ride_id));

-- Staff can update defects for assigned rides
CREATE POLICY "Staff can update defects for assigned rides"
ON public.defects FOR UPDATE
USING (staff_can_access_ride(auth.uid(), ride_id));

-- =====================================================
-- CHECK_RESULTS TABLE: Allow staff to manage check results
-- =====================================================

-- No changes needed - check_results uses check_id which chains to checks table

-- =====================================================
-- DAILY_CHECK_TEMPLATES TABLE: Allow staff to view templates for assigned rides
-- =====================================================

DROP POLICY IF EXISTS "Users can manage their own daily check templates" ON public.daily_check_templates;

-- Owners can fully manage their templates
CREATE POLICY "Owners can manage their templates"
ON public.daily_check_templates FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Staff can view templates for assigned rides
CREATE POLICY "Staff can view templates for assigned rides"
ON public.daily_check_templates FOR SELECT
USING (staff_can_access_ride(auth.uid(), ride_id));