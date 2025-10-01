import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { TestTube, Plus, Edit, Trash2, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { format } from 'date-fns';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

type NDTSchedule = Tables<'ndt_schedules'>;

interface NDTScheduleManagerProps {
  ride: Ride;
}

const NDTScheduleManager = ({ ride }: NDTScheduleManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<NDTSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<NDTSchedule | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    schedule_name: '',
    component_description: '',
    ndt_method: '',
    frequency_months: 12,
    last_inspection_date: '',
    notes: ''
  });

  useEffect(() => {
    if (user) {
      loadSchedules();
    }
  }, [user, ride.id]);

  const loadSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('ndt_schedules')
        .select('*')
        .eq('user_id', user?.id)
        .eq('ride_id', ride.id)
        .order('next_inspection_due', { ascending: true });

      if (error) {
        throw error;
      }

      setSchedules(data || []);
    } catch (error: any) {
      console.error('Error loading NDT schedules:', error);
      toast({
        title: "Error loading schedules",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      schedule_name: '',
      component_description: '',
      ndt_method: '',
      frequency_months: 12,
      last_inspection_date: '',
      notes: ''
    });
    setEditingSchedule(null);
  };

  const handleEdit = (schedule: NDTSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      schedule_name: schedule.schedule_name,
      component_description: schedule.component_description,
      ndt_method: schedule.ndt_method,
      frequency_months: schedule.frequency_months,
      last_inspection_date: schedule.last_inspection_date || '',
      notes: schedule.notes || ''
    });
    setShowDialog(true);
  };

  const calculateNextDueDate = (lastDate: string, frequencyMonths: number): string => {
    if (!lastDate) return '';
    const date = new Date(lastDate);
    date.setMonth(date.getMonth() + frequencyMonths);
    return date.toISOString().split('T')[0];
  };

  const handleSave = async () => {
    if (!formData.schedule_name.trim() || !formData.component_description.trim() || !formData.ndt_method) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const nextDueDate = formData.last_inspection_date 
      ? calculateNextDueDate(formData.last_inspection_date, formData.frequency_months)
      : null;

    try {
      if (editingSchedule) {
        const { error } = await supabase
          .from('ndt_schedules')
          .update({
            ...formData,
            next_inspection_due: nextDueDate,
          })
          .eq('id', editingSchedule.id);

        if (error) throw error;

        toast({
          title: "Schedule updated",
          description: "NDT schedule has been updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('ndt_schedules')
          .insert({
            ...formData,
            user_id: user?.id,
            ride_id: ride.id,
            next_inspection_due: nextDueDate,
          });

        if (error) throw error;

        toast({
          title: "Schedule created",
          description: "NDT schedule has been created successfully",
        });
      }

      setShowDialog(false);
      resetForm();
      loadSchedules();
    } catch (error: any) {
      console.error('Error saving NDT schedule:', error);
      toast({
        title: "Error saving schedule",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('ndt_schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;

      toast({
        title: "Schedule deleted",
        description: "NDT schedule has been deleted successfully",
      });

      loadSchedules();
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      toast({
        title: "Error deleting schedule",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (schedule: NDTSchedule) => {
    if (!schedule.next_inspection_due) {
      return <Badge variant="secondary">No Due Date</Badge>;
    }

    const today = new Date();
    const dueDate = new Date(schedule.next_inspection_due);
    const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff < 0) {
      return <Badge variant="destructive">Overdue</Badge>;
    } else if (daysDiff <= 30) {
      return <Badge variant="outline">Due Soon</Badge>;
    } else {
      return <Badge variant="default">Current</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <TestTube className="mx-auto h-8 w-8 text-muted-foreground animate-pulse" />
            <p className="text-muted-foreground mt-2">Loading NDT schedules...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          <strong>NDT Schedule Tracking:</strong> Track when NDT (Non-Destructive Testing) inspections are due for ride components. Schedules are managed by showmen, but actual NDT inspections must be conducted by independent qualified NDT inspectors.
        </AlertDescription>
      </Alert>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">NDT Inspection Tracking (Showmen)</h3>
          <p className="text-muted-foreground">
            Track NDT inspection requirements for {ride.ride_name}. Actual inspections conducted by independent NDT inspectors.
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Add Schedule</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingSchedule ? 'Edit' : 'Create'} NDT Tracking Schedule
              </DialogTitle>
              <DialogDescription>
                Set up tracking for NDT inspections. Actual inspections will be performed by independent NDT inspectors.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="schedule_name">Schedule Name</Label>
                <Input
                  id="schedule_name"
                  value={formData.schedule_name}
                  onChange={(e) => setFormData(prev => ({...prev, schedule_name: e.target.value}))}
                  placeholder="e.g., Main Support Structure NDT"
                />
              </div>
              <div>
                <Label htmlFor="component_description">Component Description</Label>
                <Input
                  id="component_description"
                  value={formData.component_description}
                  onChange={(e) => setFormData(prev => ({...prev, component_description: e.target.value}))}
                  placeholder="e.g., Main support welds and joints"
                />
              </div>
              <div>
                <Label htmlFor="ndt_method">NDT Method</Label>
                <Select 
                  value={formData.ndt_method} 
                  onValueChange={(value) => setFormData(prev => ({...prev, ndt_method: value}))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select NDT method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ultrasonic">Ultrasonic Testing</SelectItem>
                    <SelectItem value="magnetic_particle">Magnetic Particle Testing</SelectItem>
                    <SelectItem value="dye_penetrant">Dye Penetrant Testing</SelectItem>
                    <SelectItem value="radiographic">Radiographic Testing</SelectItem>
                    <SelectItem value="visual">Visual Testing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="frequency_months">Frequency (Months)</Label>
                <Input
                  id="frequency_months"
                  type="number"
                  min="1"
                  max="60"
                  value={formData.frequency_months}
                  onChange={(e) => setFormData(prev => ({...prev, frequency_months: parseInt(e.target.value)}))}
                />
              </div>
              <div>
                <Label htmlFor="last_inspection_date">Last Inspection Date (Optional)</Label>
                <Input
                  id="last_inspection_date"
                  type="date"
                  value={formData.last_inspection_date}
                  onChange={(e) => setFormData(prev => ({...prev, last_inspection_date: e.target.value}))}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))}
                  placeholder="Additional notes or requirements..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingSchedule ? 'Update' : 'Create'} Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <TestTube className="mx-auto h-16 w-16 text-muted-foreground" />
              <h3 className="text-lg font-semibold mt-4">No NDT tracking schedules</h3>
              <p className="text-muted-foreground mb-4">
                Create tracking schedules for NDT inspections required for your equipment. Actual inspections will be conducted by independent NDT inspectors.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <TestTube className="h-5 w-5" />
                    <div>
                      <CardTitle>{schedule.schedule_name}</CardTitle>
                      <CardDescription>{schedule.component_description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(schedule)}
                    <Button size="sm" variant="outline" onClick={() => handleEdit(schedule)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete NDT Schedule</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{schedule.schedule_name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(schedule.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Method</p>
                    <p className="text-muted-foreground">{schedule.ndt_method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                  </div>
                  <div>
                    <p className="font-medium">Frequency</p>
                    <p className="text-muted-foreground">Every {schedule.frequency_months} months</p>
                  </div>
                  <div>
                    <p className="font-medium">Next Due</p>
                    <p className="text-muted-foreground flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {schedule.next_inspection_due 
                          ? format(new Date(schedule.next_inspection_due), 'PPP')
                          : 'Not scheduled'
                        }
                      </span>
                    </p>
                  </div>
                </div>
                {schedule.notes && (
                  <div className="mt-4 p-3 bg-muted rounded">
                    <p className="text-sm">{schedule.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default NDTScheduleManager;