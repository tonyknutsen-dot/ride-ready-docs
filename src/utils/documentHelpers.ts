/**
 * Shared document classification, type labels, and utility helpers.
 * 
 * SINGLE SOURCE OF TRUTH for all document pages:
 * - DocumentList (All Documents / ride docs)
 * - RideDocumentView (ride detail page)
 * - GlobalDocumentView (global docs page)
 * - Overview / KPIs
 */

import { Tables } from '@/integrations/supabase/types';

export type Document = Tables<'documents'>;

/* ─── Generated vs Uploaded classification ─── */

const GENERATED_TYPES = new Set([
  'daily_check', 'monthly_check', 'yearly_check',
  'check_record', 'safety_check',
  'maintenance_report', 'maintenance_log',
  'risk_assessment',
  'doc', 'declaration_of_compliance',
  'electrical_inspection', 'inservice_inspection',
  'ndt_report', 'ndt_schedule',
  'design_review', 'conformity_design',
  'initial_test_report',
]);

export const isGeneratedDoc = (doc: Document): boolean => {
  const t = (doc.document_type || '').toLowerCase();
  if (GENERATED_TYPES.has(t)) return true;
  if (t.includes('check') && !t.includes('checklist')) return true;
  const fp = (doc.file_path || '').toLowerCase();
  return fp.includes('/checks/') || fp.includes('/compliance/') || fp.includes('/reports/');
};

/* ─── File type detection ─── */

export const isImageFile = (fp: string): boolean =>
  /\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(fp);

export const isPDFFile = (fp: string): boolean =>
  /\.pdf$/i.test(fp);

export const fileExtension = (fp: string): string => {
  const m = fp.match(/\.(\w+)$/);
  return m ? m[1].toUpperCase() : 'FILE';
};

/* ─── Expiry logic (shared across all document views + KPIs) ─── */

export const isDocExpiringSoon = (expiryDate: string): boolean => {
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  return days > 0 && days <= 30;
};

export const isDocExpired = (expiryDate: string): boolean => {
  return new Date(expiryDate) < new Date();
};

export const daysUntilExpiry = (expiryDate: string): number => {
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
};

export const getExpiryLabel = (expiryDate: string): string => {
  const days = daysUntilExpiry(expiryDate);
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
};

/* ─── Friendly type labels ─── */

export const DOC_TYPE_LABELS: Record<string, string> = {
  insurance: 'Insurance',
  safety_certificate: 'Safety Certificate',
  doc_certificate: 'Declaration of Conformity',
  pssr_certificate: 'PSSR Certificate',
  loler_certificate: 'LOLER Certificate',
  puwer_certificate: 'PUWER Certificate',
  risk_assessment: 'Risk Assessment',
  method_statement: 'Method Statement',
  emergency_action_plan: 'Emergency Action Plan',
  evacuation_plan: 'Evacuation Plan',
  certificate: 'Certificate',
  operator_manual: 'Operator Manual',
  controller_manual: 'Controller Manual',
  build_up_down: 'Build Up & Down',
  maintenance_report: 'Maintenance Report',
  maintenance_log: 'Maintenance Log',
  daily_check: 'Daily Check Record',
  monthly_check: 'Monthly Check Record',
  yearly_check: 'Yearly Check Record',
  ndt_report: 'NDT Report',
  ndt_schedule: 'NDT Schedule',
  design_review: 'Design Review',
  conformity_design: 'Conformity to Design',
  initial_test_report: 'Initial Test Report',
  doc: 'DOC Certificate',
  declaration_of_compliance: 'Annual Inspection Certificate',
  electrical_inspection: 'Electrical Inspection',
  inservice_inspection: 'In-Service Inspection',
  manual: 'Manual',
  other: 'Other',
};

export const getDocTypeLabel = (type: string): string =>
  DOC_TYPE_LABELS[type] || type;

/* ─── Document group display categories ─── */

export const getDocGroupCategory = (raw: string): string => {
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
};

/* ─── File size formatting ─── */

export const formatFileSize = (bytes: number): string => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/* ─── Global scope filter categories ─── */

export const GLOBAL_CATEGORY_MAP: Record<string, Set<string>> = {
  insurance: new Set(['insurance']),
  policies: new Set(['risk_assessment', 'method_statement', 'emergency_action_plan', 'evacuation_plan']),
  training: new Set(['certificate', 'safety_certificate']),
  calibration: new Set(['pssr_certificate', 'loler_certificate', 'puwer_certificate']),
};

export const matchesGlobalCategory = (doc: Document, cat: string): boolean => {
  const types = GLOBAL_CATEGORY_MAP[cat];
  if (!types) return true;
  const t = (doc.document_type || '').toLowerCase();
  if (types.has(t)) return true;
  if (cat === 'insurance' && t.includes('insur')) return true;
  if (cat === 'training' && (t.includes('training') || t.includes('cert'))) return true;
  if (cat === 'calibration' && t.includes('calibr')) return true;
  return false;
};
