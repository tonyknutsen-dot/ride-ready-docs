import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Calendar as CalendarIcon, Edit, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { format, differenceInDays, isBefore, isAfter, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

type InspectionSchedule = Tables<'inspection_schedules'>;

interface InspectionScheduleManagerProps {
  ride: Ride;
}

const INSPECTION_TYPES = [
  { value: 'in-service', label: 'In-Service Inspection' },
  { value: 'electrical', label: 'Electrical Inspection' },
  { value: 'ndt', label: 'NDT Inspection' },
  { value: 'structural', label: 'Structural Inspection' },
  { value: 'hydraulic', label: 'Hydraulic Inspection' },
  { value: 'mechanical', label: 'Mechanical Inspection' },
  { value: 'safety', label: 'Safety Inspection' },
  { value: 'other', label: 'Other' },
];

const InspectionScheduleManager = ({ ride }: InspectionScheduleManagerProps) => {
  const [schedules, setSchedules] = useState<InspectionSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<InspectionSchedule | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    inspection_type: '',
    inspection_name: '',
    due_date: undefined as Date | undefined,
    advance_notice_days: 30,
    notes: '',
  });

  useEffect(() => {
    loadSchedules();
  }, [ride.id]);

  const loadSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('inspection_schedules')
        .select('*')
        .eq('ride_id', ride.id)
        .eq('is_active', true)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error loading inspection schedules:', error);
      toast({
        title: "Error",
        description: "Failed to load inspection schedules",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      inspection_type: '',
      inspection_name: '',
      due_date: undefined,
      advance_notice_days: 30,
      notes: '',
    });
    setEditingSchedule(null);
  };

  const handleEdit = (schedule: InspectionSchedule) => {
    setFormData({
      inspection_type: schedule.inspection_type,
      inspection_name: schedule.inspection_name,
      due_date: new Date(schedule.due_date),
      advance_notice_days: schedule.advance_notice_days,
      notes: schedule.notes || '',
    });
    setEditingSchedule(schedule);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.inspection_type || !formData.inspection_name || !formData.due_date) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to manage inspection schedules",
          variant: "destructive",
        });
        return;
      }

      const scheduleData = {
        user_id: user.id,
        ride_id: ride.id,
        inspection_type: formData.inspection_type,
        inspection_name: formData.inspection_name,
        due_date: formData.due_date.toISOString().split('T')[0],
        advance_notice_days: formData.advance_notice_days,
        notes: formData.notes,
      };

      if (editingSchedule) {
        const { error } = await supabase
          .from('inspection_schedules')
          .update(scheduleData)
          .eq('id', editingSchedule.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Inspection schedule updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('inspection_schedules')
          .insert([scheduleData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Inspection schedule created successfully",
        });
      }

      setDialogOpen(false);
      resetForm();
      loadSchedules();
    } catch (error) {
      console.error('Error saving inspection schedule:', error);
      toast({
        title: "Error",
        description: "Failed to save inspection schedule",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('inspection_schedules')
        .update({ is_active: false })
        .eq('id', scheduleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Inspection schedule deleted successfully",
      });

      loadSchedules();
    } catch (error) {
      console.error('Error deleting inspection schedule:', error);
      toast({
        title: "Error",
        description: "Failed to delete inspection schedule",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (dueDate: string, advanceNoticeDays: number) => {
    const due = new Date(dueDate);
    const today = new Date();
    const noticeDate = addDays(due, -advanceNoticeDays);
    const daysUntilDue = differenceInDays(due, today);

    if (isBefore(due, today)) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Overdue ({Math.abs(daysUntilDue)} days)
      </Badge>;
    } else if (isBefore(noticeDate, today)) {
      return <Badge variant="secondary" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Due Soon ({daysUntilDue} days)
      </Badge>;
    } else {
      return <Badge variant="outline" className="flex items-center gap-1">
        <CalendarIcon className="h-3 w-3" />
        Current
      </Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading inspection schedules...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Inspection Schedules</h3>
          <p className="text-sm text-muted-foreground">
            Track inspection due dates and manage advance notifications
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Inspection Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingSchedule ? 'Edit Inspection Schedule' : 'Add Inspection Schedule'}
              </DialogTitle>
              <DialogDescription>
                Set up inspection schedules with advance notice periods
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inspection_type">Inspection Type *</Label>
                <Select
                  value={formData.inspection_type}
                  onValueChange={(value) => setFormData({ ...formData, inspection_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select inspection type" />
                  </SelectTrigger>
                  <SelectContent>
                    {INSPECTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inspection_name">Inspection Name *</Label>
                <Input
                  id="inspection_name"
                  value={formData.inspection_name}
                  onChange={(e) => setFormData({ ...formData, inspection_name: e.target.value })}
                  placeholder="Enter inspection name"
                />
              </div>

              <div className="space-y-2">
                <Label>Due Date *</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.due_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.due_date ? format(formData.due_date, "PPP") : "Select due date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.due_date}
                      onSelect={(date) => {
                        setFormData({ ...formData, due_date: date });
                        setCalendarOpen(false);
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="advance_notice_days">Advance Notice (Days)</Label>
                <Input
                  id="advance_notice_days"
                  type="number"
                  min="1"
                  max="365"
                  value={formData.advance_notice_days}
                  onChange={(e) => setFormData({ ...formData, advance_notice_days: parseInt(e.target.value) || 30 })}
                />
                <p className="text-xs text-muted-foreground">
                  How many days before the due date should notifications start
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes or requirements"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editingSchedule ? 'Update' : 'Create'} Schedule
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {schedules.length === 0 ? (
        <div className="text-center text-muted-foreground p-8">
          <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No inspection schedules found</p>
          <p className="text-sm">Add your first inspection schedule to start tracking due dates</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{schedule.inspection_name}</h4>
                      {getStatusBadge(schedule.due_date, schedule.advance_notice_days)}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><span className="font-medium">Type:</span> {INSPECTION_TYPES.find(t => t.value === schedule.inspection_type)?.label || schedule.inspection_type}</p>
                      <p><span className="font-medium">Due Date:</span> {format(new Date(schedule.due_date), 'PPP')}</p>
                      <p><span className="font-medium">Advance Notice:</span> {schedule.advance_notice_days} days</p>
                      {schedule.notes && (
                        <p><span className="font-medium">Notes:</span> {schedule.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(schedule)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Inspection Schedule</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete the inspection schedule for "{schedule.inspection_name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(schedule.id)}>
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

export default InspectionScheduleManager;