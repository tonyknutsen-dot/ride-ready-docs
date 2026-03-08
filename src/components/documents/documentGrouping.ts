/**
 * Shared document grouping and version detection logic.
 * Extracted from DocumentList for reuse and maintainability.
 */
import { Tables } from '@/integrations/supabase/types';
import { getDocGroupCategory } from '@/utils/documentHelpers';

type Document = Tables<'documents'>;

export interface DocumentGroup {
  latestDoc: Document;
  olderVersions: Document[];
}

/** Group documents by name+type, returning latest + older versions per group. */
export const groupDocumentsByName = (docs: Document[]): DocumentGroup[] => {
  const nameGroups: Record<string, Document[]> = {};
  
  docs.forEach(doc => {
    const key = `${doc.document_name}__${doc.document_type}`;
    if (!nameGroups[key]) nameGroups[key] = [];
    nameGroups[key].push(doc);
  });

  return Object.values(nameGroups).map(group => {
    const sorted = group.sort((a, b) => 
      new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    );
    return {
      latestDoc: sorted[0],
      olderVersions: sorted.slice(1),
    };
  });
};

/** Category display order for grouped document view. */
export const CATEGORY_ORDER = [
  "📜 Inspection Reports",
  "✅ Check Records",
  "🔬 NDT",
  "📐 Design & Review",
  "⚠️ Risk Assessments",
  "🔧 Maintenance",
  "📖 Manuals & Procedures",
  "🛡️ Insurance & Certificates",
  "📸 Device Photos",
  "📁 Other",
];

/** Category colour coding config for grouped document sections. */
export const CATEGORY_STYLES: Record<string, { iconBg: string; iconColor: string; borderColor: string }> = {
  "🌐 Global Documents":        { iconBg: "bg-blue-100",   iconColor: "text-blue-700",   borderColor: "border-blue-200" },
  "📜 Inspection Reports":      { iconBg: "bg-indigo-100", iconColor: "text-indigo-700", borderColor: "border-indigo-200" },
  "✅ Check Records":           { iconBg: "bg-emerald-100",iconColor: "text-emerald-700",borderColor: "border-emerald-200" },
  "🔬 NDT":                     { iconBg: "bg-purple-100", iconColor: "text-purple-700", borderColor: "border-purple-200" },
  "📐 Design & Review":         { iconBg: "bg-sky-100",    iconColor: "text-sky-700",    borderColor: "border-sky-200" },
  "⚠️ Risk Assessments":        { iconBg: "bg-amber-100",  iconColor: "text-amber-700",  borderColor: "border-amber-200" },
  "🔧 Maintenance":             { iconBg: "bg-green-100",  iconColor: "text-green-700",  borderColor: "border-green-200" },
  "📖 Manuals & Procedures":    { iconBg: "bg-slate-100",  iconColor: "text-slate-700",  borderColor: "border-slate-200" },
  "🛡️ Insurance & Certificates":{ iconBg: "bg-teal-100",   iconColor: "text-teal-700",   borderColor: "border-teal-200" },
  "📸 Device Photos":           { iconBg: "bg-pink-100",   iconColor: "text-pink-700",   borderColor: "border-pink-200" },
  "📁 Other":                   { iconBg: "bg-slate-100",  iconColor: "text-slate-600",  borderColor: "border-slate-200" },
};

/**
 * Group documents by type category, with globals separated when appropriate.
 */
export const groupByType = (docs: Document[], isGlobal: boolean) => {
  const groups: Record<string, DocumentGroup[]> = {};
  
  const globalDocs: Document[] = [];
  const rideDocs: Document[] = [];
  
  if (isGlobal) {
    docs.forEach(d => rideDocs.push(d));
  } else {
    docs.forEach(d => {
      if (d.is_global) {
        globalDocs.push(d);
      } else {
        rideDocs.push(d);
      }
    });
  }
  
  const rideDocGroups = groupDocumentsByName(rideDocs);
  rideDocGroups.forEach(docGroup => {
    const k = getDocGroupCategory(docGroup.latestDoc.document_type);
    (groups[k] ||= []).push(docGroup);
  });
  
  const keys = Object.keys(groups).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  
  const result = keys.map(k => ({ type: k, items: groups[k] }));
  
  if (!isGlobal && globalDocs.length > 0) {
    const globalDocGroups = groupDocumentsByName(globalDocs);
    result.unshift({ type: "🌐 Global Documents", items: globalDocGroups });
  }
  
  return result;
};

/** Get all older versions across all document groups. */
export const getAllOlderVersions = (docs: Document[]): Document[] => {
  const allDocGroups = groupDocumentsByName(docs);
  return allDocGroups.flatMap(group => group.olderVersions);
};

/** Calculate storage used by older versions. */
export const getOlderVersionsStorageSize = (docs: Document[]): number => {
  const olderVersions = getAllOlderVersions(docs);
  return olderVersions.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
};
