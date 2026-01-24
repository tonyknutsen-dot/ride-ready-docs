import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar, Edit, Trash2, FileText, Camera, Download, Eye, Filter, Save, Clock } from 'lucide-react';
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
  const { toast } = useToast();

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
      const { error } = await supabase
        .from('maintenance_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Maintenance record deleted successfully",
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
    setEditDialogOpen(true);
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Maintenance History</h3>
          <p className="text-sm text-muted-foreground">
            View and manage maintenance records for {ride.ride_name}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
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
      </div>

      {filteredRecords.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No maintenance records found"
          description="Start logging maintenance activities to build your record history"
          variant="compact"
        />
      ) : (
        <div className="grid gap-4">
          {filteredRecords.map((record) => (
            <Card key={record.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold">{record.description}</h4>
                      {getMaintenanceTypeBadge(record.maintenance_type)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div><span className="font-medium">Date:</span> {format(parseISO(record.maintenance_date), 'PPP')}</div>
                      <div><span className="font-medium">Performed by:</span> {record.performed_by}</div>
                      {record.cost && (
                        <div><span className="font-medium">Cost:</span> £{record.cost}</div>
                      )}
                      {record.parts_replaced && (
                        <div><span className="font-medium">Parts:</span> {record.parts_replaced}</div>
                      )}
                    </div>

                    {/* Timestamps */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Created: {format(parseISO(record.created_at), 'dd/MM/yyyy HH:mm')}</span>
                      </div>
                      {record.updated_at !== record.created_at && (
                        <div className="flex items-center gap-1">
                          <Edit className="h-3 w-3" />
                          <span>Edited: {format(parseISO(record.updated_at), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                      )}
                    </div>

                    {record.notes && (
                      <div className="text-sm">
                        <span className="font-medium">Notes:</span> {record.notes}
                      </div>
                    )}

                    {/* Documents */}
                    {documents[record.id] && documents[record.id].length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Attachments ({documents[record.id].length})</div>
                        <div className="flex flex-wrap gap-2">
                          {documents[record.id].map((doc) => (
                            <div key={doc.id} className="flex items-center space-x-2 p-2 border rounded-md bg-background">
                              {doc.mime_type?.startsWith('image/') ? (
                                <Camera className="h-4 w-4 text-blue-500" />
                              ) : (
                                <FileText className="h-4 w-4 text-green-500" />
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
                  </div>

                  <div className="flex space-x-2">
                    {/* Edit Button */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openEditDialog(record)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedRecord(record)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Maintenance Record Details</DialogTitle>
                          <DialogDescription>
                            Complete details for maintenance performed on {format(parseISO(record.maintenance_date), 'PPP')}
                          </DialogDescription>
                        </DialogHeader>
                        {selectedRecord && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <strong>Type:</strong> {getMaintenanceTypeLabel(selectedRecord.maintenance_type)}
                              </div>
                              <div>
                                <strong>Date:</strong> {format(parseISO(selectedRecord.maintenance_date), 'PPP')}
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
                              <p className="mt-1 text-sm">{selectedRecord.description}</p>
                            </div>

                            {selectedRecord.parts_replaced && (
                              <div>
                                <strong>Parts Replaced:</strong>
                                <p className="mt-1 text-sm">{selectedRecord.parts_replaced}</p>
                              </div>
                            )}

                            {selectedRecord.notes && (
                              <div>
                                <strong>Additional Notes:</strong>
                                <p className="mt-1 text-sm">{selectedRecord.notes}</p>
                              </div>
                            )}

                            {documents[selectedRecord.id] && documents[selectedRecord.id].length > 0 && (
                              <div>
                                <strong>Attachments:</strong>
                                <div className="mt-2 space-y-2">
                                  {documents[selectedRecord.id].map((doc) => (
                                    <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                                      <div className="flex items-center space-x-2">
                                        {doc.mime_type?.startsWith('image/') ? (
                                          <Camera className="h-4 w-4 text-blue-500" />
                                        ) : (
                                          <FileText className="h-4 w-4 text-green-500" />
                                        )}
                                        <span className="text-sm">{doc.document_name}</span>
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => downloadFile(doc)}
                                      >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Maintenance Record</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this maintenance record? This action cannot be undone.
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