
-- Create document_types table for shared document type library
CREATE TABLE IF NOT EXISTS public.document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'admin',
  approved_from_request_id uuid REFERENCES public.document_type_requests(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "Authenticated users can read document types"
  ON public.document_types FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can write
CREATE POLICY "Admins can insert document types"
  ON public.document_types FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update document types"
  ON public.document_types FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete document types"
  ON public.document_types FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER update_document_types_updated_at
  BEFORE UPDATE ON public.document_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with existing hardcoded document types
INSERT INTO public.document_types (type_key, name, category, source) VALUES
  ('declaration_of_compliance', 'Annual Inspection Certificate', 'Inspection / Test', 'system'),
  ('electrical_inspection', 'Electrical Inspection', 'Inspection / Test', 'system'),
  ('inservice_inspection', 'In-Service Inspection', 'Inspection / Test', 'system'),
  ('initial_test_report', 'Initial Test Report', 'Inspection / Test', 'system'),
  ('ndt_report', 'NDT Report', 'Inspection / Test', 'system'),
  ('daily_check', 'Daily Check Record', 'Inspection / Test', 'system'),
  ('monthly_check', 'Monthly Check Record', 'Inspection / Test', 'system'),
  ('yearly_check', 'Yearly Check Record', 'Inspection / Test', 'system'),
  ('insurance', 'Insurance Document', 'Insurance & Certificates', 'system'),
  ('safety_certificate', 'Safety Certificate', 'Insurance & Certificates', 'system'),
  ('doc_certificate', 'Declaration of Conformity', 'Insurance & Certificates', 'system'),
  ('pssr_certificate', 'PSSR Certificate', 'Insurance & Certificates', 'system'),
  ('loler_certificate', 'LOLER Certificate', 'Insurance & Certificates', 'system'),
  ('puwer_certificate', 'PUWER Certificate', 'Insurance & Certificates', 'system'),
  ('certificate', 'Other Certificate', 'Insurance & Certificates', 'system'),
  ('operator_manual', 'Operator Manual', 'Manual / Procedure', 'system'),
  ('controller_manual', 'Controller Manual', 'Manual / Procedure', 'system'),
  ('build_up_down', 'Build Up & Down Procedure', 'Manual / Procedure', 'system'),
  ('emergency_action_plan', 'Emergency Action Plan', 'Manual / Procedure', 'system'),
  ('evacuation_plan', 'Evacuation Plan', 'Manual / Procedure', 'system'),
  ('risk_assessment', 'Risk Assessment', 'Manual / Procedure', 'system'),
  ('method_statement', 'Method Statement', 'Manual / Procedure', 'system'),
  ('maintenance_report', 'Maintenance Report', 'Maintenance', 'system'),
  ('maintenance_log', 'Maintenance Log', 'Maintenance', 'system'),
  ('design_review', 'Design Review Report', 'Other', 'system'),
  ('conformity_design', 'Conformity to Design', 'Other', 'system'),
  ('ndt_schedule', 'NDT Schedule', 'Other', 'system'),
  ('other', 'Other Document', 'Other', 'system')
ON CONFLICT (type_key) DO NOTHING;
