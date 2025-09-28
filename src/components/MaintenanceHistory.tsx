import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar, Edit, Trash2, FileText, Camera, Download, Eye, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
        <div className="text-center text-muted-foreground p-8">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No maintenance records found</p>
          <p className="text-sm">Start logging maintenance activities to build your record history</p>
        </div>
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
    </div>
  );
};

export default MaintenanceHistory;