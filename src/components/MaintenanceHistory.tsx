import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar, Edit, Trash2, FileText, Camera, Download, Eye, Filter, Save, Clock, X, FolderOpen } from 'lucide-react';
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
  ride_categories: {
    name: string;
    description: string | null;
  };
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
  const { toast } = useToast();

  // Allowed MIME types for maintenance documents
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ];

  useEffect(() => {
    loadMaintenanceRecords();
  }, [ride.id, refreshTrigger]);

  const loadMaintenanceRecords = async () => {
    try {
      const { data: recordsData, error: recordsError } = await supabase
        .from('maintenance_records')
        .select('*')
        .eq('ride_id', ride.id)
        .order('maintenance_date', { ascending: false });

      if (recordsError) throw recordsError;

      setRecords(recordsData || []);

      // Load associated documents
      const recordsWithDocs = recordsData?.filter(record => record.document_ids && record.document_ids.length > 0) || [];
      
      if (recordsWithDocs.length > 0) {
        const allDocumentIds = recordsWithDocs.flatMap(record => record.document_ids || []);
        
        const { data: documentsData, error: documentsError } = await supabase
          .from('documents')
          .select('*')
          .in('id', allDocumentIds);

        if (documentsError) throw documentsError;

        // Group documents by maintenance record
        const docsByRecord: Record<string, Document[]> = {};
        recordsWithDocs.forEach(record => {
          docsByRecord[record.id] = (documentsData || []).filter(doc => 
            record.document_ids?.includes(doc.id)
          );
        });

        setDocuments(docsByRecord);

        // Load signed URLs for image documents
        const imageDocuments = (documentsData || []).filter(doc => doc.mime_type?.startsWith('image/'));
        const urls: Record<string, string> = {};
        for (const doc of imageDocuments) {
          try {
            const { data } = await supabase.storage
              .from('ride-documents')
              .createSignedUrl(doc.file_path, 3600); // 1 hour expiry
            if (data?.signedUrl) {
              urls[doc.id] = data.signedUrl;
            }
          } catch (e) {
            console.log('Could not get signed URL for', doc.id);
          }
        }
        setDocumentUrls(urls);
      }

    } catch (error) {
      console.error('Error loading maintenance records:', error);
      toast({
        title: "Error",
        description: "Failed to load maintenance records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    try {
      // 1. Fetch the record to get document_ids for cascade delete
      const { data: record, error: fetchError } = await supabase
        .from('maintenance_records')
        .select('document_ids')
        .eq('id', recordId)
        .single();

      if (fetchError) throw fetchError;

      // 2. If there are linked documents, delete them from storage and database
      if (record?.document_ids && record.document_ids.length > 0) {
        // Get file paths for storage deletion
        const { data: docs } = await supabase
          .from('documents')
          .select('file_path')
          .in('id', record.document_ids);

        // Delete from storage
        if (docs && docs.length > 0) {
          const filePaths = docs.map(d => d.file_path);
          await supabase.storage
            .from('ride-documents')
            .remove(filePaths);
        }

        // Delete document records from database
        await supabase
          .from('documents')
          .delete()
          .in('id', record.document_ids);
      }

      // 3. Delete the maintenance record itself
      const { error } = await supabase
        .from('maintenance_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Maintenance record and attachments deleted successfully",
      });

      loadMaintenanceRecords();
    } catch (error) {
      console.error('Error deleting maintenance record:', error);
      toast({
        title: "Error",
        description: "Failed to delete maintenance record",
        variant: "destructive",
      });
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
      
      if (!isValidType) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not supported.`,
          variant: "destructive",
        });
        continue;
      }
      
      if (!isValidSize) {
        toast({
          title: "File Too Large",
          description: `${file.name} is too large. Max 10MB.`,
          variant: "destructive",
        });
        continue;
      }
      
      if (file.type.startsWith('image/') && file.size > 500000) {
        try {
          const compressed = await compressImage(file);
          processedFiles.push(compressed);
        } catch (error) {
          processedFiles.push(file);
        }
      } else {
        processedFiles.push(file);
      }
    }

    setNewFiles(prev => [...prev, ...processedFiles]);
  };

  const removeNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFilesToStorage = async (files: File[]): Promise<string[]> => {
    const uploadedPaths: string[] = [];

    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `maintenance/${ride.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('ride-documents')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        throw new Error(`Failed to upload ${file.name}`);
      }

      uploadedPaths.push(filePath);
    }

    return uploadedPaths;
  };

  const saveDocuments = async (filePaths: string[], recordDescription: string): Promise<string[]> => {
    const documentIds: string[] = [];

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const originalFile = newFiles[i];
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('documents')
        .insert([{
          user_id: user.id,
          ride_id: ride.id,
          document_name: originalFile.name,
          document_type: 'maintenance',
          file_path: filePath,
          mime_type: originalFile.type,
          file_size: originalFile.size,
          notes: `Maintenance record: ${recordDescription}`,
        }])
        .select('id')
        .single();

      if (error) throw error;
      if (data) documentIds.push(data.id);
    }

    return documentIds;
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    
    if (!editFormData.maintenance_type || !editFormData.description || !editFormData.performed_by) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Upload new files if any
      let newDocumentIds: string[] = [];
      if (newFiles.length > 0) {
        const filePaths = await uploadFilesToStorage(newFiles);
        newDocumentIds = await saveDocuments(filePaths, editFormData.description);
      }

      // Merge with existing document IDs
      const existingDocIds = editingRecord.document_ids || [];
      const allDocumentIds = [...existingDocIds, ...newDocumentIds];

      const { error } = await supabase
        .from('maintenance_records')
        .update({
          maintenance_date: editFormData.maintenance_date.toISOString().split('T')[0],
          maintenance_type: editFormData.maintenance_type,
          description: editFormData.description,
          performed_by: editFormData.performed_by,
          parts_replaced: editFormData.parts_replaced || null,
          cost: editFormData.cost ? parseFloat(editFormData.cost) : null,
          notes: editFormData.notes || null,
          document_ids: allDocumentIds.length > 0 ? allDocumentIds : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingRecord.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Maintenance record updated successfully",
      });

      setEditDialogOpen(false);
      setEditingRecord(null);
      setNewFiles([]);
      loadMaintenanceRecords();
    } catch (error) {
      console.error('Error updating maintenance record:', error);
      toast({
        title: "Error",
        description: "Failed to update maintenance record",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };


  const downloadFile = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('ride-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.document_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "File downloaded successfully",
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const getMaintenanceTypeLabel = (type: string) => {
    return MAINTENANCE_TYPES.find(t => t.value === type)?.label || type;
  };

  const getMaintenanceTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'preventive': 'default',
      'corrective': 'secondary',
      'emergency': 'destructive',
      'inspection': 'outline',
    };
    
    return (
      <Badge variant={variants[type] || 'outline'}>
        {getMaintenanceTypeLabel(type)}
      </Badge>
    );
  };

  const filteredRecords = records.filter(record => 
    filterType === 'all' || record.maintenance_type === filterType
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading maintenance history...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter - mobile responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold">Maintenance History</h3>
          <p className="text-sm text-muted-foreground">
            {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {MAINTENANCE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredRecords.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No maintenance records found"
          description="Start logging maintenance activities to build your record history"
          variant="compact"
        />
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => (
            <Card key={record.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Mobile-first card layout */}
                <div className="p-4 space-y-3">
                  {/* Top row: Badge + Actions */}
                  <div className="flex items-center justify-between gap-2">
                    {getMaintenanceTypeBadge(record.maintenance_type)}
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEditDialog(record)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setSelectedRecord(record)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Maintenance Record Details</DialogTitle>
                            <DialogDescription>
                              {format(parseISO(record.maintenance_date), 'PPP')}
                            </DialogDescription>
                          </DialogHeader>
                          {selectedRecord && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <strong>Type:</strong> {getMaintenanceTypeLabel(selectedRecord.maintenance_type)}
                                </div>
                                <div>
                                  <strong>Date:</strong> {format(parseISO(selectedRecord.maintenance_date), 'd MMM yyyy')}
                                </div>
                                <div>
                                  <strong>Performed by:</strong> {selectedRecord.performed_by}
                                </div>
                                {selectedRecord.cost && (
                                  <div>
                                    <strong>Cost:</strong> £{selectedRecord.cost}
                                  </div>
                                )}
                              </div>
                              <div>
                                <strong>Description:</strong>
                                <p className="mt-1">{selectedRecord.description}</p>
                              </div>
                              {selectedRecord.parts_replaced && (
                                <div>
                                  <strong>Parts Replaced:</strong>
                                  <p className="mt-1">{selectedRecord.parts_replaced}</p>
                                </div>
                              )}
                              {selectedRecord.notes && (
                                <div>
                                  <strong>Notes:</strong>
                                  <p className="mt-1">{selectedRecord.notes}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Record?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this maintenance record and all attached files.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(record.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Description */}
                  <h4 className="font-medium text-sm leading-snug">{record.description}</h4>
                  
                  {/* Meta info - compact grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>{format(parseISO(record.maintenance_date), 'd MMM yyyy')}</span>
                    </div>
                    <div className="truncate">
                      <span className="font-medium">By:</span> {record.performed_by}
                    </div>
                    {record.cost && (
                      <div>
                        <span className="font-medium">Cost:</span> £{record.cost}
                      </div>
                    )}
                    {record.parts_replaced && (
                      <div className="truncate col-span-2">
                        <span className="font-medium">Parts:</span> {record.parts_replaced}
                      </div>
                    )}
                  </div>

                  {/* Notes preview */}
                  {record.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic">
                      {record.notes}
                    </p>
                  )}

                  {/* Attachments */}
                  {documents[record.id] && documents[record.id].length > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        {documents[record.id].length} attachment{documents[record.id].length !== 1 ? 's' : ''}
                      </span>
                      <div className="flex gap-1 overflow-x-auto">
                        {documents[record.id].slice(0, 4).map((doc) => (
                          <div 
                            key={doc.id} 
                            className="relative shrink-0 border rounded overflow-hidden bg-muted/50 cursor-pointer hover:ring-2 hover:ring-primary/50"
                            onClick={() => downloadFile(doc)}
                          >
                            {doc.mime_type?.startsWith('image/') && documentUrls[doc.id] ? (
                              <img
                                src={documentUrls[doc.id]}
                                alt={doc.document_name}
                                className="w-10 h-10 object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 flex items-center justify-center">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                        {documents[record.id].length > 4 && (
                          <div className="w-10 h-10 flex items-center justify-center border rounded bg-muted/50 text-xs text-muted-foreground">
                            +{documents[record.id].length - 4}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timestamps - subtle footer */}
                  <div className="flex flex-wrap gap-x-3 text-[10px] text-muted-foreground/70 pt-2 border-t">
                    <span>Created {format(parseISO(record.created_at), 'dd/MM/yy')}</span>
                    {record.updated_at !== record.created_at && (
                      <span>• Edited {format(parseISO(record.updated_at), 'dd/MM/yy')}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Maintenance Record</DialogTitle>
            <DialogDescription>
              Update the maintenance record details. Changes will be timestamped.
            </DialogDescription>
          </DialogHeader>
          
          {editingRecord && (
            <div className="space-y-4">
              {/* Original timestamp info */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground p-3 bg-muted rounded-md">
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
                {/* Maintenance Date */}
                <div className="space-y-2">
                  <Label>Maintenance Date *</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !editFormData.maintenance_date && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {editFormData.maintenance_date ? format(editFormData.maintenance_date, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={editFormData.maintenance_date}
                        onSelect={(date) => {
                          setEditFormData({ ...editFormData, maintenance_date: date || new Date() });
                          setCalendarOpen(false);
                        }}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Maintenance Type */}
                <div className="space-y-2">
                  <Label>Maintenance Type *</Label>
                  <Select
                    value={editFormData.maintenance_type}
                    onValueChange={(value) => setEditFormData({ ...editFormData, maintenance_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select maintenance type" />
                    </SelectTrigger>
                    <SelectContent>
                      {MAINTENANCE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Performed By */}
                <div className="space-y-2">
                  <Label htmlFor="edit_performed_by">Performed By *</Label>
                  <Input
                    id="edit_performed_by"
                    value={editFormData.performed_by}
                    onChange={(e) => setEditFormData({ ...editFormData, performed_by: e.target.value })}
                    placeholder="Name of person who performed maintenance"
                  />
                </div>

                {/* Cost */}
                <div className="space-y-2">
                  <Label htmlFor="edit_cost">Cost (£)</Label>
                  <Input
                    id="edit_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.cost}
                    onChange={(e) => setEditFormData({ ...editFormData, cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="edit_description">Work Description *</Label>
                <Textarea
                  id="edit_description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Describe the maintenance work performed..."
                  rows={3}
                />
              </div>

              {/* Parts Replaced */}
              <div className="space-y-2">
                <Label htmlFor="edit_parts_replaced">Parts Replaced</Label>
                <Textarea
                  id="edit_parts_replaced"
                  value={editFormData.parts_replaced}
                  onChange={(e) => setEditFormData({ ...editFormData, parts_replaced: e.target.value })}
                  placeholder="List any parts that were replaced..."
                  rows={2}
                />
              </div>

              {/* Additional Notes */}
              <div className="space-y-2">
                <Label htmlFor="edit_notes">Additional Notes</Label>
                <Textarea
                  id="edit_notes"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder="Any additional notes or observations..."
                  rows={2}
                />
              </div>

              {/* Existing Documents */}
              {editingRecord && documents[editingRecord.id] && documents[editingRecord.id].length > 0 && (
                <div className="space-y-2">
                  <Label>Existing Attachments ({documents[editingRecord.id].length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {documents[editingRecord.id].map((doc) => (
                      <div key={doc.id} className="flex items-center space-x-2 p-2 border rounded-md bg-background">
                        {doc.mime_type?.startsWith('image/') ? (
                          <Camera className="h-4 w-4 text-primary" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-xs truncate max-w-32">{doc.document_name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(doc)}
                          className="h-6 w-6 p-0"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Files */}
              <div className="space-y-2">
                <Label>Add New Files</Label>
                
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
                  onChange={handleEditFileUpload}
                  className="hidden"
                  id="edit-file-upload"
                />
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  capture="environment"
                  onChange={handleEditFileUpload}
                  className="hidden"
                  id="edit-camera-upload"
                />

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-16 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#1E3A5F] hover:bg-[#F1F5F9] rounded-2xl transition-all group"
                    onClick={() => document.getElementById('edit-camera-upload')?.click()}
                  >
                    <Camera className="h-5 w-5 text-[#475569] group-hover:text-primary transition-colors" strokeWidth={2} />
                    <span className="text-xs font-medium">Take Photo</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-16 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#1E3A5F] hover:bg-[#F1F5F9] rounded-2xl transition-all group"
                    onClick={() => document.getElementById('edit-file-upload')?.click()}
                  >
                    <FolderOpen className="h-5 w-5 text-[#475569] group-hover:text-primary transition-colors" strokeWidth={2} />
                    <span className="text-xs font-medium">Choose File</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Max 10MB per file. Supports: Images, PDF, Word, Excel, Text files
                </p>
              </div>

              {/* New Files Preview */}
              {newFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>New Files to Upload ({newFiles.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {newFiles.map((file, index) => (
                      <div key={index} className="relative group border rounded-md overflow-hidden bg-muted/30 w-16 h-16">
                        {file.type.startsWith('image/') ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-1">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <span className="text-[8px] text-center text-muted-foreground line-clamp-1 mt-0.5">{file.name.split('.').pop()}</span>
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-0.5 right-0.5 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeNewFile(index)}
                        >
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
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default MaintenanceHistory;