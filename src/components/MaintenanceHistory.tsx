import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar, Edit, Trash2, FileText, Camera, Download, Filter, Save, Clock, X, FolderOpen, MoreVertical, Paperclip, Image, FileSpreadsheet, File } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, parseISO } from 'date-fns';
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

type Ride = Tables<'rides'> & {
  ride_categories: { name: string; description: string | null };
};

type MaintenanceRecord = Tables<'maintenance_records'>;
type Document = Tables<'documents'>;

interface MaintenanceHistoryProps {
  ride: Ride;
  refreshTrigger?: number;
}

const MAINTENANCE_TYPES = [
  { value: 'preventive', label: 'Preventive Maintenance' },
  { value: 'corrective', label: 'Corrective Maintenance' },
  { value: 'emergency', label: 'Emergency Repair' },
  { value: 'inspection', label: 'Inspection & Testing' },
  { value: 'lubrication', label: 'Lubrication' },
  { value: 'electrical', label: 'Electrical Work' },
  { value: 'mechanical', label: 'Mechanical Work' },
  { value: 'hydraulic', label: 'Hydraulic Work' },
  { value: 'structural', label: 'Structural Work' },
  { value: 'safety', label: 'Safety System Work' },
  { value: 'other', label: 'Other' },
];

const MaintenanceHistory = ({ ride, refreshTrigger }: MaintenanceHistoryProps) => {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [documents, setDocuments] = useState<Record<string, Document[]>>({});
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [editFormData, setEditFormData] = useState({
    maintenance_date: new Date(),
    maintenance_type: '',
    description: '',
    performed_by: '',
    parts_replaced: '',
    cost: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [attachmentViewOpen, setAttachmentViewOpen] = useState(false);
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const { toast } = useToast();

  const ALLOWED_TYPES = [
    'image/jpeg','image/png','image/gif','image/webp','image/heic',
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv',
  ];

  useEffect(() => { loadMaintenanceRecords(); }, [ride.id, refreshTrigger]);

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
        for (const doc of imageDocuments) {
          try {
            const { data } = await supabase.storage.from('ride-documents').createSignedUrl(doc.file_path, 3600);
            if (data?.signedUrl) urls[doc.id] = data.signedUrl;
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

  const handleDelete = async (recordId: string) => {
    try {
      const { data: record, error: fetchError } = await supabase
        .from('maintenance_records').select('document_ids').eq('id', recordId).single();
      if (fetchError) throw fetchError;
      if (record?.document_ids && record.document_ids.length > 0) {
        const { data: docs } = await supabase.from('documents').select('file_path').in('id', record.document_ids);
        if (docs && docs.length > 0) {
          await supabase.storage.from('ride-documents').remove(docs.map(d => d.file_path));
        }
        await supabase.from('documents').delete().in('id', record.document_ids);
      }
      const { error } = await supabase.from('maintenance_records').delete().eq('id', recordId);
      if (error) throw error;
      toast({ title: 'Success', description: 'Maintenance record and attachments deleted successfully' });
      loadMaintenanceRecords();
    } catch (error) {
      console.error('Error deleting maintenance record:', error);
      toast({ title: 'Error', description: 'Failed to delete maintenance record', variant: 'destructive' });
    }
  };

  const openEditDialog = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setEditFormData({
      maintenance_date: parseISO(record.maintenance_date),
      maintenance_type: record.maintenance_type,
      description: record.description,
      performed_by: record.performed_by || '',
      parts_replaced: record.parts_replaced || '',
      cost: record.cost?.toString() || '',
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      const { data, error } = await supabase.from('documents').insert([{
        user_id: user.id, ride_id: ride.id, document_name: originalFile.name,
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
        maintenance_type: editFormData.maintenance_type,
        description: editFormData.description,
        performed_by: editFormData.performed_by,
        parts_replaced: editFormData.parts_replaced || null,
        cost: editFormData.cost ? parseFloat(editFormData.cost) : null,
        notes: editFormData.notes || null,
        document_ids: allDocumentIds.length > 0 ? allDocumentIds : null,
        updated_at: new Date().toISOString(),
      }).eq('id', editingRecord.id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Maintenance record updated successfully' });
      setEditDialogOpen(false);
      setEditingRecord(null);
      setNewFiles([]);
      loadMaintenanceRecords();
    } catch (error) {
      console.error('Error updating maintenance record:', error);
      toast({ title: 'Error', description: 'Failed to update maintenance record', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const downloadFile = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage.from('ride-documents').download(doc.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = doc.document_name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      toast({ title: 'Success', description: 'File downloaded successfully' });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({ title: 'Error', description: 'Failed to download file', variant: 'destructive' });
    }
  };

  const getMaintenanceTypeLabel = (type: string) =>
    MAINTENANCE_TYPES.find(t => t.value === type)?.label || type;

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="h-4 w-4 text-muted-foreground" />;
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv')
      return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
    if (mimeType.includes('word') || mimeType.includes('document'))
      return <FileText className="h-4 w-4 text-blue-600" />;
    if (mimeType.startsWith('text/')) return <FileText className="h-4 w-4 text-muted-foreground" />;
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

  const filteredRecords = records.filter(r => filterType === 'all' || r.maintenance_type === filterType);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading maintenance history…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">

      {/* ── Title + Count ── */}
      <div>
        <h3 className="text-xl font-bold" style={{ color: '#0F172A' }}>Maintenance History</h3>
        <p className="text-[13px]" style={{ color: '#64748B' }}>
          {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white border rounded-2xl px-3 py-2.5 shadow-sm flex items-center gap-3"
        style={{ borderColor: '#E2E8F0' }}>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#F1F5F9' }}>
          <Filter className="h-4 w-4" style={{ color: '#475569' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#94A3B8' }}>Filter by type</div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="border-0 p-0 h-auto text-[14px] font-semibold shadow-none focus:ring-0 bg-transparent"
              style={{ color: '#0F172A' }}>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {MAINTENANCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Defects removed — they belong in the Defect Register, not maintenance history */}

      {/* ── Records ── */}
      {filteredRecords.length === 0 ? (
        <EmptyState icon={Calendar} title="No maintenance records found"
          description="Start logging maintenance activities to build your record history" variant="compact" />
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => {
            const recordDocs = documents[record.id] || [];
            return (
              <div key={record.id} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-3.5 space-y-2">

                  {/* Top row: type pill · date · overflow */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getMaintenanceTypeBadge(record.maintenance_type)}
                      <span className="text-[12px] text-muted-foreground shrink-0">
                        {format(parseISO(record.maintenance_date), 'd MMM yyyy')}
                      </span>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openEditDialog(record)}>
                          <Edit className="h-3.5 w-3.5 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteRecordId(record.id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Tappable card body → opens detail */}
                  <button
                    className="w-full text-left space-y-2 active:opacity-80 transition-opacity"
                    onClick={() => { setSelectedRecord(record); setDetailViewOpen(true); }}
                  >
                    <h4 className="text-[14px] font-semibold leading-snug text-foreground line-clamp-2">
                      {record.description}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                      {record.performed_by && (
                        <span>By <span className="font-medium text-foreground">{record.performed_by}</span></span>
                      )}
                      {record.cost != null && (
                        <span>£<span className="font-semibold text-foreground">{record.cost}</span></span>
                      )}
                    </div>
                    {record.parts_replaced && (
                      <p className="text-[12px] text-muted-foreground">
                        <span className="font-medium text-foreground/70">Parts:</span> {record.parts_replaced}
                      </p>
                    )}
                  </button>

                  {/* Attachments row — separate tap target */}
                  {recordDocs.length > 0 && (
                    <button
                      className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline"
                      onClick={() => {
                        setSelectedRecord(record);
                        setAttachmentViewOpen(true);
                      }}
                    >
                      <Paperclip className="h-3 w-3" />
                      {recordDocs.length} attachment{recordDocs.length !== 1 ? 's' : ''}
                    </button>
                  )}

                  {/* Footer timestamps */}
                  <div className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground/70">
                    <span>Created {format(parseISO(record.created_at), 'dd/MM/yy')}</span>
                    {record.updated_at !== record.created_at && (
                      <><span>·</span><span>Edited {format(parseISO(record.updated_at), 'dd/MM/yy')}</span></>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Record Detail View ── */}
      <Dialog open={detailViewOpen} onOpenChange={setDetailViewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Maintenance Record</DialogTitle>
            <DialogDescription>
              {selectedRecord ? format(parseISO(selectedRecord.maintenance_date), 'd MMMM yyyy') : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (() => {
            const detailDocs = documents[selectedRecord.id] || [];
            return (
              <div className="space-y-4">
                <div>{getMaintenanceTypeBadge(selectedRecord.maintenance_type)}</div>

                <div>
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Work Summary</p>
                  <p className="text-sm text-foreground">{selectedRecord.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Date</p>
                    <p className="text-sm font-medium text-foreground">{format(parseISO(selectedRecord.maintenance_date), 'd MMM yyyy')}</p>
                  </div>
                  {selectedRecord.performed_by && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Performed By</p>
                      <p className="text-sm font-medium text-foreground">{selectedRecord.performed_by}</p>
                    </div>
                  )}
                  {selectedRecord.cost != null && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Cost</p>
                      <p className="text-sm font-semibold text-foreground">£{selectedRecord.cost}</p>
                    </div>
                  )}
                  {selectedRecord.next_maintenance_due && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Next Due</p>
                      <p className="text-sm font-medium text-foreground">{format(parseISO(selectedRecord.next_maintenance_due), 'd MMM yyyy')}</p>
                    </div>
                  )}
                </div>

                {selectedRecord.parts_replaced && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Parts Replaced</p>
                    <p className="text-sm text-foreground">{selectedRecord.parts_replaced}</p>
                  </div>
                )}

                {selectedRecord.notes && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm text-foreground">{selectedRecord.notes}</p>
                  </div>
                )}

                {detailDocs.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                      Attachments ({detailDocs.length})
                    </p>
                    <div className="space-y-1.5">
                      {detailDocs.map((doc) => (
                        <button key={doc.id}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-border hover:bg-accent/50 transition-colors text-left"
                          onClick={() => {
                            if (doc.mime_type?.startsWith('image/') && documentUrls[doc.id]) {
                              setPreviewImage(documentUrls[doc.id]);
                            } else {
                              downloadFile(doc);
                            }
                          }}>
                          {doc.mime_type?.startsWith('image/') && documentUrls[doc.id] ? (
                            <img src={documentUrls[doc.id]} alt={doc.document_name} className="h-9 w-9 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              {getFileIcon(doc.mime_type)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-foreground truncate">{doc.document_name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {doc.mime_type?.startsWith('image/') ? 'Tap to preview' : doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : 'Tap to download'}
                            </p>
                          </div>
                          <button className="shrink-0 p-1 rounded hover:bg-muted" onClick={(e) => { e.stopPropagation(); downloadFile(doc); }}>
                            <Download className="h-3.5 w-3.5 text-muted-foreground/50" />
                          </button>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="h-px bg-border" />
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created {format(parseISO(selectedRecord.created_at), 'dd/MM/yyyy HH:mm')}
                  </span>
                  {selectedRecord.updated_at !== selectedRecord.created_at && (
                    <span className="flex items-center gap-1">
                      <Edit className="h-3 w-3" />
                      Edited {format(parseISO(selectedRecord.updated_at), 'dd/MM/yyyy HH:mm')}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Image Preview ── */}
      <Dialog open={!!previewImage} onOpenChange={(open) => { if (!open) setPreviewImage(null); }}>
        <DialogContent className="max-w-2xl p-2">
          {previewImage && (
            <img src={previewImage} alt="Preview" className="w-full h-auto rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteRecordId} onOpenChange={(open) => { if (!open) setDeleteRecordId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this maintenance record and all attached files.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteRecordId) { handleDelete(deleteRecordId); setDeleteRecordId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Attachment Viewer ── */}
      <Dialog open={attachmentViewOpen} onOpenChange={setAttachmentViewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attachments</DialogTitle>
            <DialogDescription>
              {selectedRecord ? format(parseISO(selectedRecord.maintenance_date), 'd MMM yyyy') : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (documents[selectedRecord.id] || []).length > 0 ? (
            <div className="space-y-2">
              {(documents[selectedRecord.id] || []).map((doc) => (
                <button key={doc.id}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-accent/50 transition-colors text-left"
                  onClick={() => {
                    if (doc.mime_type?.startsWith('image/') && documentUrls[doc.id]) {
                      setPreviewImage(documentUrls[doc.id]);
                    } else {
                      downloadFile(doc);
                    }
                  }}>
                  {doc.mime_type?.startsWith('image/') && documentUrls[doc.id] ? (
                    <img src={documentUrls[doc.id]} alt={doc.document_name} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {getFileIcon(doc.mime_type)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.document_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {doc.mime_type?.startsWith('image/') ? 'Tap to preview' : doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : 'Tap to download'}
                    </p>
                  </div>
                  <button className="shrink-0 p-1 rounded hover:bg-muted" onClick={(e) => { e.stopPropagation(); downloadFile(doc); }}>
                    <Download className="h-4 w-4 text-muted-foreground/50" />
                  </button>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No attachments</p>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Maintenance Record</DialogTitle>
            <DialogDescription>Update the maintenance record details. Changes will be timestamped.</DialogDescription>
          </DialogHeader>

          {editingRecord && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground p-3 bg-muted rounded-xl">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Originally created: {format(parseISO(editingRecord.created_at), 'dd/MM/yyyy HH:mm')}</span>
                </div>
                {editingRecord.updated_at !== editingRecord.created_at && (
                  <div className="flex items-center gap-1">
                    <Edit className="h-3 w-3" />
                    <span>Last edited: {format(parseISO(editingRecord.updated_at), 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Maintenance Date *</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !editFormData.maintenance_date && 'text-muted-foreground')}>
                        <Calendar className="mr-2 h-4 w-4" />
                        {editFormData.maintenance_date ? format(editFormData.maintenance_date, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={editFormData.maintenance_date}
                        onSelect={(date) => { setEditFormData({ ...editFormData, maintenance_date: date || new Date() }); setCalendarOpen(false); }}
                        initialFocus className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Maintenance Type *</Label>
                  <Select value={editFormData.maintenance_type} onValueChange={(v) => setEditFormData({ ...editFormData, maintenance_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select maintenance type" /></SelectTrigger>
                    <SelectContent>{MAINTENANCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_performed_by">Performed By *</Label>
                  <Input id="edit_performed_by" value={editFormData.performed_by}
                    onChange={(e) => setEditFormData({ ...editFormData, performed_by: e.target.value })}
                    placeholder="Name of person who performed maintenance" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_cost">Cost (£)</Label>
                  <Input id="edit_cost" type="number" step="0.01" min="0" value={editFormData.cost}
                    onChange={(e) => setEditFormData({ ...editFormData, cost: e.target.value })} placeholder="0.00" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_description">Work Description *</Label>
                <Textarea id="edit_description" value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Describe the maintenance work performed..." rows={3} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_parts_replaced">Parts Replaced</Label>
                <Textarea id="edit_parts_replaced" value={editFormData.parts_replaced}
                  onChange={(e) => setEditFormData({ ...editFormData, parts_replaced: e.target.value })}
                  placeholder="List any parts that were replaced..." rows={2} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_notes">Additional Notes</Label>
                <Textarea id="edit_notes" value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder="Any additional notes or observations..." rows={2} />
              </div>

              {editingRecord && documents[editingRecord.id] && documents[editingRecord.id].length > 0 && (
                <div className="space-y-2">
                  <Label>Existing Attachments ({documents[editingRecord.id].length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {documents[editingRecord.id].map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
                        {doc.mime_type?.startsWith('image/') ? <Camera className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-xs truncate max-w-32">{doc.document_name}</span>
                        <Button variant="ghost" size="sm" onClick={() => downloadFile(doc)} className="h-6 w-6 p-0">
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Add New Files</Label>
                <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx" onChange={handleEditFileUpload} className="hidden" id="edit-file-upload" />
                <input type="file" multiple accept="image/*" capture="environment" onChange={handleEditFileUpload} className="hidden" id="edit-camera-upload" />
                <div className="grid grid-cols-2 gap-3">
                  <Button type="button" variant="outline"
                    className="h-16 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#1E3A5F] rounded-2xl"
                    onClick={() => document.getElementById('edit-camera-upload')?.click()}>
                    <Camera className="h-5 w-5 text-[#475569]" strokeWidth={2} />
                    <span className="text-xs font-medium">Take Photo</span>
                  </Button>
                  <Button type="button" variant="outline"
                    className="h-16 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#1E3A5F] rounded-2xl"
                    onClick={() => document.getElementById('edit-file-upload')?.click()}>
                    <FolderOpen className="h-5 w-5 text-[#475569]" strokeWidth={2} />
                    <span className="text-xs font-medium">Choose File</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Max 10MB per file. Supports: Images, PDF, Word, Excel, Text files</p>
              </div>

              {newFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>New Files to Upload ({newFiles.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {newFiles.map((file, index) => (
                      <div key={index} className="relative group border rounded-md overflow-hidden bg-muted/30 w-16 h-16">
                        {file.type.startsWith('image/') ? (
                          <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-1">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <span className="text-[8px] text-center text-muted-foreground line-clamp-1 mt-0.5">{file.name.split('.').pop()}</span>
                          </div>
                        )}
                        <Button type="button" variant="destructive" size="icon"
                          className="absolute top-0.5 right-0.5 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeNewFile(index)}>
                          <X className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default MaintenanceHistory;
