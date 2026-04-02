import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar, Edit, Trash2, FileText, Camera, Download, Filter, Save, Clock, X, FolderOpen, MoreVertical, Paperclip, Image, FileSpreadsheet, File, Search, FileDown, Eye, ChevronDown, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { compressImage } from '@/utils/imageCompression';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PDF_COLORS, blobToDataUrl, drawSectionTitle, drawEquipmentDetails,
  drawSummaryBox, PDF_TABLE_HEAD_STYLES, PDF_TABLE_BODY_STYLES, PDF_TABLE_ALT_ROW,
  drawComplianceStatement,
} from '@/utils/pdfUtils';
import { drawTemplateHeader, drawTemplateFooters, generateDocumentId } from '@/utils/pdfTemplate';
import { storeRideDocument, getRideCode } from '@/utils/rideDocumentService';
import ExportActionsDialog, { type ExportResult } from '@/components/ExportActionsDialog';
import RegisterHeader, { PreviousReportsSection } from '@/components/RegisterHeader';
import RelatedDefectsSection from '@/components/RelatedDefectsSection';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';

// Types
type Ride = Tables<'rides'> & {
  ride_categories: { name: string; description: string | null };
};

type MaintenanceRecord = Tables<'maintenance_records'>;
type Document = Tables<'documents'>;

interface MaintenanceHistoryProps {
  ride: Ride;
  refreshTrigger?: number;
  /** Callback to open the log-maintenance sheet from the parent */
  onLogMaintenance?: () => void;
}

const MAINTENANCE_TYPES = [
  { value: 'preventive', label: 'Preventive Maintenance' },
  { value: 'corrective', label: 'Corrective Maintenance' },
  { value: 'reactive', label: 'Reactive Repair' },
  { value: 'emergency', label: 'Emergency Repair' },
  { value: 'modification', label: 'Modification / Upgrade' },
  { value: 'inspection_linked', label: 'Inspection-Linked Repair' },
  { value: 'inspection', label: 'Inspection & Testing' },
  { value: 'lubrication', label: 'Lubrication' },
  { value: 'electrical', label: 'Electrical Work' },
  { value: 'mechanical', label: 'Mechanical Work' },
  { value: 'hydraulic', label: 'Hydraulic Work' },
  { value: 'structural', label: 'Structural Work' },
  { value: 'safety', label: 'Safety System Work' },
  { value: 'other', label: 'Other' },
];

const MaintenanceHistory = ({ ride, refreshTrigger, onLogMaintenance }: MaintenanceHistoryProps) => {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [documents, setDocuments] = useState<Record<string, Document[]>>({});
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPerformedBy, setFilterPerformedBy] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [editFormData, setEditFormData] = useState({
    maintenance_date: new Date(), maintenance_type: '', description: '',
    performed_by: '', parts_replaced: '', cost: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [attachmentViewOpen, setAttachmentViewOpen] = useState(false);
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Export
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingCsv, setGeneratingCsv] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  // Previous reports
  const [previousReports, setPreviousReports] = useState<Document[]>([]);

  const { toast } = useToast();
  const { logEvent } = useAuditLog();
  const { user } = useAuth();
  const { isStaff, isOwner } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();

  // Staff can only edit/delete records they created (within same session day).
  // Owners can edit/delete any record.
  const canEditRecord = (record: MaintenanceRecord) => {
    if (!isStaff) return true; // owners can always edit
    // Staff can only edit records they logged themselves
    return (record as any).logged_by_user_id === user?.id;
  };
  const canDeleteRecord = (record: MaintenanceRecord) => {
    // Only owners can delete records
    return !isStaff;
  };

  const ALLOWED_TYPES = [
    'image/jpeg','image/png','image/gif','image/webp','image/heic',
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv',
  ];

  useEffect(() => { loadMaintenanceRecords(); loadPreviousReports(); }, [ride.id, refreshTrigger]);

  const loadMaintenanceRecords = async () => {
    try {
      const { data: recordsData, error: recordsError } = await supabase
        .from('maintenance_records').select('*').eq('ride_id', ride.id)
        .order('maintenance_date', { ascending: false });
      if (recordsError) throw recordsError;
      setRecords(recordsData || []);

      const recordsWithDocs = recordsData?.filter(r => r.document_ids && r.document_ids.length > 0) || [];
      if (recordsWithDocs.length > 0) {
        const allDocumentIds = recordsWithDocs.flatMap(r => r.document_ids || []);
        const { data: documentsData, error: documentsError } = await supabase
          .from('documents').select('*').in('id', allDocumentIds);
        if (documentsError) throw documentsError;

        const docsByRecord: Record<string, Document[]> = {};
        recordsWithDocs.forEach(record => {
          docsByRecord[record.id] = (documentsData || []).filter(doc => record.document_ids?.includes(doc.id));
        });
        setDocuments(docsByRecord);

        const imageDocuments = (documentsData || []).filter(doc => doc.mime_type?.startsWith('image/'));
        const urls: Record<string, string> = {};
        for (const imgDoc of imageDocuments) {
          try {
            const { data } = await supabase.storage.from('ride-documents').createSignedUrl(imgDoc.file_path, 3600);
            if (data?.signedUrl) urls[imgDoc.id] = data.signedUrl;
          } catch { /* skip */ }
        }
        setDocumentUrls(urls);
      }
    } catch (error) {
      console.error('Error loading maintenance records:', error);
      if (navigator.onLine) {
        toast({ title: 'Error', description: 'Failed to load maintenance records', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPreviousReports = async () => {
    if (!effectiveUserId) return;
    const { data } = await supabase
      .from('documents').select('*')
      .eq('ride_id', ride.id).eq('user_id', effectiveUserId)
      .eq('document_type', 'maintenance_report')
      .order('uploaded_at', { ascending: false });
    setPreviousReports(data || []);
  };

  // ── Unique performers for filter ──
  const uniquePerformers = useMemo(() => {
    const performers = new Set<string>();
    records.forEach(r => { if (r.performed_by) performers.add(r.performed_by); });
    return Array.from(performers).sort();
  }, [records]);

  // ── Filtered records ──
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (filterType !== 'all' && r.maintenance_type !== filterType) return false;
      if (filterPerformedBy !== 'all' && r.performed_by !== filterPerformedBy) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches = r.description.toLowerCase().includes(q)
          || r.performed_by?.toLowerCase().includes(q)
          || r.parts_replaced?.toLowerCase().includes(q)
          || r.notes?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (dateFrom || dateTo) {
        const recordDate = parseISO(r.maintenance_date);
        if (dateFrom && dateTo) {
          if (!isWithinInterval(recordDate, { start: startOfDay(dateFrom), end: endOfDay(dateTo) })) return false;
        } else if (dateFrom) {
          if (recordDate < startOfDay(dateFrom)) return false;
        } else if (dateTo) {
          if (recordDate > endOfDay(dateTo)) return false;
        }
      }
      return true;
    });
  }, [records, filterType, filterPerformedBy, searchQuery, dateFrom, dateTo]);

  const hasActiveFilters = filterType !== 'all' || filterPerformedBy !== 'all' || !!searchQuery || !!dateFrom || !!dateTo;

  const activeFilterCount = [
    filterType !== 'all',
    filterPerformedBy !== 'all',
    !!dateFrom || !!dateTo,
    !!searchQuery,
  ].filter(Boolean).length;

  const getMaintenanceTypeLabel = (type: string) =>
    MAINTENANCE_TYPES.find(t => t.value === type)?.label || type;

  const filterSummary = [
    filterType !== 'all' ? `Type: ${getMaintenanceTypeLabel(filterType)}` : null,
    filterPerformedBy !== 'all' ? `Performed by: ${filterPerformedBy}` : null,
    dateFrom && dateTo
      ? `${format(dateFrom, 'd MMM yyyy')} – ${format(dateTo, 'd MMM yyyy')}`
      : dateFrom
        ? `From ${format(dateFrom, 'd MMM yyyy')}`
        : dateTo
          ? `To ${format(dateTo, 'd MMM yyyy')}`
          : null,
    searchQuery ? `Search: “${searchQuery.trim()}”` : null,
  ].filter(Boolean).join(' • ');

  // ── CRUD operations ──
  const handleDelete = async (recordId: string) => {
    try {
      // Fetch full record for audit before snapshot
      const { data: fullRecord, error: fetchError } = await supabase
        .from('maintenance_records')
        .select('*')
        .eq('id', recordId)
        .single();
      if (fetchError) throw fetchError;

      // Clean up attached documents
      if (fullRecord?.document_ids && fullRecord.document_ids.length > 0) {
        const { data: docs } = await supabase.from('documents').select('file_path').in('id', fullRecord.document_ids);
        if (docs && docs.length > 0) {
          await supabase.storage.from('ride-documents').remove(docs.map(d => d.file_path));
        }
        await supabase.from('documents').delete().in('id', fullRecord.document_ids);
      }
      const { error } = await supabase.from('maintenance_records').delete().eq('id', recordId);
      if (error) throw error;

      const typeLabel = MAINTENANCE_TYPES.find(t => t.value === fullRecord.maintenance_type)?.label || fullRecord.maintenance_type;
      logEvent('delete', 'maintenance', recordId, {
        name: `${typeLabel} – ${fullRecord.description?.substring(0, 80)}`,
        ride: ride.ride_name,
        maintenance_date: fullRecord.maintenance_date,
        attachments_deleted: fullRecord.document_ids?.length || 0,
      }, {
        before: {
          description: fullRecord.description,
          maintenance_type: typeLabel,
          maintenance_date: fullRecord.maintenance_date,
          performed_by: fullRecord.performed_by,
          parts_replaced: fullRecord.parts_replaced,
          cost: fullRecord.cost,
          notes: fullRecord.notes,
        },
        equipmentName: ride.ride_name,
        equipmentId: ride.id,
        contextHint: 'permanent deletion with attachments',
      });

      toast({ title: 'Success', description: 'Maintenance record deleted' });
      loadMaintenanceRecords();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({ title: 'Error', description: 'Failed to delete record', variant: 'destructive' });
    }
  };

  const openEditDialog = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setEditFormData({
      maintenance_date: parseISO(record.maintenance_date), maintenance_type: record.maintenance_type,
      description: record.description, performed_by: record.performed_by || '',
      parts_replaced: record.parts_replaced || '', cost: record.cost?.toString() || '',
      notes: record.notes || '',
    });
    setNewFiles([]);
    setEditDialogOpen(true);
  };

  const handleEditFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const processedFiles: File[] = [];
    for (const file of files) {
      const isValidType = ALLOWED_TYPES.includes(file.type) || file.type.startsWith('image/');
      const isValidSize = file.size <= 10 * 1024 * 1024;
      if (!isValidType) { toast({ title: 'Invalid File Type', description: `${file.name} is not supported.`, variant: 'destructive' }); continue; }
      if (!isValidSize) { toast({ title: 'File Too Large', description: `${file.name} is too large. Max 10MB.`, variant: 'destructive' }); continue; }
      if (file.type.startsWith('image/') && file.size > 500000) {
        try { processedFiles.push(await compressImage(file)); } catch { processedFiles.push(file); }
      } else { processedFiles.push(file); }
    }
    setNewFiles(prev => [...prev, ...processedFiles]);
  };

  const removeNewFile = (index: number) => setNewFiles(prev => prev.filter((_, i) => i !== index));

  const uploadFilesToStorage = async (files: File[]): Promise<string[]> => {
    const uploadedPaths: string[] = [];
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const filePath = `maintenance/${ride.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error } = await supabase.storage.from('ride-documents').upload(filePath, file);
      if (error) throw new Error(`Failed to upload ${file.name}`);
      uploadedPaths.push(filePath);
    }
    return uploadedPaths;
  };

  const saveDocuments = async (filePaths: string[], recordDescription: string): Promise<string[]> => {
    const documentIds: string[] = [];
    for (let i = 0; i < filePaths.length; i++) {
      const originalFile = newFiles[i];
      if (!effectiveUserId) throw new Error('User not authenticated');
      const { data, error } = await supabase.from('documents').insert([{
        user_id: effectiveUserId, ride_id: ride.id, document_name: originalFile.name,
        document_type: 'maintenance', file_path: filePaths[i],
        mime_type: originalFile.type, file_size: originalFile.size,
        notes: `Maintenance record: ${recordDescription}`,
      }]).select('id').single();
      if (error) throw error;
      if (data) documentIds.push(data.id);
    }
    return documentIds;
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    if (!editFormData.maintenance_type || !editFormData.description || !editFormData.performed_by) {
      toast({ title: 'Validation Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let newDocumentIds: string[] = [];
      if (newFiles.length > 0) {
        const filePaths = await uploadFilesToStorage(newFiles);
        newDocumentIds = await saveDocuments(filePaths, editFormData.description);
      }
      const allDocumentIds = [...(editingRecord.document_ids || []), ...newDocumentIds];
      const { error } = await supabase.from('maintenance_records').update({
        maintenance_date: editFormData.maintenance_date.toISOString().split('T')[0],
        maintenance_type: editFormData.maintenance_type, description: editFormData.description,
        performed_by: editFormData.performed_by, parts_replaced: editFormData.parts_replaced || null,
        cost: editFormData.cost ? parseFloat(editFormData.cost) : null,
        notes: editFormData.notes || null,
        document_ids: allDocumentIds.length > 0 ? allDocumentIds : null,
        updated_at: new Date().toISOString(),
      }).eq('id', editingRecord.id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Record updated' });
      setEditDialogOpen(false); setEditingRecord(null); setNewFiles([]);
      loadMaintenanceRecords();
    } catch (error) {
      console.error('Error updating:', error);
      toast({ title: 'Error', description: 'Failed to update record', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const downloadFile = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage.from('ride-documents').download(doc.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a'); a.href = url; a.download = doc.document_name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading:', error);
      toast({ title: 'Error', description: 'Failed to download file', variant: 'destructive' });
    }
  };

  // getMaintenanceTypeLabel moved above filterSummary

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="h-4 w-4 text-muted-foreground" />;
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv')
      return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
    if (mimeType.includes('word') || mimeType.includes('document'))
      return <FileText className="h-4 w-4 text-blue-600" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const getMaintenanceTypeBadge = (type: string) => {
    const configs: Record<string, { bg: string; border: string; dot: string; text: string }> = {
      emergency:   { bg: '#FEF2F2', border: '#FCA5A5', dot: '#EF4444', text: '#B91C1C' },
      reactive:    { bg: '#FEF2F2', border: '#FCA5A5', dot: '#EF4444', text: '#B91C1C' },
      corrective:  { bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B', text: '#92400E' },
      preventive:  { bg: '#EFF6FF', border: '#BFDBFE', dot: '#3B82F6', text: '#1D4ED8' },
      inspection:  { bg: '#F8FAFC', border: '#E2E8F0', dot: '#94A3B8', text: '#475569' },
      modification:{ bg: '#F0F9FF', border: '#BAE6FD', dot: '#0EA5E9', text: '#0369A1' },
    };
    const c = configs[type] || configs.inspection;
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold border"
        style={{ background: c.bg, borderColor: c.border, color: c.text }}>
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.dot }} />
        {getMaintenanceTypeLabel(type)}
      </div>
    );
  };

  const renderAttachmentRow = (doc: Document, compact = false) => {
    const thumbSize = compact ? 'h-8 w-8' : 'h-9 w-9';
    const textSize = compact ? 'text-[12px]' : 'text-[13px]';
    const subSize = 'text-[10px]';
    const padding = compact ? 'p-2' : 'p-2.5';
    return (
      <button key={doc.id}
        className={`w-full flex items-center gap-2.5 ${padding} rounded-lg border border-border hover:bg-accent/50 transition-colors text-left`}
        onClick={() => {
          if (doc.mime_type?.startsWith('image/') && documentUrls[doc.id]) { setPreviewImage(documentUrls[doc.id]); }
          else { downloadFile(doc); }
        }}>
        {doc.mime_type?.startsWith('image/') && documentUrls[doc.id] ? (
          <img src={documentUrls[doc.id]} alt={doc.document_name} className={`${thumbSize} rounded-lg object-cover shrink-0`} />
        ) : (
          <div className={`${thumbSize} rounded-lg bg-muted flex items-center justify-center shrink-0`}>
            {getFileIcon(doc.mime_type)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={`${textSize} font-medium text-foreground truncate`}>{doc.document_name}</p>
          <p className={`${subSize} text-muted-foreground`}>
            {doc.mime_type?.startsWith('image/') ? 'Tap to preview' : [
              doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : null,
              doc.mime_type?.split('/').pop()?.toUpperCase()
            ].filter(Boolean).join(' · ') || 'Tap to download'}
          </p>
        </div>
        <span className="shrink-0 p-1 rounded hover:bg-muted" role="button" onClick={(e) => { e.stopPropagation(); downloadFile(doc); }}>
          <Download className="h-3.5 w-3.5 text-muted-foreground/50" />
        </span>
      </button>
    );
  };

  // ── Export CSV ──
  const handleExportCsv = () => {
    setGeneratingCsv(true);
    try {
      const headers = ['Date', 'Type', 'Description', 'Performed By', 'Cost', 'Parts Replaced', 'Notes', 'Created', 'Updated'];
      const rows = filteredRecords.map(r => [
        r.maintenance_date,
        getMaintenanceTypeLabel(r.maintenance_type),
        `"${r.description.replace(/"/g, '""')}"`,
        r.performed_by || '',
        r.cost != null ? r.cost.toString() : '',
        `"${(r.parts_replaced || '').replace(/"/g, '""')}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`,
        format(parseISO(r.created_at), 'dd/MM/yyyy HH:mm'),
        format(parseISO(r.updated_at), 'dd/MM/yyyy HH:mm'),
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const fileName = `Maintenance - ${ride.ride_name} - ${format(new Date(), 'ddMMMyyyy')}.csv`;
      setExportResult({ blob, fileName });
      setExportDialogOpen(true);
    } catch (error) {
      console.error('CSV export error:', error);
      toast({ title: 'Error', description: 'Failed to export CSV', variant: 'destructive' });
    } finally { setGeneratingCsv(false); }
  };

  // ── Export PDF (moved from MaintenanceReports) ──
  const handleExportPdf = async () => {
    setGeneratingPdf(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (filteredRecords.length === 0) {
        toast({ title: 'No Records', description: 'No records match current filters', variant: 'destructive' });
        setGeneratingPdf(false);
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();

      let logoDataUrl: string | null = null;
      if (profile?.company_logo_path) {
        try {
          const { data: logoBlob } = await supabase.storage.from('ride-documents').download(profile.company_logo_path);
          if (logoBlob) { logoDataUrl = await blobToDataUrl(logoBlob); }
        } catch { /* skip */ }
      }

      const { data: rideImage } = await supabase.from('documents').select('file_path')
        .eq('ride_id', ride.id).like('mime_type', 'image/%').limit(1).maybeSingle();
      let imageDataUrl: string | null = null;
      if (rideImage) {
        try {
          const { data: imageBlob } = await supabase.storage.from('ride-documents').download(rideImage.file_path);
          if (imageBlob) { imageDataUrl = await blobToDataUrl(imageBlob); }
        } catch { /* skip */ }
      }

      const docId = await generateDocumentId(ride.id, 'MR');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 13;

      let yPos = drawTemplateHeader({ doc, title: 'MAINTENANCE REPORT', documentId: docId, docType: 'MR' as const });

      yPos = drawSectionTitle(doc, 'Equipment Details', yPos, margin);
      yPos = await drawEquipmentDetails({
        doc, y: yPos, margin,
        fields: [
          { label: 'Name', value: ride.ride_name },
          { label: 'Category', value: ride.ride_categories?.name },
          { label: 'Manufacturer', value: ride.manufacturer },
          { label: 'Serial No', value: ride.serial_number },
          { label: 'Year', value: ride.year_manufactured?.toString() },
          { label: 'Controller', value: ride.owner_name },
        ],
        imageDataUrl, maxImageW: 40, maxImageH: 30,
      });

      const totalCost = filteredRecords.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
      const periodLabel = dateFrom && dateTo
        ? `${format(dateFrom, 'dd/MM/yyyy')} – ${format(dateTo, 'dd/MM/yyyy')}`
        : dateFrom ? `From ${format(dateFrom, 'dd/MM/yyyy')}`
        : dateTo ? `Up to ${format(dateTo, 'dd/MM/yyyy')}`
        : 'All time';

      yPos = drawSectionTitle(doc, 'Report Summary', yPos, margin);
      yPos = drawSummaryBox(doc, [
        { label: 'Total Records', value: String(filteredRecords.length) },
        { label: 'Total Cost', value: `£${totalCost.toFixed(2)}`, accent: true },
        { label: 'Period', value: periodLabel },
        ...(filterType !== 'all' ? [{ label: 'Type Filter', value: getMaintenanceTypeLabel(filterType) }] : []),
      ], yPos, margin);

      yPos = drawSectionTitle(doc, 'Maintenance Records', yPos, margin);
      const truncate = (t: string, max: number) => t.length <= max ? t : t.substring(0, max - 3) + '...';
      const tableData = filteredRecords.map((r, i) => [
        (i + 1).toString(),
        format(parseISO(r.maintenance_date), 'dd/MM/yyyy'),
        getMaintenanceTypeLabel(r.maintenance_type),
        truncate(r.description, 50),
        r.performed_by || '-',
        r.cost ? `£${Number(r.cost).toFixed(2)}` : '-',
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Date', 'Type', 'Work Done', 'By', 'Cost']],
        body: tableData,
        headStyles: PDF_TABLE_HEAD_STYLES,
        styles: PDF_TABLE_BODY_STYLES,
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 24, halign: 'center' },
          2: { cellWidth: 32 }, 3: { cellWidth: 52 }, 4: { cellWidth: 28 }, 5: { cellWidth: 22, halign: 'right' },
        },
        alternateRowStyles: PDF_TABLE_ALT_ROW,
        margin: { bottom: 28 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 15;

      // Detailed records
      doc.addPage();
      yPos = 20;
      const attachmentsForAppendix: Array<{
        recordIndex: number; recordDate: string; recordType: string;
        docs: Array<{ id: string; document_name: string; mime_type: string | null; file_path: string }>;
      }> = [];

      yPos = drawSectionTitle(doc, 'Detailed Maintenance Records', yPos, margin);
      yPos = drawComplianceStatement(doc, yPos, margin);

      for (let i = 0; i < filteredRecords.length; i++) {
        const record = filteredRecords[i];
        if (yPos > 240) { doc.addPage(); yPos = 20; }

        doc.setFillColor(...PDF_COLORS.navy);
        doc.rect(margin, yPos - 5, pageWidth - margin * 2, 9, 'F');
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...PDF_COLORS.white);
        doc.text(`${i + 1}.  ${format(parseISO(record.maintenance_date), 'dd MMMM yyyy')}  —  ${getMaintenanceTypeLabel(record.maintenance_type)}`, margin + 4, yPos);
        doc.setTextColor(0); yPos += 11;

        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...PDF_COLORS.body);
        const detailFields: Array<[string, string | null | undefined, boolean?]> = [
          ['Description', record.description, true],
          ['Performed by', record.performed_by],
          ['Cost', record.cost ? `£${Number(record.cost).toFixed(2)}` : null],
          ['Parts replaced', record.parts_replaced],
          ['Notes', record.notes],
        ];
        for (const [label, value, isLong] of detailFields) {
          if (!value) continue;
          doc.setFont('helvetica', 'bold'); doc.setTextColor(...PDF_COLORS.muted);
          doc.text(`${label}:`, margin + 5, yPos);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...PDF_COLORS.body);
          if (isLong) {
            const lines = doc.splitTextToSize(value, pageWidth - margin - 50);
            doc.text(lines, margin + 38, yPos);
            yPos += Math.max(lines.length * 4, 5) + 2;
          } else { doc.text(String(value), margin + 38, yPos); yPos += 5; }
        }

        if (record.document_ids && record.document_ids.length > 0) {
          const { data: attachedDocs } = await supabase.from('documents')
            .select('id, document_name, mime_type, file_path').in('id', record.document_ids);
          if (attachedDocs && attachedDocs.length > 0) {
            doc.setFont('helvetica', 'bold'); doc.setTextColor(...PDF_COLORS.muted);
            doc.text('Attachments:', margin + 5, yPos); yPos += 5;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...PDF_COLORS.body);
            for (const att of attachedDocs) {
              doc.text(`• ${att.document_name}`, margin + 10, yPos); yPos += 4;
              if (yPos > 270) { doc.addPage(); yPos = 20; }
            }
            doc.setFontSize(9); yPos += 2;
            attachmentsForAppendix.push({
              recordIndex: i + 1, recordDate: format(parseISO(record.maintenance_date), 'dd MMM yyyy'),
              recordType: getMaintenanceTypeLabel(record.maintenance_type), docs: attachedDocs,
            });
          }
        }

        doc.setFontSize(7); doc.setTextColor(160);
        doc.text(`Record created: ${format(parseISO(record.created_at), 'dd/MM/yyyy HH:mm')}${record.updated_at !== record.created_at ? ` | Last edited: ${format(parseISO(record.updated_at), 'dd/MM/yyyy HH:mm')}` : ''}`, margin + 5, yPos);
        doc.setTextColor(0); yPos += 12;
      }

      // Defect history
      const { data: defectsData } = await supabase.from('defects').select('*')
        .eq('ride_id', ride.id).eq('user_id', user.id).order('reported_at', { ascending: false });
      const allDefects = defectsData || [];
      if (allDefects.length > 0) {
        doc.addPage(); yPos = 20;
        yPos = drawSectionTitle(doc, 'Defect History', yPos, margin);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...PDF_COLORS.muted);
        doc.text('Resolved defects represent completed repairs. Open defects require attention.', margin, yPos);
        yPos += 10;

        const defectTableData = allDefects.map((d, idx) => [
          (idx + 1).toString(),
          format(parseISO(d.reported_at), 'dd/MM/yyyy'),
          d.severity === 'stop_operation' ? 'Stop Use' : d.severity === 'urgent' ? 'Important' : 'Low',
          truncate(d.description, 45),
          d.status === 'resolved' ? 'Closed' : 'Open',
          d.resolved_at ? format(parseISO(d.resolved_at), 'dd/MM/yyyy') : '-',
        ]);
        autoTable(doc, {
          startY: yPos, head: [['#', 'Reported', 'Severity', 'Description', 'Status', 'Resolved']],
          body: defectTableData, headStyles: PDF_TABLE_HEAD_STYLES, styles: PDF_TABLE_BODY_STYLES,
          columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 24, halign: 'center' }, 2: { cellWidth: 22 }, 3: { cellWidth: 55 }, 4: { cellWidth: 18, halign: 'center' }, 5: { cellWidth: 24, halign: 'center' } },
          alternateRowStyles: PDF_TABLE_ALT_ROW, margin: { bottom: 28 },
        });
      }

      // Attachments appendix
      if (attachmentsForAppendix.length > 0) {
        doc.addPage(); yPos = 20;
        yPos = drawSectionTitle(doc, 'Appendix: Maintenance Attachments', yPos, margin);
        for (const att of attachmentsForAppendix) {
          if (yPos > 250) { doc.addPage(); yPos = 20; }
          doc.setFillColor(...PDF_COLORS.navy);
          doc.rect(margin, yPos - 4, pageWidth - margin * 2, 8, 'F');
          doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...PDF_COLORS.white);
          doc.text(`Record ${att.recordIndex}: ${att.recordDate}  —  ${att.recordType}`, margin + 4, yPos);
          doc.setTextColor(0); yPos += 10;
          let photoCounter = 0;
          for (const docItem of att.docs) {
            if (docItem.mime_type?.startsWith('image/')) {
              photoCounter++;
              try {
                const { data: imgBlob } = await supabase.storage.from('ride-documents').download(docItem.file_path);
                if (imgBlob) {
                  const imgUrl = await blobToDataUrl(imgBlob);
                  if (yPos > 200) { doc.addPage(); yPos = 20; }
                  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...PDF_COLORS.body);
                  doc.text(`Photo ${photoCounter} — ${att.recordType} — ${att.recordDate}`, margin + 5, yPos); yPos += 5;
                  try { doc.addImage(imgUrl, 'AUTO', margin + 5, yPos, 60, 45); yPos += 52; }
                  catch { doc.setFontSize(8); doc.setTextColor(...PDF_COLORS.muted); doc.text('[Image could not be embedded]', margin + 5, yPos); yPos += 6; }
                }
              } catch { doc.setFontSize(8); doc.text(`• Photo ${photoCounter} (file not available)`, margin + 5, yPos); yPos += 5; }
            } else {
              doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...PDF_COLORS.body);
              doc.text(`📎 ${docItem.document_name}`, margin + 5, yPos); yPos += 5;
            }
          }
          yPos += 5;
        }
      }

      drawTemplateFooters({ doc, title: 'MAINTENANCE REPORT', documentId: docId, docType: 'MR' as const });

      const fromStr = dateFrom ? format(dateFrom, 'ddMMMyyyy') : 'all';
      const toStr = dateTo ? format(dateTo, 'ddMMMyyyy') : 'present';
      const documentName = `Maintenance Report - ${ride.ride_name} - ${fromStr} to ${toStr}`;
      const fileName = `${documentName.replace(/[^a-zA-Z0-9\s-]/g, '')}.pdf`;
      const pdfBlob = doc.output('blob');

      // Show export actions dialog (no auto-save)
      const saveToDocuments = async (): Promise<string | void> => {
        const storagePath = `${user.id}/maintenance-reports/${ride.id}/${Date.now()}-${fileName}`;
        const { error: uploadError } = await supabase.storage.from('ride-documents').upload(storagePath, pdfBlob, { contentType: 'application/pdf' });
        if (uploadError) throw uploadError;

        await supabase.from('documents').insert({
          user_id: user.id, ride_id: ride.id, document_name: documentName,
          document_type: 'maintenance_report', file_path: storagePath,
          mime_type: 'application/pdf', file_size: pdfBlob.size,
          notes: `Maintenance report: ${filteredRecords.length} records, ${periodLabel}`, is_global: false,
        });
        const rideCode = await getRideCode(ride.id);
        const rideDocId = await storeRideDocument({
          rideId: ride.id, rideCode, documentType: 'MR', documentId: docId,
          fileUrl: storagePath, title: documentName,
          metadata: { recordCount: filteredRecords.length, totalCost },
        });
        loadPreviousReports();
        return rideDocId || undefined;
      };

      setExportResult({ blob: pdfBlob, fileName, onSaveToDocuments: saveToDocuments, saveLabel: `Save to ${ride.ride_name} Documents`, saveHint: `Saves this report inside ${ride.ride_name}'s document register.` });
      setExportDialogOpen(true);
    } catch (error) {
      console.error('PDF error:', error);
      toast({ title: 'Error', description: 'Failed to generate report', variant: 'destructive' });
    } finally { setGeneratingPdf(false); }
  };

  // View is now handled internally by PreviousReportsSection
  const handleViewReport = async (_filePath: string) => {};

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading maintenance history…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-6">

      <RegisterHeader
        resultCount={`${filteredRecords.length} record${filteredRecords.length !== 1 ? 's' : ''}`}
        totalCount={records.length}
        hasActiveFilters={hasActiveFilters}
        searchTerm={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search records…"
        activeFilterCount={activeFilterCount}
        filterSummary={filterSummary}
        primaryAction={onLogMaintenance ? { label: 'Log maintenance', icon: <Plus className="h-4 w-4" />, onClick: onLogMaintenance } : undefined}
        actions={[
          { label: 'Export CSV', icon: <FileDown className="h-4 w-4" />, onClick: handleExportCsv, variant: 'outline' as const, disabled: generatingCsv || filteredRecords.length === 0 },
          { label: 'Export PDF', icon: <FileDown className="h-4 w-4" />, onClick: handleExportPdf, variant: 'outline' as const, disabled: generatingPdf || filteredRecords.length === 0, loading: generatingPdf },
        ]}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        savedReports={previousReports}
        onViewReport={handleViewReport}
        filterContent={
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Type</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-9 text-[12px]"><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {MAINTENANCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Performed by</Label>
                <Select value={filterPerformedBy} onValueChange={setFilterPerformedBy}>
                  <SelectTrigger className="h-9 text-[12px]"><SelectValue placeholder="Anyone" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Anyone</SelectItem>
                    {uniquePerformers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {hasActiveFilters && (
              <button onClick={() => { setFilterType('all'); setFilterPerformedBy('all'); setDateFrom(undefined); setDateTo(undefined); setSearchQuery(''); }}
                className="text-[12px] font-medium text-primary hover:underline">
                Clear all filters
              </button>
            )}
          </>
        }
      />

      {/* ── Related Defects (collapsed) ── */}
      <RelatedDefectsSection rideId={ride.id} rideName={ride.ride_name} />

      {/* ── Records list ── */}
      {filteredRecords.length === 0 ? (
        <EmptyState icon={Calendar} title="No maintenance records found"
          description={hasActiveFilters ? 'Try adjusting your filters or date range' : 'Start logging maintenance activities to build your record history'}
          variant="compact" />
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => {
            const recordDocs = documents[record.id] || [];
            return (
              <div key={record.id} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden cursor-pointer active:scale-[0.998] transition-all"
                onClick={() => { setSelectedRecord(record); setDetailViewOpen(true); }}>
                <div className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getMaintenanceTypeBadge(record.maintenance_type)}
                      <span className="text-[12px] text-muted-foreground shrink-0">
                        {format(parseISO(record.maintenance_date), 'd MMM yyyy')}
                      </span>
                    </div>
                    {(canEditRecord(record) || canDeleteRecord(record)) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {canEditRecord(record) && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(record); }}><Edit className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
                        )}
                        {canDeleteRecord(record) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteRecordId(record.id); }}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[13px] font-semibold leading-snug text-foreground line-clamp-2">{record.description}</h4>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {record.performed_by && <span>By <span className="font-medium text-foreground">{record.performed_by}</span></span>}
                      {record.cost != null && <span>£<span className="font-semibold text-foreground">{record.cost}</span></span>}
                    </div>
                    {record.parts_replaced && (
                      <p className="text-[12px] text-muted-foreground"><span className="font-medium text-foreground/70">Parts:</span> {record.parts_replaced}</p>
                    )}
                  </div>

                  {recordDocs.length > 0 && (
                    <button className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline"
                      onClick={(e) => { e.stopPropagation(); setSelectedRecord(record); setAttachmentViewOpen(true); }}>
                      <Paperclip className="h-3 w-3" /> {recordDocs.length} attachment{recordDocs.length !== 1 ? 's' : ''}
                    </button>
                  )}

                  <div className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground/70">
                    <span>Created {format(parseISO(record.created_at), 'dd/MM/yy')}</span>
                    {record.updated_at !== record.created_at && <><span>·</span><span>Edited {format(parseISO(record.updated_at), 'dd/MM/yy')}</span></>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PreviousReportsSection reports={previousReports} onViewReport={handleViewReport} />

      {/* ── Record Detail View ── */}
      <Dialog open={detailViewOpen} onOpenChange={setDetailViewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-0">
            <DialogTitle className="text-base">Maintenance Record</DialogTitle>
            <DialogDescription className="text-[13px]">
              {ride.ride_name}{selectedRecord ? ` · ${format(parseISO(selectedRecord.maintenance_date), 'd MMM yyyy')}` : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (() => {
            const detailDocs = documents[selectedRecord.id] || [];
            return (
              <div className="space-y-3 pt-1">
                <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">{getMaintenanceTypeBadge(selectedRecord.maintenance_type)}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                    <div><p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Equipment</p><p className="font-medium text-foreground truncate">{ride.ride_name}</p></div>
                    <div><p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Date</p><p className="font-medium text-foreground">{format(parseISO(selectedRecord.maintenance_date), 'd MMM yyyy')}</p></div>
                    {selectedRecord.performed_by && <div><p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Performed By</p><p className="font-medium text-foreground">{selectedRecord.performed_by}</p></div>}
                    {selectedRecord.cost != null && <div><p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Cost</p><p className="font-semibold text-foreground">£{selectedRecord.cost}</p></div>}
                    {selectedRecord.next_maintenance_due && <div><p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Next Due</p><p className="font-medium text-foreground">{format(parseISO(selectedRecord.next_maintenance_due), 'd MMM yyyy')}</p></div>}
                  </div>
                </div>
                <div><p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Work Summary</p><p className="text-[13px] text-foreground leading-relaxed">{selectedRecord.description}</p></div>
                {selectedRecord.parts_replaced && <div><p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Parts Replaced</p><p className="text-[13px] text-foreground">{selectedRecord.parts_replaced}</p></div>}
                {selectedRecord.notes && <div><p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Notes</p><p className="text-[13px] text-foreground">{selectedRecord.notes}</p></div>}
                {detailDocs.length > 0 && <div><p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Attachments ({detailDocs.length})</p><div className="space-y-1">{detailDocs.map((d) => renderAttachmentRow(d, true))}</div></div>}
                <div className="h-px bg-border" />
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />Created {format(parseISO(selectedRecord.created_at), 'dd/MM/yyyy HH:mm')}</span>
                  {selectedRecord.updated_at !== selectedRecord.created_at && <span className="flex items-center gap-1"><Edit className="h-2.5 w-2.5" />Edited {format(parseISO(selectedRecord.updated_at), 'dd/MM/yyyy HH:mm')}</span>}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Image Preview ── */}
      <Dialog open={!!previewImage} onOpenChange={(open) => { if (!open) setPreviewImage(null); }}>
        <DialogContent className="max-w-2xl p-2">{previewImage && <img src={previewImage} alt="Preview" className="w-full h-auto rounded-lg" />}</DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteRecordId} onOpenChange={(open) => { if (!open) setDeleteRecordId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Record?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this maintenance record and all attached files.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if (deleteRecordId) { handleDelete(deleteRecordId); setDeleteRecordId(null); } }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Attachment Viewer ── */}
      <Dialog open={attachmentViewOpen} onOpenChange={setAttachmentViewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-0"><DialogTitle className="text-base">Attachments</DialogTitle><DialogDescription className="text-[13px]">{selectedRecord ? `${ride.ride_name} · ${format(parseISO(selectedRecord.maintenance_date), 'd MMM yyyy')}` : ''}</DialogDescription></DialogHeader>
          {selectedRecord && (documents[selectedRecord.id] || []).length > 0 ? (
            <div className="space-y-1 pt-1">{(documents[selectedRecord.id] || []).map((d) => renderAttachmentRow(d))}</div>
          ) : <p className="text-sm text-muted-foreground">No attachments</p>}
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Maintenance Record</DialogTitle><DialogDescription>Update the maintenance record details. Changes will be timestamped.</DialogDescription></DialogHeader>
          {editingRecord && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground p-3 bg-muted rounded-xl">
                <div className="flex items-center gap-1"><Clock className="h-3 w-3" /><span>Created: {format(parseISO(editingRecord.created_at), 'dd/MM/yyyy HH:mm')}</span></div>
                {editingRecord.updated_at !== editingRecord.created_at && <div className="flex items-center gap-1"><Edit className="h-3 w-3" /><span>Edited: {format(parseISO(editingRecord.updated_at), 'dd/MM/yyyy HH:mm')}</span></div>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Maintenance Date *</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild><Button variant="outline" className={cn('w-full justify-start text-left font-normal', !editFormData.maintenance_date && 'text-muted-foreground')}><Calendar className="mr-2 h-4 w-4" />{editFormData.maintenance_date ? format(editFormData.maintenance_date, 'PPP') : 'Select date'}</Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start"><CalendarComponent mode="single" selected={editFormData.maintenance_date} onSelect={(date) => { setEditFormData({ ...editFormData, maintenance_date: date || new Date() }); setCalendarOpen(false); }} initialFocus className="pointer-events-auto" /></PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Maintenance Type *</Label>
                  <Select value={editFormData.maintenance_type} onValueChange={(v) => setEditFormData({ ...editFormData, maintenance_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>{MAINTENANCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label htmlFor="edit_performed_by">Performed By *</Label><Input id="edit_performed_by" value={editFormData.performed_by} onChange={(e) => setEditFormData({ ...editFormData, performed_by: e.target.value })} placeholder="Name" /></div>
                <div className="space-y-2"><Label htmlFor="edit_cost">Cost (£)</Label><Input id="edit_cost" type="number" step="0.01" min="0" value={editFormData.cost} onChange={(e) => setEditFormData({ ...editFormData, cost: e.target.value })} placeholder="0.00" /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="edit_description">Work Description *</Label><Textarea id="edit_description" value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} placeholder="Describe the work…" rows={3} /></div>
              <div className="space-y-2"><Label htmlFor="edit_parts_replaced">Parts Replaced</Label><Textarea id="edit_parts_replaced" value={editFormData.parts_replaced} onChange={(e) => setEditFormData({ ...editFormData, parts_replaced: e.target.value })} placeholder="List any parts replaced…" rows={2} /></div>
              <div className="space-y-2"><Label htmlFor="edit_notes">Additional Notes</Label><Textarea id="edit_notes" value={editFormData.notes} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} placeholder="Additional notes…" rows={2} /></div>
              {editingRecord && documents[editingRecord.id] && documents[editingRecord.id].length > 0 && (
                <div className="space-y-2"><Label>Existing Attachments ({documents[editingRecord.id].length})</Label><div className="flex flex-wrap gap-2">{documents[editingRecord.id].map((d) => (
                  <div key={d.id} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">{d.mime_type?.startsWith('image/') ? <Camera className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-muted-foreground" />}<span className="text-xs truncate max-w-32">{d.document_name}</span><Button variant="ghost" size="sm" onClick={() => downloadFile(d)} className="h-6 w-6 p-0"><Download className="h-3 w-3" /></Button></div>
                ))}</div></div>
              )}
              <div className="space-y-2">
                <Label>Add New Files</Label>
                <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx" onChange={handleEditFileUpload} className="hidden" id="edit-file-upload" />
                <input type="file" multiple accept="image/*" capture="environment" onChange={handleEditFileUpload} className="hidden" id="edit-camera-upload" />
                <div className="grid grid-cols-2 gap-3">
                  <Button type="button" variant="outline" className="h-16 flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-2xl" onClick={() => document.getElementById('edit-camera-upload')?.click()}><Camera className="h-5 w-5 text-muted-foreground" /><span className="text-xs font-medium">Take Photo</span></Button>
                  <Button type="button" variant="outline" className="h-16 flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-2xl" onClick={() => document.getElementById('edit-file-upload')?.click()}><FolderOpen className="h-5 w-5 text-muted-foreground" /><span className="text-xs font-medium">Choose File</span></Button>
                </div>
              </div>
              {newFiles.length > 0 && (
                <div className="space-y-2"><Label>New Files ({newFiles.length})</Label><div className="flex flex-wrap gap-2">{newFiles.map((file, index) => (
                  <div key={index} className="relative group border rounded-md overflow-hidden bg-muted/30 w-16 h-16">
                    {file.type.startsWith('image/') ? <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center p-1"><FileText className="h-5 w-5 text-muted-foreground" /><span className="text-[8px] text-center text-muted-foreground line-clamp-1 mt-0.5">{file.name.split('.').pop()}</span></div>}
                    <Button type="button" variant="destructive" size="icon" className="absolute top-0.5 right-0.5 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeNewFile(index)}><X className="h-2.5 w-2.5" /></Button>
                  </div>
                ))}</div></div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExportActionsDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} result={exportResult} />

    </div>
  );
};

export default MaintenanceHistory;
