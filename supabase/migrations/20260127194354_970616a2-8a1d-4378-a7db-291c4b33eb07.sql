-- RLS Policies for organisations
CREATE POLICY "Deny anonymous access to organisations"
ON public.organisations
AS RESTRICTIVE
FOR ALL
USING (auth.role() = 'authenticated');

CREATE POLICY "Owners can manage their organisations"
ON public.organisations
FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Staff can view their organisation"
ON public.organisations
FOR SELECT
USING (
  id IN (SELECT organisation_id FROM public.organisation_members WHERE user_id = auth.uid() AND is_active = true)
);

-- RLS Policies for organisation_members
CREATE POLICY "Deny anonymous access to organisation_members"
ON public.organisation_members
AS RESTRICTIVE
FOR ALL
USING (auth.role() = 'authenticated');

CREATE POLICY "Org owners can manage members"
ON public.organisation_members
FOR ALL
USING (is_org_owner(auth.uid(), organisation_id))
WITH CHECK (is_org_owner(auth.uid(), organisation_id));

CREATE POLICY "Staff can view their own membership"
ON public.organisation_members
FOR SELECT
USING (user_id = auth.uid());

-- RLS Policies for staff_equipment_assignments
CREATE POLICY "Deny anonymous access to staff_equipment_assignments"
ON public.staff_equipment_assignments
AS RESTRICTIVE
FOR ALL
USING (auth.role() = 'authenticated');

CREATE POLICY "Org owners can manage equipment assignments"
ON public.staff_equipment_assignments
FOR ALL
USING (
  member_id IN (SELECT om.id FROM public.organisation_members om WHERE is_org_owner(auth.uid(), om.organisation_id))
)
WITH CHECK (
  member_id IN (SELECT om.id FROM public.organisation_members om WHERE is_org_owner(auth.uid(), om.organisation_id))
);

CREATE POLICY "Staff can view their own assignments"
ON public.staff_equipment_assignments
FOR SELECT
USING (
  member_id IN (SELECT id FROM public.organisation_members WHERE user_id = auth.uid())
);

-- RLS Policies for staff_invites
CREATE POLICY "Deny anonymous access to staff_invites"
ON public.staff_invites
AS RESTRICTIVE
FOR ALL
USING (auth.role() = 'authenticated');

CREATE POLICY "Org owners can manage invites"
ON public.staff_invites
FOR ALL
USING (is_org_owner(auth.uid(), organisation_id))
WITH CHECK (is_org_owner(auth.uid(), organisation_id));

CREATE POLICY "Users can view invites sent to their email"
ON public.staff_invites
FOR SELECT
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Add updated_at triggers
CREATE TRIGGER update_organisations_updated_at
  BEFORE UPDATE ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organisation_members_updated_at
  BEFORE UPDATE ON public.organisation_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_invites_updated_at
  BEFORE UPDATE ON public.staff_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();