import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, Download, Trash2, Calendar, AlertTriangle, Link2, History, ChevronDown, Globe, Send, Filter, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { formatDateUK } from '@/utils/dateFormat';
import DocumentRideAssignmentDialog from './DocumentRideAssignmentDialog';
import { SendCheckRecordsDialog } from './SendCheckRecordsDialog';
import { CheckRecordFilters, CheckRecordFiltersState, defaultCheckRecordFilters, isCheckRecord, filterCheckRecords } from './CheckRecordFilters';
import { getSignedStorageUrl } from '@/utils/exportFileActions';
import PDFViewer from '@/components/PDFViewer';
import ImageViewer from '@/components/ImageViewer';

type Document = Tables<'documents'>;

interface DocumentAssignment {
  documentId: string;
  rideNames: string[];
}

interface DocumentListProps {
  rideId?: string;
  rideName?: string;
  isGlobal?: boolean;
  grouped?: boolean;
  showAllDocuments?: boolean;
  excludeGlobal?: boolean; // When true, don't include global docs in ride document lists
  onDocumentDeleted: () => void;
}

const DocumentList = ({ rideId, rideName, isGlobal = false, grouped = false, showAllDocuments = false, excludeGlobal = false, onDocumentDeleted }: DocumentListProps) => {
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [assignmentDialogDoc, setAssignmentDialogDoc] = useState<Document | null>(null);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  
  // Check record filters and send dialog
  const [checkRecordFilters, setCheckRecordFilters] = useState<CheckRecordFiltersState>(defaultCheckRecordFilters);
  const [showCheckRecordFilters, setShowCheckRecordFilters] = useState(false);
  const [sendCheckRecordsOpen, setSendCheckRecordsOpen] = useState(false);
  
  // Pagination for large sections (safety check records)
  const [checkRecordDisplayLimit, setCheckRecordDisplayLimit] = useState(20);
  const CHECK_RECORD_PAGE_SIZE = 20;

  // Viewer state for in-app document viewing
  const [viewerDoc, setViewerDoc] = useState<{ url: string; name: string; type: 'pdf' | 'image' } | null>(null);

  const handleViewDoc = async (doc: Document) => {
    try {
      const signedUrl = await getSignedStorageUrl(doc.file_path);
      if (!signedUrl) throw new Error('Could not get file URL');
      const fp = (doc.file_path || '').toLowerCase();
      if (fp.endsWith('.pdf')) {
        setViewerDoc({ url: signedUrl, name: getDocumentDisplayName(doc), type: 'pdf' });
      } else if (/\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(fp)) {
        setViewerDoc({ url: signedUrl, name: getDocumentDisplayName(doc), type: 'image' });
      } else {
        window.open(signedUrl, '_blank');
      }
    } catch (err: any) {
      toast({ title: 'Failed to open', description: err.message, variant: 'destructive' });
    }
  };

  const handleViewerDownload = async () => {
    if (!viewerDoc) return;
    try {
      const response = await fetch(viewerDoc.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = viewerDoc.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  // Helper to identify image documents
  const isImageDoc = (doc: Document) => {
    const name = (doc.file_path || doc.document_name || '').toLowerCase();
    return /\.(jpg|jpeg|png|gif|bmp|webp|tif|tiff)$/.test(name);
  };

  // Helper to identify PDF documents
  const isPDFDoc = (doc: Document) => {
    const name = (doc.file_path || doc.document_name || '').toLowerCase();
    return name.endsWith('.pdf');
  };


  // Some legacy Safety Check Record PDFs were saved with US date strings in the document_name,
  // e.g. "Preopening Check - 1/27/2026". We can't change the already-generated PDF content,
  // but we can render a UK-friendly display name in the list (and for download/view titles).
  const normalizeLegacyCheckRecordTitle = (name: string): string => {
    // Find a single US-style date fragment anywhere in the title.
    const m = name.match(/^(.*?)(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/);
    if (!m) return name;

    const prefix = m[1];
    const a = Number(m[2]);
    const b = Number(m[3]);
    const year = Number(m[4]);
    const suffix = m[5];

    // Heuristic:
    // - if the "day" part is > 12, it's definitely MM/DD (US)
    // - if the "month" part is > 12, it's definitely DD/MM (already UK)
    if (b > 12 && a >= 1 && a <= 12) {
      const d = new Date(year, a - 1, b);
      return `${prefix}${formatDateUK(d)}${suffix}`;
    }

    if (a > 12 && b >= 1 && b <= 12) {
      const d = new Date(year, b - 1, a);
      return `${prefix}${formatDateUK(d)}${suffix}`;
    }

    // Ambiguous (e.g. 2/11/2026) – don't guess.
    return name;
  };

  const getDocumentDisplayName = (doc: Document) => {
    const raw = doc.document_name || '';
    const isSafetyCheckRecord = isCheckRecord(doc.document_type, doc.file_path);
    if (!isSafetyCheckRecord) return raw;
    return normalizeLegacyCheckRecordTitle(raw);
  };

  useEffect(() => {
    if (effectiveUserId) {
      loadDocuments();
      if (isGlobal) {
        loadAssignments();
      }
    }
  }, [effectiveUserId, rideId, isGlobal]);

  const loadAssignments = async () => {
    if (!effectiveUserId) return;
    try {
      let query = supabase
        .from('document_ride_assignments')
        .select('document_id, rides(ride_name)');
      
      if (!isStaff) {
        query = query.eq('user_id', effectiveUserId);
      }
      
      const { data, error } = await query;

      if (error) throw error;

      const assignmentMap: Record<string, string[]> = {};
      (data || []).forEach((row: any) => {
        const docId = row.document_id;
        const rideName = row.rides?.ride_name;
        if (rideName) {
          if (!assignmentMap[docId]) assignmentMap[docId] = [];
          assignmentMap[docId].push(rideName);
        }
      });

      setAssignments(assignmentMap);
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
  };

  const loadDocuments = async () => {
    try {
      // For staff, don't filter by user_id - RLS handles access
      // For owners, filter by effectiveUserId
      let query = supabase
        .from('documents')
        .select('*')
        .neq('document_type', 'maintenance') // Exclude maintenance attachments - they belong to maintenance section only
        .neq('document_type', 'photo') // Exclude device photos - shown on ride detail only
        .order('uploaded_at', { ascending: false });
      
      if (!isStaff) {
        query = query.eq('user_id', effectiveUserId);
      }

      if (showAllDocuments) {
        // Show all documents - no filter needed
      } else if (rideId) {
        if (excludeGlobal) {
          // Only show documents for this specific ride, exclude global
          query = query.eq('ride_id', rideId);
        } else {
          // Show ride-specific AND global documents
          query = query.or(`ride_id.eq.${rideId},is_global.eq.true`);
        }
      } else if (isGlobal) {
        query = query.eq('is_global', true);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setDocuments(data || []);
      
      // Fetch thumbnails for image documents
      if (data && data.length > 0) {
        const fetchThumbs = async () => {
          try {
            const next: Record<string, string> = {};
            const imageDocs = data.filter(isImageDoc);

            await Promise.all(
              imageDocs.map(async (doc) => {
                const { data: signedData, error } = await supabase
                  .storage
                  .from('ride-documents')
                  .createSignedUrl(doc.file_path, 3600); // 1 hour preview

                if (!error && signedData?.signedUrl) {
                  next[doc.id] = signedData.signedUrl;
                }
              })
            );

            setThumbs(next);
          } catch (e) {
            // Silent fail – fall back to icon
            console.warn('Thumbnail fetch skipped:', e);
          }
        };

        fetchThumbs();
      } else {
        setThumbs({});
      }
    } catch (error: any) {
      console.error('Error loading documents:', error);
      toast({
        title: "Error loading documents",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const handleCopyLink = async (document: Document) => {
    try {
      const signedUrl = await getSignedStorageUrl(document.file_path);
      if (!signedUrl) throw new Error('No signed URL');
      await navigator.clipboard.writeText(signedUrl);
      toast({ title: 'Link copied', description: 'Signed link valid for 1 hour.' });
    } catch {
      toast({ title: 'Copy link failed', description: 'Could not copy link.', variant: 'destructive' });
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const displayName = getDocumentDisplayName(document);
      const { data, error } = await supabase.storage
        .from('ride-documents')
        .download(document.file_path);

      if (error) {
        throw error;
      }

      // Create download link with proper MIME type
      const blob = new Blob([data], { 
        type: document.mime_type || 'application/octet-stream' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = displayName;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: `Downloading ${displayName}`,
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (document: Document) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('ride-documents')
        .remove([document.file_path]);

      if (storageError) {
        throw storageError;
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (dbError) {
        throw dbError;
      }

      toast({
        title: "Document deleted",
        description: `${document.document_name} has been deleted`,
      });

      onDocumentDeleted();
      loadDocuments();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleGlobal = async (document: Document) => {
    try {
      const newGlobalStatus = !document.is_global;
      
      const { error } = await supabase
        .from('documents')
        .update({ 
          is_global: newGlobalStatus,
          // If making global, clear ride_id; if making ride-specific, keep current ride_id
          ride_id: newGlobalStatus ? null : (document.ride_id || rideId)
        })
        .eq('id', document.id);

      if (error) throw error;

      toast({
        title: newGlobalStatus ? "Document is now Global" : "Document is now Ride-Specific",
        description: newGlobalStatus 
          ? "This document will appear on all your devices" 
          : "This document is now specific to this device only",
      });

      loadDocuments();
    } catch (error: any) {
      console.error('Toggle global error:', error);
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    return expiry < today;
  };

  const getDocumentTypeDisplay = (type: string) => {
    const types: Record<string, string> = {
      doc: '📜 DOC Certificate',
      declaration_of_compliance: '📜 Annual Inspection Certificate',
      electrical_inspection: 'Electrical Inspection Report',
      inservice_inspection: 'In-Service Inspection Report',
      initial_test_report: 'Initial Test Report',
      daily_check: 'Daily Check Record',
      monthly_check: 'Monthly Check Record',
      yearly_check: 'Yearly Check Record',
      ndt_schedule: 'NDT Schedule',
      ndt_report: 'NDT Report',
      design_review: 'Design Review Report',
      conformity_design: 'Conformity to Design',
      risk_assessment: 'Risk Assessment',
      method_statement: 'Method Statement',
      safety: 'Safety',
      maintenance: 'Maintenance',
      maintenance_report: 'Maintenance Report',
      maintenance_log: 'Maintenance Log',
      inspection: 'Inspection',
      manual: 'Manual',
      operator_manual: 'Operator Manual',
      controller_manual: 'Controller Manual',
      build_up_down: 'Build Up & Down Procedure',
      emergency_action_plan: 'Emergency Action Plan',
      evacuation_plan: 'Evacuation Plan',
      insurance: '🛡️ Insurance',
      safety_certificate: '🏅 Safety Certificate',
      doc_certificate: '📋 Declaration of Conformity',
      pssr_certificate: '⚙️ PSSR Certificate',
      loler_certificate: '🏗️ LOLER Certificate',
      puwer_certificate: '🔧 PUWER Certificate',
      certificate: 'Certificate',
      photo: 'Device Photo',
      other: 'Other'
    };
    return types[type] || type;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const prettyType = (raw: string) => {
    const t = raw.trim().toLowerCase();
    
    // Inspection Reports
    if (t === 'doc' || t === 'declaration_of_compliance') return "📜 Inspection Reports";
    if (t === 'electrical_inspection' || t === 'inservice_inspection' || t === 'initial_test_report') return "📜 Inspection Reports";
    
    // Checks
    if (t === 'check record' || t === 'check_record' || t.includes('safety check')) return "✅ Check Records";
    if (t === 'daily_check' || t === 'monthly_check' || t === 'yearly_check') return "✅ Check Records";
    
    // NDT
    if (t === 'ndt_schedule') return "🔬 NDT";
    if (t === 'ndt_report' || t === 'ndt_inspection') return "🔬 NDT";
    
    // Design & Review
    if (t === 'design_review' || t === 'conformity_design') return "📐 Design & Review";
    
    // Risk Assessments
    if (t === 'risk_assessment' || t.includes('risk')) return "⚠️ Risk Assessments";
    if (t === 'method_statement' || t.includes('method')) return "⚠️ Risk Assessments";
    
    // Maintenance
    if (t === 'maintenance_report' || t === 'maintenance_log' || t === 'maintenance') return "🔧 Maintenance";
    
    // Manuals & Procedures
    if (t === 'operator_manual' || t === 'controller_manual' || t === 'build_up_down') return "📖 Manuals & Procedures";
    if (t === 'emergency_action_plan' || t === 'evacuation_plan') return "📖 Manuals & Procedures";
    
    // Insurance & Certificates
    if (t.includes('insur')) return "🛡️ Insurance & Certificates";
    if (t.includes('cert') || t === 'certificate') return "🛡️ Insurance & Certificates";
    
    // Other
    if (t === 'photo' || t.includes('photo')) return "📸 Device Photos";
    return "📁 Other";
  };

  // Group documents by name to detect versions
  interface DocumentGroup {
    latestDoc: Document;
    olderVersions: Document[];
  }

  const groupDocumentsByName = (docs: Document[]): DocumentGroup[] => {
    const nameGroups: Record<string, Document[]> = {};
    
    docs.forEach(doc => {
      // Create a key from document name + type for grouping versions
      const key = `${doc.document_name}__${doc.document_type}`;
      if (!nameGroups[key]) nameGroups[key] = [];
      nameGroups[key].push(doc);
    });

    // Sort each group by upload date (newest first) and create DocumentGroup objects
    return Object.values(nameGroups).map(group => {
      const sorted = group.sort((a, b) => 
        new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
      );
      return {
        latestDoc: sorted[0],
        olderVersions: sorted.slice(1)
      };
    });
  };

  // Category colour coding config
  const CATEGORY_STYLES: Record<string, { iconBg: string; iconColor: string; borderColor: string }> = {
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

  const groupByType = (docs: Document[]) => {
    const ORDER = [
      "📜 Inspection Reports",
      "✅ Check Records", 
      "🔬 NDT",
      "📐 Design & Review",
      "⚠️ Risk Assessments",
      "🔧 Maintenance",
      "📖 Manuals & Procedures",
      "🛡️ Insurance & Certificates",
      "📸 Device Photos",
      "📁 Other"
    ];
    const groups: Record<string, DocumentGroup[]> = {};
    
    // When isGlobal is true, we're showing ONLY global docs - don't separate them
    // When showing ride docs, separate global from ride-specific
    const globalDocs: Document[] = [];
    const rideDocs: Document[] = [];
    
    if (isGlobal) {
      // All docs are global, group by document type instead
      docs.forEach(d => rideDocs.push(d)); // Treat as regular docs for grouping by type
    } else {
      docs.forEach(d => {
        if (d.is_global) {
          globalDocs.push(d);
        } else {
          rideDocs.push(d);
        }
      });
    }
    
    // Group documents by type, then by name for versions
    const rideDocGroups = groupDocumentsByName(rideDocs);
    rideDocGroups.forEach(docGroup => {
      const k = prettyType(docGroup.latestDoc.document_type);
      (groups[k] ||= []).push(docGroup);
    });
    
    const keys = Object.keys(groups).sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    
    const result = keys.map(k => ({ type: k, items: groups[k] }));
    
    // Add global documents at the top if they exist (only when showing ride docs, not when isGlobal)
    if (!isGlobal && globalDocs.length > 0) {
      const globalDocGroups = groupDocumentsByName(globalDocs);
      result.unshift({ type: "🌐 Global Documents", items: globalDocGroups });
    }
    
    return result;
  };

  // Get all older versions across all document groups
  const getAllOlderVersions = (): Document[] => {
    const allDocGroups = groupDocumentsByName(documents);
    return allDocGroups.flatMap(group => group.olderVersions);
  };

  // Calculate storage used by older versions
  const getOlderVersionsStorageSize = (): number => {
    const olderVersions = getAllOlderVersions();
    return olderVersions.reduce((sum, doc) => sum + (doc.file_size || 0), 0);
  };

  // Clean up all older versions
  const handleCleanupOldVersions = async () => {
    const olderVersions = getAllOlderVersions();
    if (olderVersions.length === 0) return;

    setCleaningUp(true);
    try {
      // Delete from storage
      const filePaths = olderVersions.map(doc => doc.file_path);
      const { error: storageError } = await supabase.storage
        .from('ride-documents')
        .remove(filePaths);

      if (storageError) throw storageError;

      // Delete from database
      const docIds = olderVersions.map(doc => doc.id);
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .in('id', docIds);

      if (dbError) throw dbError;

      const freedSpace = formatFileSize(getOlderVersionsStorageSize());
      
      toast({
        title: "Old versions cleaned up",
        description: `Removed ${olderVersions.length} older version${olderVersions.length !== 1 ? 's' : ''}, freeing ${freedSpace}`,
      });

      setCleanupDialogOpen(false);
      onDocumentDeleted();
      loadDocuments();
    } catch (error: any) {
      console.error('Cleanup error:', error);
      toast({
        title: "Cleanup failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCleaningUp(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8">
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-info to-primary mx-auto flex items-center justify-center mb-3">
            <FileText className="h-7 w-7 text-white animate-pulse" />
          </div>
          <p className="text-muted-foreground mt-2 font-medium">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="py-12">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-info/20 mx-auto flex items-center justify-center mb-4">
            <FileText className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mt-4">No files yet</h3>
          <p className="text-muted-foreground">
            Press Add a document to upload files{rideName ? ` for ${rideName}` : ''}
          </p>
        </div>
      </div>
    );
  }

  // Grouped render for mobile-first clarity
  // Component to render a single document row
  const DocumentRow = ({ doc, isOlderVersion = false, hasMultipleVersions = false }: { doc: Document; isOlderVersion?: boolean; hasMultipleVersions?: boolean }) => {
    const displayName = getDocumentDisplayName(doc);
    const expired = doc.expires_at && isExpired(doc.expires_at);
    const expiringSoon = doc.expires_at && !expired && isExpiringSoon(doc.expires_at);
    const uploadedStr = new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const sizeStr = doc.file_size ? formatFileSize(doc.file_size) : null;

    return (
      <div className={`flex items-center gap-3 px-3 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors min-w-0 ${isOlderVersion ? 'opacity-70' : ''}`}>
        {/* File icon / thumbnail */}
        <div className="shrink-0">
          {thumbs[doc.id] ? (
            <img
              src={thumbs[doc.id]}
              alt={displayName}
              className="w-10 h-10 object-cover rounded-lg border border-slate-200"
            />
          ) : (
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200">
              <FileText className="w-5 h-5 text-slate-600" />
            </div>
          )}
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {doc.is_global && !isOlderVersion && <Globe className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
            <p className="text-sm font-semibold text-slate-900 truncate" title={displayName}>
              {isOlderVersion
                ? `📅 ${new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : displayName}
            </p>
            {hasMultipleVersions && !isOlderVersion && (
              <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">Latest</span>
            )}
          </div>
          {/* Compliance subtitle: document ID + inspector + reference parsed from notes */}
          {!isOlderVersion && (() => {
            // Extract full_document_id from document_name prefix (e.g. "TC-CR-2026-0004 – ...")
            const docIdMatch = doc.document_name?.match(/^([A-Z0-9]+-CR-\d{4}-\d{4})/);
            const fullDocId = docIdMatch ? docIdMatch[1] : null;
            
            const parts: string[] = [];
            if (fullDocId) parts.push(fullDocId);
            
            if (doc.notes) {
              const lines = doc.notes.split('\n');
              const inspectorLine = lines.find(l => l.startsWith('Inspector: '));
              const refLine = lines.find(l => l.startsWith('Ref: '));
              if (rideName && !fullDocId) parts.push(rideName);
              if (inspectorLine) parts.push(inspectorLine);
              if (refLine) parts.push(refLine);
            }
            
            if (parts.length === 0) return null;
            return (
              <p className="text-xs text-muted-foreground truncate mt-0.5" title={parts.join(' • ')}>
                {fullDocId && <span className="font-mono font-semibold text-primary mr-1">{fullDocId}</span>}
                {parts.slice(fullDocId ? 1 : 0).join(' • ')}
              </p>
            );
          })()}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {!isOlderVersion && (
              <span className="text-xs text-slate-500">{uploadedStr}</span>
            )}
            {sizeStr && <span className="text-xs text-slate-400">• {sizeStr}</span>}
            {/* Expiry badge */}
            {doc.expires_at && !isOlderVersion && (
              expired ? (
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">Expired</span>
              ) : expiringSoon ? (
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">Expires soon</span>
              ) : (
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">Valid</span>
              )
            )}
          </div>
        </div>

        {/* Actions — canonical pattern */}
        <DocumentRowActions
          onView={() => handleViewDoc(doc)}
          onDownload={() => handleDownload(doc)}
          onCopyLink={() => handleCopyLink(doc)}
          onDelete={!isOlderVersion ? () => handleDelete(doc) : undefined}
        />
      </div>
    );
  };

  if (grouped) {
    const groupedDocs = groupByType(documents);
    const olderVersionsCount = getAllOlderVersions().length;
    const olderVersionsSize = getOlderVersionsStorageSize();
    
    return (
      <>
        
        {/* Send Check Records Dialog */}
        <SendCheckRecordsDialog
          isOpen={sendCheckRecordsOpen}
          onClose={() => setSendCheckRecordsOpen(false)}
          rideId={rideId}
          rideName={rideName}
        />
        
        {/* Cleanup old versions dialog */}
        <AlertDialog open={cleanupDialogOpen} onOpenChange={setCleanupDialogOpen}>
          <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Clean Up Old Versions</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {olderVersionsCount} older document version{olderVersionsCount !== 1 ? 's' : ''}, 
                freeing up {formatFileSize(olderVersionsSize)} of storage. Latest versions will be kept.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cleaningUp}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCleanupOldVersions}
                disabled={cleaningUp}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {cleaningUp ? 'Cleaning up...' : 'Delete Old Versions'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        <div className="space-y-6 pb-24 md:pb-0">
        {/* Cleanup button - only show if there are old versions */}
        {olderVersionsCount > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border/60">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <History className="h-4 w-4" />
              <span>{olderVersionsCount} older version{olderVersionsCount !== 1 ? 's' : ''} ({formatFileSize(olderVersionsSize)})</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCleanupDialogOpen(true)}
              className="gap-1.5 text-xs h-8"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clean up
            </Button>
          </div>
        )}
        {groupedDocs.map((g, groupIdx) => {
          // Use consistent color for all document type groups
          const isGlobalSection = g.type === "🌐 Global Documents";
          const isCheckRecordSection = g.type === "✅ Safety Check Records";
          
          // Apply filters to check record sections
          let displayItems = g.items;
          if (isCheckRecordSection && (checkRecordFilters.dateFrom || checkRecordFilters.dateTo || checkRecordFilters.checkType !== 'all' || checkRecordFilters.searchQuery)) {
            // Flatten, filter, then re-group
            const allDocs = g.items.flatMap(docGroup => [docGroup.latestDoc, ...docGroup.olderVersions]);
            const filteredDocs = filterCheckRecords(allDocs, checkRecordFilters);
            displayItems = groupDocumentsByName(filteredDocs);
          }
          
          // Count total documents including versions (for original or filtered)
          const totalDocs = displayItems.reduce((sum, docGroup) => sum + 1 + docGroup.olderVersions.length, 0);
          const originalTotal = g.items.reduce((sum, docGroup) => sum + 1 + docGroup.olderVersions.length, 0);
          const isFiltered = isCheckRecordSection && totalDocs !== originalTotal;
          
          const catStyle = CATEGORY_STYLES[g.type] || CATEGORY_STYLES["📁 Other"];
          return (
            <section key={g.type} className="space-y-0">
              {/* Category card */}
              <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden`}>
                {/* Category header */}
                <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-100`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 ${catStyle.iconBg} rounded-lg flex items-center justify-center shrink-0 border ${catStyle.borderColor}`}>
                      <FileText className={`w-5 h-5 ${catStyle.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-slate-900 font-semibold text-sm">{g.type}</h3>
                      <p className="text-xs text-slate-500">{isFiltered ? `${totalDocs} of ${originalTotal}` : `${totalDocs} file${totalDocs !== 1 ? 's' : ''}`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isCheckRecordSection && originalTotal >= 5 && (
                      <>
                        <button
                          className="text-slate-500 text-xs font-medium hover:text-slate-900 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100"
                          onClick={() => setShowCheckRecordFilters(!showCheckRecordFilters)}
                        >
                          <Filter className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Filter</span>
                        </button>
                        <button
                          className="text-slate-500 text-xs font-medium hover:text-slate-900 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100"
                          onClick={() => setSendCheckRecordsOpen(true)}
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Send</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Check record filters (inside card) */}
                {isCheckRecordSection && showCheckRecordFilters && (
                  <div className="px-4 py-3 border-b border-slate-100">
                    <CheckRecordFilters
                      filters={checkRecordFilters}
                      onFiltersChange={(newFilters) => {
                        setCheckRecordFilters(newFilters);
                        setCheckRecordDisplayLimit(CHECK_RECORD_PAGE_SIZE);
                      }}
                      onClear={() => {
                        setCheckRecordFilters(defaultCheckRecordFilters);
                        setCheckRecordDisplayLimit(CHECK_RECORD_PAGE_SIZE);
                      }}
                      documentCount={originalTotal}
                      filteredCount={totalDocs}
                    />
                  </div>
                )}

                {/* File rows */}
                {displayItems.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    No records match your filters
                  </div>
                ) : (
                  <>
                    {(() => {
                      const itemsToShow = isCheckRecordSection
                        ? displayItems.slice(0, checkRecordDisplayLimit)
                        : displayItems;
                      const hasMore = isCheckRecordSection && displayItems.length > checkRecordDisplayLimit;
                      const remainingCount = displayItems.length - checkRecordDisplayLimit;

                      return (
                        <>
                          <div className="divide-y divide-slate-100">
                            {itemsToShow.map(docGroup => (
                              <div key={docGroup.latestDoc.id}>
                                <DocumentRow doc={docGroup.latestDoc} hasMultipleVersions={docGroup.olderVersions.length > 0} />
                                {docGroup.olderVersions.length > 0 && (
                                  <Collapsible>
                                    <CollapsibleTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start gap-2 h-8 text-xs text-slate-500 hover:text-slate-900 ml-14 pl-0"
                                      >
                                        <History className="h-3.5 w-3.5" />
                                        <span>{docGroup.olderVersions.length} older version{docGroup.olderVersions.length !== 1 ? 's' : ''}</span>
                                        <ChevronDown className="h-3.5 w-3.5 ml-auto transition-transform group-data-[state=open]:rotate-180" />
                                      </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="border-l-2 border-slate-100 ml-14">
                                      {docGroup.olderVersions.map(olderDoc => (
                                        <DocumentRow key={olderDoc.id} doc={olderDoc} isOlderVersion />
                                      ))}
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}
                              </div>
                            ))}
                          </div>

                          {hasMore && (
                            <div className="flex justify-center py-4 border-t border-slate-100">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCheckRecordDisplayLimit(prev => prev + CHECK_RECORD_PAGE_SIZE)}
                                className="gap-2 text-slate-700"
                              >
                                <ChevronDown className="h-4 w-4" />
                                Load {Math.min(remainingCount, CHECK_RECORD_PAGE_SIZE)} more
                                <span className="text-slate-400">({remainingCount} remaining)</span>
                              </Button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </div>{/* end card */}
            </section>
          );
        })}
        </div>

        {/* In-app viewers */}
        {viewerDoc?.type === 'pdf' && (
          <PDFViewer
            isOpen={true}
            onClose={() => setViewerDoc(null)}
            pdfUrl={viewerDoc.url}
            title={viewerDoc.name}
            onDownload={handleViewerDownload}
          />
        )}
        {viewerDoc?.type === 'image' && (
          <ImageViewer
            isOpen={true}
            onClose={() => setViewerDoc(null)}
            imageUrl={viewerDoc.url}
            imageName={viewerDoc.name}
            onDownload={handleViewerDownload}
          />
        )}
      </>
    );
  }

  // Flat list (default)
  return (
    <>
      <DocumentRideAssignmentDialog
        document={assignmentDialogDoc}
        isOpen={!!assignmentDialogDoc}
        onClose={() => setAssignmentDialogDoc(null)}
        onAssignmentsChanged={loadAssignments}
      />
      <div className="space-y-4 pb-24 md:pb-0">
        <Card className="border-2 border-primary/20 shadow-card">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-info/5 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>
                {isGlobal ? 'Global Documents' : 'Ride Documents'} ({documents.length})
              </CardTitle>
              <CardDescription>
                {isGlobal 
                  ? 'Documents that apply to all your rides'
                  : 'Documents specific to this ride'
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            {documents.map((doc) => (
              <div 
                key={doc.id} 
                className="flex flex-col gap-2 p-3 border-2 border-border/60 rounded-xl hover:border-primary/30 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent active:scale-[0.99] transition-all min-w-0 bg-card"
              >
                {/* Row 1: Thumbnail + Name + Type badge */}
                <div className="flex items-start gap-3 min-w-0">
                  {/* Thumbnail */}
                  <div 
                    className="shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-info/10 border border-primary/20 flex items-center justify-center"
                  >
                    {thumbs[doc.id] ? (
                      <img
                        src={thumbs[doc.id]}
                        alt={doc.document_name}
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                    ) : (
                      <FileText className="h-5 w-5 text-primary" />
                    )}
                  </div>

                  {/* Content - takes remaining space */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <h4 className="text-sm font-medium break-words line-clamp-2" title={doc.document_name}>
                      {doc.document_name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-muted-foreground">
                      <span>{getDocumentTypeDisplay(doc.document_type)}</span>
                      <span className="opacity-50">•</span>
                      <span>{formatFileSize(doc.file_size || 0)}</span>
                      {doc.expires_at && (
                        <>
                          <span className="opacity-50">•</span>
                          <span className={`flex items-center gap-0.5 ${
                            isExpired(doc.expires_at) ? 'text-destructive' :
                            isExpiringSoon(doc.expires_at) ? 'text-yellow-600' :
                            ''
                          }`}>
                            {isExpired(doc.expires_at) && <AlertTriangle className="h-3 w-3" />}
                            {new Date(doc.expires_at).toLocaleDateString('en-GB')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: Actions — canonical pattern */}
                <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40">
                  <DocumentRowActions
                    onView={() => handleViewDoc(doc)}
                    onDownload={() => handleDownload(doc)}
                    onCopyLink={() => handleCopyLink(doc)}
                    onDelete={() => handleDelete(doc)}
                  />
                </div>
                
                {/* Show assigned items for global documents */}
                {isGlobal && assignments[doc.id] && assignments[doc.id].length > 0 && (
                  <div className="flex items-center gap-2 pl-15 ml-12">
                    <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[11px] text-muted-foreground">
                      Covers: {assignments[doc.id].slice(0, 3).join(', ')}
                      {assignments[doc.id].length > 3 && ` +${assignments[doc.id].length - 3} more`}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>

      {/* In-app viewers */}
      {viewerDoc?.type === 'pdf' && (
        <PDFViewer
          isOpen={true}
          onClose={() => setViewerDoc(null)}
          pdfUrl={viewerDoc.url}
          title={viewerDoc.name}
          onDownload={handleViewerDownload}
        />
      )}
      {viewerDoc?.type === 'image' && (
        <ImageViewer
          isOpen={true}
          onClose={() => setViewerDoc(null)}
          imageUrl={viewerDoc.url}
          imageName={viewerDoc.name}
          onDownload={handleViewerDownload}
        />
      )}
    </>
  );
};

export default DocumentList;