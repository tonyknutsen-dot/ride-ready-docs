import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, Download, Trash2, Calendar, AlertTriangle, Eye, Link2, History, ChevronDown, Globe, Send, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import ImageViewer from './ImageViewer';
import PDFViewer from './PDFViewer';
import DocumentRideAssignmentDialog from './DocumentRideAssignmentDialog';
import { SendCheckRecordsDialog } from './SendCheckRecordsDialog';
import { CheckRecordFilters, CheckRecordFiltersState, defaultCheckRecordFilters, isCheckRecord, filterCheckRecords } from './CheckRecordFilters';

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
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [assignmentDialogDoc, setAssignmentDialogDoc] = useState<Document | null>(null);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [viewerState, setViewerState] = useState<{
    type: 'image' | 'pdf' | null;
    url: string;
    name: string;
    document: Document | null;
  }>({ type: null, url: '', name: '', document: null });
  
  // Check record filters and send dialog
  const [checkRecordFilters, setCheckRecordFilters] = useState<CheckRecordFiltersState>(defaultCheckRecordFilters);
  const [showCheckRecordFilters, setShowCheckRecordFilters] = useState(false);
  const [sendCheckRecordsOpen, setSendCheckRecordsOpen] = useState(false);
  
  // Pagination for large sections (safety check records)
  const [checkRecordDisplayLimit, setCheckRecordDisplayLimit] = useState(20);
  const CHECK_RECORD_PAGE_SIZE = 20;

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

  // Helper to check if document is viewable
  const isViewable = (doc: Document) => {
    return isImageDoc(doc) || isPDFDoc(doc);
  };

  useEffect(() => {
    if (user) {
      loadDocuments();
      if (isGlobal) {
        loadAssignments();
      }
    }
  }, [user, rideId, isGlobal]);

  const loadAssignments = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('document_ride_assignments')
        .select('document_id, rides(ride_name)')
        .eq('user_id', user.id);

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
      let query = supabase
        .from('documents')
        .select('*')
        .eq('user_id', user?.id)
        .neq('document_type', 'maintenance') // Exclude maintenance attachments - they belong to maintenance section only
        .order('uploaded_at', { ascending: false });

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

  const handleView = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('ride-documents')
        .createSignedUrl(document.file_path, 3600); // 1 hour

      if (error) throw error;

      if (data?.signedUrl) {
        if (isImageDoc(document)) {
          setViewerState({
            type: 'image',
            url: data.signedUrl,
            name: document.document_name,
            document
          });
        } else if (isPDFDoc(document)) {
          setViewerState({
            type: 'pdf',
            url: data.signedUrl,
            name: document.document_name,
            document
          });
        }
      }
    } catch (error: any) {
      console.error('View error:', error);
      toast({
        title: "Unable to view document",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (document: Document) => {
    try {
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
      a.download = document.document_name;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: `Downloading ${document.document_name}`,
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
      safety: 'Safety',
      maintenance: 'Maintenance',
      inspection: 'Inspection',
      manual: 'Manual',
      insurance: 'Insurance',
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
    if (t === 'doc') return "📜 DOC Certificate";
    if (t === 'check record' || t === 'check_record' || t.includes('safety check')) return "✅ Safety Check Records";
    if (t === 'risk_assessment' || t.includes('risk')) return "Risk Assessment (RA)";
    if (t === 'method_statement' || t.includes('method')) return "Method Statement";
    if (t === 'maintenance_report') return "Maintenance Report";
    if (t.includes('insur')) return "Insurance";
    if (t.includes('cert')) return "Certificate";
    if (t === 'photo' || t.includes('photo')) return "Device Photo";
    return "Other";
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

  const groupByType = (docs: Document[]) => {
    const ORDER = ["📜 DOC Certificate", "✅ Safety Check Records", "Risk Assessment (RA)", "Method Statement", "Insurance", "Certificate", "Device Photo", "Other"];
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
  const DocumentRow = ({ doc, isOlderVersion = false, hasMultipleVersions = false }: { doc: Document; isOlderVersion?: boolean; hasMultipleVersions?: boolean }) => (
    <div className={`border-2 rounded-2xl p-3 flex items-start gap-3 transition-all min-w-0 bg-card ${
      isOlderVersion 
        ? 'border-border/40 opacity-75 hover:opacity-100' 
        : 'border-border/60 hover:border-primary/30 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent shadow-sm'
    }`}>
      <div className="shrink-0">
        {thumbs[doc.id] ? (
          <img
            src={thumbs[doc.id]}
            alt={doc.document_name}
            className={`rounded-xl object-cover border-2 border-primary/20 cursor-pointer shadow-sm hover:shadow-md transition-shadow ${
              isOlderVersion ? 'w-10 h-10' : 'w-12 h-12'
            }`}
            onClick={() => handleView(doc)}
          />
        ) : (
          <div className={`rounded-xl bg-gradient-to-br from-primary/10 to-info/10 flex items-center justify-center border border-primary/20 ${
            isOlderVersion ? 'w-10 h-10' : 'w-12 h-12'
          }`}>
            <FileText className={isOlderVersion ? 'w-4 h-4 text-primary' : 'w-5 h-5 text-primary'} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate flex items-center gap-2 ${isOlderVersion ? 'text-sm' : 'text-[15px]'}`} title={doc.document_name}>
          {isOlderVersion ? (
            <span className="text-muted-foreground">
              📅 {new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          ) : (
            <>
              {doc.is_global && (
                <Globe className="h-4 w-4 text-info shrink-0" />
              )}
              <span className="truncate">{doc.document_name}</span>
              {hasMultipleVersions && (
                <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary text-[10px] px-1.5 py-0">
                  Latest
                </Badge>
              )}
            </>
          )}
        </div>
        <div className="text-xs text-muted-foreground break-words">
          {doc.expires_at && <span>Expires {new Date(doc.expires_at).toLocaleDateString('en-GB')}</span>}
          {!isOlderVersion && <span> • Uploaded {new Date(doc.uploaded_at).toLocaleDateString('en-GB')}</span>}
        </div>
        {doc.notes && !isOlderVersion && (
          <p className="text-xs text-muted-foreground mt-1 break-words">{doc.notes}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1 shrink-0">
        {/* Toggle global/ride-specific - hide for document types that are always ride-specific */}
        {!isOlderVersion && !['photo', 'device_photo', 'maintenance', 'check record', 'check_record'].includes(doc.document_type.toLowerCase()) && !doc.file_path?.includes('/check-records/') && (
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-8 w-8 p-0 ${doc.is_global ? 'text-info' : 'text-muted-foreground'}`}
            onClick={() => handleToggleGlobal(doc)}
            title={doc.is_global ? "Click to make ride-specific" : "Click to make global (all devices)"}
          >
            <Globe className="h-4 w-4" />
          </Button>
        )}
        {isViewable(doc) && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleView(doc)}>
            <Eye className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDownload(doc)}>
          <Download className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Document</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{doc.document_name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDelete(doc)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );

  if (grouped) {
    const groupedDocs = groupByType(documents);
    const olderVersionsCount = getAllOlderVersions().length;
    const olderVersionsSize = getOlderVersionsStorageSize();
    
    return (
      <>
        <ImageViewer
          isOpen={viewerState.type === 'image'}
          onClose={() => setViewerState({ type: null, url: '', name: '', document: null })}
          imageUrl={viewerState.url}
          imageName={viewerState.name}
          onDownload={() => viewerState.document && handleDownload(viewerState.document)}
        />
        <PDFViewer
          isOpen={viewerState.type === 'pdf'}
          onClose={() => setViewerState({ type: null, url: '', name: '', document: null })}
          pdfUrl={viewerState.url}
          pdfName={viewerState.name}
          onDownload={() => viewerState.document && handleDownload(viewerState.document)}
        />
        
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
          
          return (
            <section key={g.type} className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center`}>
                    <FileText className="w-3.5 h-3.5 text-white" />
                  </span>
                  {g.type}
                </h3>
                <div className="flex items-center gap-2">
                  {isCheckRecordSection && originalTotal >= 5 && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setShowCheckRecordFilters(!showCheckRecordFilters)}
                      >
                        <Filter className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Filter</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setSendCheckRecordsOpen(true)}
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Send</span>
                      </Button>
                    </>
                  )}
                  <span className="text-xs px-3 py-1 rounded-full border font-medium bg-primary/10 text-primary border-primary/30">
                    {isFiltered ? `${totalDocs} of ${originalTotal}` : `${totalDocs} file${totalDocs !== 1 ? "s" : ""}`}
                  </span>
                </div>
              </div>
              
              {/* Check record filters */}
              {isCheckRecordSection && showCheckRecordFilters && (
                <CheckRecordFilters
                  filters={checkRecordFilters}
                  onFiltersChange={(newFilters) => {
                    setCheckRecordFilters(newFilters);
                    setCheckRecordDisplayLimit(CHECK_RECORD_PAGE_SIZE); // Reset pagination on filter change
                  }}
                  onClear={() => {
                    setCheckRecordFilters(defaultCheckRecordFilters);
                    setCheckRecordDisplayLimit(CHECK_RECORD_PAGE_SIZE); // Reset pagination on clear
                  }}
                  documentCount={originalTotal}
                  filteredCount={totalDocs}
                />
              )}
              
              {displayItems.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No records match your filters
                </div>
              ) : (
                <>
                  {/* Pagination for check records - only show limited items */}
                  {(() => {
                    const itemsToShow = isCheckRecordSection 
                      ? displayItems.slice(0, checkRecordDisplayLimit)
                      : displayItems;
                    const hasMore = isCheckRecordSection && displayItems.length > checkRecordDisplayLimit;
                    const remainingCount = displayItems.length - checkRecordDisplayLimit;
                    
                    return (
                      <>
                        <div className="grid grid-cols-1 gap-3">
                          {itemsToShow.map(docGroup => (
                            <div key={docGroup.latestDoc.id} className="space-y-2">
                              {/* Latest version */}
                              <DocumentRow doc={docGroup.latestDoc} hasMultipleVersions={docGroup.olderVersions.length > 0} />
                              
                              {/* Older versions - collapsible */}
                              {docGroup.olderVersions.length > 0 && (
                                <Collapsible>
                                  <CollapsibleTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground hover:text-foreground ml-2"
                                    >
                                      <History className="h-3.5 w-3.5" />
                                      <span>{docGroup.olderVersions.length} older version{docGroup.olderVersions.length !== 1 ? 's' : ''}</span>
                                      <ChevronDown className="h-3.5 w-3.5 ml-auto transition-transform group-data-[state=open]:rotate-180" />
                                    </Button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent className="space-y-2 ml-4 mt-2 pl-2 border-l-2 border-muted">
                                    {docGroup.olderVersions.map(olderDoc => (
                                      <DocumentRow key={olderDoc.id} doc={olderDoc} isOlderVersion />
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {/* Load more button for check records */}
                        {hasMore && (
                          <div className="flex justify-center pt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCheckRecordDisplayLimit(prev => prev + CHECK_RECORD_PAGE_SIZE)}
                              className="gap-2"
                            >
                              <ChevronDown className="h-4 w-4" />
                              Load {Math.min(remainingCount, CHECK_RECORD_PAGE_SIZE)} more
                              <span className="text-muted-foreground">({remainingCount} remaining)</span>
                            </Button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </section>
          );
        })}
        </div>
      </>
    );
  }

  // Flat list (default)
  return (
    <>
      <ImageViewer
        isOpen={viewerState.type === 'image'}
        onClose={() => setViewerState({ type: null, url: '', name: '', document: null })}
        imageUrl={viewerState.url}
        imageName={viewerState.name}
        onDownload={() => viewerState.document && handleDownload(viewerState.document)}
      />
      <PDFViewer
        isOpen={viewerState.type === 'pdf'}
        onClose={() => setViewerState({ type: null, url: '', name: '', document: null })}
        pdfUrl={viewerState.url}
        pdfName={viewerState.name}
        onDownload={() => viewerState.document && handleDownload(viewerState.document)}
      />
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
                <div className="flex items-center gap-3">
                  {/* Thumbnail */}
                  <div 
                    className="shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-info/10 border border-primary/20 flex items-center justify-center cursor-pointer"
                    onClick={() => isViewable(doc) && handleView(doc)}
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

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate" title={doc.document_name}>
                      {doc.document_name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">
                        {getDocumentTypeDisplay(doc.document_type)}
                      </span>
                      <span className="text-[11px] text-muted-foreground/50">•</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatFileSize(doc.file_size || 0)}
                      </span>
                      {doc.expires_at && (
                        <>
                          <span className="text-[11px] text-muted-foreground/50">•</span>
                          <span className={`text-[11px] flex items-center gap-0.5 ${
                            isExpired(doc.expires_at) ? 'text-destructive' :
                            isExpiringSoon(doc.expires_at) ? 'text-yellow-600' :
                            'text-muted-foreground'
                          }`}>
                            {isExpired(doc.expires_at) && <AlertTriangle className="h-3 w-3" />}
                            {new Date(doc.expires_at).toLocaleDateString('en-GB')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions - simplified to icon buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isGlobal && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setAssignmentDialogDoc(doc)}
                        title="Assign to items"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    )}
                    {isViewable(doc) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleView(doc)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Document</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{doc.document_name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(doc)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
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
    </>
  );
};

export default DocumentList;