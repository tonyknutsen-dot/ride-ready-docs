import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Wrench,
  Plus,
  Calendar as CalendarIcon,
  DollarSign,
  User,
  FileText,
  Edit,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface MaintenanceRecord {
  id: string;
  ride_id: string;
  maintenance_type: string;
  description: string;
  cost?: number;
  maintenance_date: string;
  performed_by?: string;
  parts_replaced?: string;
  next_maintenance_due?: string;
  notes?: string;
  created_at: string;
  rides: {
    id: string;
    ride_name: string;
  };
}

interface Ride {
  id: string;
  ride_name: string;
}

const MaintenanceTracker = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [maintenanceDate, setMaintenanceDate] = useState<Date | undefined>(new Date());
  const [nextDueDate, setNextDueDate] = useState<Date | undefined>();
  const [formData, setFormData] = useState({
    ride_id: '',
    maintenance_type: '',
    description: '',
    cost: '',
    performed_by: '',
    parts_replaced: '',
    notes: '',
  });

  useEffect(() => {
    if (user) {
      loadRecords();
      loadRides();
    }
  }, [user]);

  const loadRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('maintenance_records')
        .select(`
          *,
          rides(id, ride_name)
        `)
        .eq('user_id', user?.id)
        .order('maintenance_date', { ascending: false });

      if (error) throw error;
      setRecords(data as MaintenanceRecord[] || []);
    } catch (error) {
      console.error('Error loading maintenance records:', error);
      toast({
        title: "Error loading records",
        description: "Failed to load maintenance records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRides = async () => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('id, ride_name')
        .eq('user_id', user?.id)
        .order('ride_name');

      if (error) throw error;
      setRides(data || []);
    } catch (error) {
      console.error('Error loading rides:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      ride_id: '',
      maintenance_type: '',
      description: '',
      cost: '',
      performed_by: '',
      parts_replaced: '',
      notes: '',
    });
    setMaintenanceDate(new Date());
    setNextDueDate(undefined);
    setEditingRecord(null);
  };

  const handleEdit = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setFormData({
      ride_id: record.ride_id,
      maintenance_type: record.maintenance_type,
      description: record.description,
      cost: record.cost?.toString() || '',
      performed_by: record.performed_by || '',
      parts_replaced: record.parts_replaced || '',
      notes: record.notes || '',
    });
    setMaintenanceDate(new Date(record.maintenance_date));
    setNextDueDate(record.next_maintenance_due ? new Date(record.next_maintenance_due) : undefined);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.ride_id || !formData.maintenance_type || !formData.description || !maintenanceDate) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const recordData = {
        user_id: user?.id,
        ride_id: formData.ride_id,
        maintenance_type: formData.maintenance_type,
        description: formData.description,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        maintenance_date: format(maintenanceDate, 'yyyy-MM-dd'),
        performed_by: formData.performed_by || null,
        parts_replaced: formData.parts_replaced || null,
        next_maintenance_due: nextDueDate ? format(nextDueDate, 'yyyy-MM-dd') : null,
        notes: formData.notes || null,
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('maintenance_records')
          .update(recordData)
          .eq('id', editingRecord.id)
          .eq('user_id', user?.id);

        if (error) throw error;

        toast({
          title: "Record updated",
          description: "Maintenance record has been updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('maintenance_records')
          .insert(recordData);

        if (error) throw error;

        toast({
          title: "Record added",
          description: "New maintenance record has been added successfully",
        });
      }

      setShowDialog(false);
      resetForm();
      loadRecords();
    } catch (error) {
      console.error('Error saving maintenance record:', error);
      toast({
        title: "Error saving record",
        description: "Failed to save maintenance record",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this maintenance record?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('maintenance_records')
        .delete()
        .eq('id', recordId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setRecords(prev => prev.filter(r => r.id !== recordId));
      toast({
        title: "Record deleted",
        description: "Maintenance record has been deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting maintenance record:', error);
      toast({
        title: "Error deleting record",
        description: "Failed to delete maintenance record",
        variant: "destructive",
      });
    }
  };

  const getMaintenanceTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'preventive': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'corrective': return 'bg-red-100 text-red-800 border-red-200';
      case 'emergency': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'inspection': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Maintenance Tracker
              </CardTitle>
              <CardDescription>
                Track repairs, maintenance, and service records for your rides
              </CardDescription>
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setShowDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Record
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingRecord ? 'Edit Maintenance Record' : 'Add Maintenance Record'}
                  </DialogTitle>
                  <DialogDescription>
                    Record details about maintenance, repairs, and service work performed on your rides.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  {/* Ride Selection */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="ride" className="text-right">Ride *</Label>
                    <Select value={formData.ride_id} onValueChange={(value) => setFormData(prev => ({ ...prev, ride_id: value }))}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a ride" />
                      </SelectTrigger>
                      <SelectContent>
                        {rides.map((ride) => (
                          <SelectItem key={ride.id} value={ride.id}>
                            {ride.ride_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Maintenance Type */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="type" className="text-right">Type *</Label>
                    <Select value={formData.maintenance_type} onValueChange={(value) => setFormData(prev => ({ ...prev, maintenance_type: value }))}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select maintenance type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preventive">Preventive Maintenance</SelectItem>
                        <SelectItem value="corrective">Corrective Maintenance</SelectItem>
                        <SelectItem value="emergency">Emergency Repair</SelectItem>
                        <SelectItem value="inspection">Inspection/Testing</SelectItem>
                        <SelectItem value="upgrade">Upgrade/Modification</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Description */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">Description *</Label>
                    <Textarea
                      id="description"
                      className="col-span-3"
                      placeholder="Describe the maintenance work performed..."
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  {/* Maintenance Date */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "col-span-3 justify-start text-left font-normal",
                            !maintenanceDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {maintenanceDate ? format(maintenanceDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={maintenanceDate}
                          onSelect={setMaintenanceDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Cost */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="cost" className="text-right">Cost</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      className="col-span-3"
                      placeholder="0.00"
                      value={formData.cost}
                      onChange={(e) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                    />
                  </div>

                  {/* Performed By */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="performed_by" className="text-right">Performed By</Label>
                    <Input
                      id="performed_by"
                      className="col-span-3"
                      placeholder="Technician or company name"
                      value={formData.performed_by}
                      onChange={(e) => setFormData(prev => ({ ...prev, performed_by: e.target.value }))}
                    />
                  </div>

                  {/* Parts Replaced */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="parts_replaced" className="text-right">Parts Replaced</Label>
                    <Textarea
                      id="parts_replaced"
                      className="col-span-3"
                      placeholder="List parts that were replaced..."
                      value={formData.parts_replaced}
                      onChange={(e) => setFormData(prev => ({ ...prev, parts_replaced: e.target.value }))}
                    />
                  </div>

                  {/* Next Maintenance Due */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Next Due</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "col-span-3 justify-start text-left font-normal",
                            !nextDueDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {nextDueDate ? format(nextDueDate, "PPP") : <span>Set next due date (optional)</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={nextDueDate}
                          onSelect={setNextDueDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Notes */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="notes" className="text-right">Notes</Label>
                    <Textarea
                      id="notes"
                      className="col-span-3"
                      placeholder="Additional notes or observations..."
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    {editingRecord ? 'Update Record' : 'Save Record'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Maintenance Records */}
      <div className="space-y-4">
        {records.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Wrench className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Maintenance Records</h3>
              <p className="text-muted-foreground mb-4">
                Start tracking maintenance work to keep your rides in optimal condition
              </p>
              <Button onClick={() => { resetForm(); setShowDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Record
              </Button>
            </CardContent>
          </Card>
        ) : (
          records.map((record) => (
            <Card key={record.id} className="hover:shadow-elegant transition-smooth">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex items-center space-x-3">
                      <h3 className="font-semibold text-lg">{record.rides.ride_name}</h3>
                      <Badge variant="outline" className={getMaintenanceTypeColor(record.maintenance_type)}>
                        {record.maintenance_type}
                      </Badge>
                      {record.next_maintenance_due && isOverdue(record.next_maintenance_due) && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Overdue
                        </Badge>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-muted-foreground">{record.description}</p>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span>{format(new Date(record.maintenance_date), 'MMM d, yyyy')}</span>
                      </div>
                      
                      {record.cost && (
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>${record.cost.toFixed(2)}</span>
                        </div>
                      )}
                      
                      {record.performed_by && (
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{record.performed_by}</span>
                        </div>
                      )}

                      {record.next_maintenance_due && (
                        <div className="flex items-center space-x-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          <span>Next: {format(new Date(record.next_maintenance_due), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                    </div>

                    {/* Parts and Notes */}
                    {(record.parts_replaced || record.notes) && (
                      <div className="space-y-2 text-sm">
                        {record.parts_replaced && (
                          <div>
                            <span className="font-medium">Parts Replaced: </span>
                            <span className="text-muted-foreground">{record.parts_replaced}</span>
                          </div>
                        )}
                        {record.notes && (
                          <div>
                            <span className="font-medium">Notes: </span>
                            <span className="text-muted-foreground">{record.notes}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(record)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(record.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default MaintenanceTracker;