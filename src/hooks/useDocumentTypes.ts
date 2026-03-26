/**
 * Shared hook for fetching document types from the document_types library.
 * This is the SINGLE SOURCE OF TRUTH for document type taxonomy across the app.
 *
 * Used by:
 * - DocumentUpload (upload form dropdown)
 * - DocumentTypeRequests (admin duplicate matching)
 * - documentHelpers (label lookups, grouping)
 * - Any component needing document type names/categories
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DocumentType {
  id: string;
  type_key: string;
  name: string;
  category: string;
  description: string | null;
  is_active: boolean;
  source: string;
}

/** Fallback labels for legacy type_keys not yet in the DB */
const LEGACY_TYPE_LABELS: Record<string, string> = {
  insurance: 'Insurance Document',
  safety_certificate: 'Safety Certificate',
  doc_certificate: 'Declaration of Conformity',
  pssr_certificate: 'PSSR Certificate',
  loler_certificate: 'LOLER Certificate',
  puwer_certificate: 'PUWER Certificate',
  risk_assessment: 'Risk Assessment',
  method_statement: 'Method Statement',
  emergency_action_plan: 'Emergency Action Plan',
  evacuation_plan: 'Evacuation Plan',
  certificate: 'Other Certificate',
  operator_manual: 'Operator Manual',
  controller_manual: 'Controller Manual',
  build_up_down: 'Build Up & Down Procedure',
  maintenance_report: 'Maintenance Report',
  maintenance_log: 'Maintenance Log',
  daily_check: 'Daily Check Record',
  monthly_check: 'Monthly Check Record',
  yearly_check: 'Yearly Check Record',
  ndt_report: 'NDT Report',
  ndt_schedule: 'NDT Schedule',
  design_review: 'Design Review Report',
  conformity_design: 'Conformity to Design',
  initial_test_report: 'Initial Test Report',
  doc: 'DOC Certificate',
  declaration_of_compliance: 'Annual Inspection Certificate',
  electrical_inspection: 'Electrical Inspection',
  inservice_inspection: 'In-Service Inspection',
  manual: 'Manual',
  other: 'Other Document',
};

async function fetchDocumentTypes(): Promise<DocumentType[]> {
  const { data, error } = await supabase
    .from('document_types')
    .select('id, type_key, name, category, description, is_active, source')
    .order('category')
    .order('name');

  if (error) {
    console.error('Error fetching document types:', error);
    return [];
  }
  return (data || []) as DocumentType[];
}

/**
 * React Query hook for document types. Cached for 5 minutes, shared across components.
 */
export function useDocumentTypes() {
  const query = useQuery({
    queryKey: ['document-types-library'],
    queryFn: fetchDocumentTypes,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const allTypes = query.data || [];
  const activeTypes = allTypes.filter(t => t.is_active);

  /** Grouped by category, only active types — for upload dropdowns */
  const groupedActive: Record<string, DocumentType[]> = {};
  for (const t of activeTypes) {
    if (!groupedActive[t.category]) groupedActive[t.category] = [];
    groupedActive[t.category].push(t);
  }

  /** Build a type_key → name lookup map (all types, for display on old records) */
  const labelMap: Record<string, string> = { ...LEGACY_TYPE_LABELS };
  for (const t of allTypes) {
    labelMap[t.type_key] = t.name;
  }

  /** Build a type_key → category lookup map (all types, for grouping) */
  const categoryMap: Record<string, string> = {};
  for (const t of allTypes) {
    categoryMap[t.type_key] = t.category;
  }

  return {
    ...query,
    allTypes,
    activeTypes,
    groupedActive,
    labelMap,
    categoryMap,
  };
}

/**
 * Get a friendly label for a document type key.
 * Works with both DB-sourced labels and legacy fallbacks.
 */
export function getDocTypeLabelFromMap(typeKey: string, labelMap: Record<string, string>): string {
  return labelMap[typeKey] || LEGACY_TYPE_LABELS[typeKey] || typeKey;
}

/**
 * Map a document type_key to a display group category.
 * Uses DB category when available, falls back to hardcoded mapping.
 */
export function getDocGroupCategoryFromMap(typeKey: string, categoryMap: Record<string, string>): string {
  const dbCategory = categoryMap[typeKey];
  if (dbCategory) {
    // Map DB categories to display group names
    return CATEGORY_TO_GROUP[dbCategory] || `📁 ${dbCategory}`;
  }
  // Fallback for unknown types
  return fallbackGroupCategory(typeKey);
}

/** Map DB category names to emoji-prefixed display group names */
const CATEGORY_TO_GROUP: Record<string, string> = {
  'Inspection / Test': '📜 Inspection Reports',
  'Insurance & Certificates': '🛡️ Insurance & Certificates',
  'Manual / Procedure': '📖 Manuals & Procedures',
  'Maintenance': '🔧 Maintenance',
  'Other': '📁 Other',
};

/** Fallback grouping for type_keys not in the DB */
function fallbackGroupCategory(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === 'doc' || t === 'declaration_of_compliance') return '📜 Inspection Reports';
  if (t === 'electrical_inspection' || t === 'inservice_inspection' || t === 'initial_test_report') return '📜 Inspection Reports';
  if (t === 'check record' || t === 'check_record' || t.includes('safety check')) return '✅ Check Records';
  if (t === 'daily_check' || t === 'monthly_check' || t === 'yearly_check') return '✅ Check Records';
  if (t === 'ndt_schedule' || t === 'ndt_report' || t === 'ndt_inspection') return '🔬 NDT';
  if (t === 'design_review' || t === 'conformity_design') return '📐 Design & Review';
  if (t === 'risk_assessment' || t.includes('risk')) return '⚠️ Risk Assessments';
  if (t === 'method_statement' || t.includes('method')) return '⚠️ Risk Assessments';
  if (t === 'maintenance_report' || t === 'maintenance_log' || t === 'maintenance') return '🔧 Maintenance';
  if (t === 'operator_manual' || t === 'controller_manual' || t === 'build_up_down') return '📖 Manuals & Procedures';
  if (t === 'emergency_action_plan' || t === 'evacuation_plan') return '📖 Manuals & Procedures';
  if (t.includes('insur')) return '🛡️ Insurance & Certificates';
  if (t.includes('cert') || t === 'certificate') return '🛡️ Insurance & Certificates';
  if (t === 'photo' || t.includes('photo')) return '📸 Device Photos';
  return '📁 Other';
}

/** Auto-expiry type keys (insurance, certificates) */
export const AUTO_REPEAT_TYPE_KEYS = new Set([
  'insurance', 'safety_certificate', 'doc_certificate', 'pssr_certificate',
  'loler_certificate', 'puwer_certificate', 'certificate', 'declaration_of_compliance',
]);

/** Type keys that suggest global scope */
export const SUGGEST_GLOBAL_TYPE_KEYS = new Set(['insurance']);
