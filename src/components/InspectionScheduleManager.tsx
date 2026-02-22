import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Calendar as CalendarIcon, Edit, Trash2, AlertTriangle, Clock, Repeat, CheckCircle2 } from 'lucide-react';
import MarkCompleteSheet from '@/components/MarkCompleteSheet';
import { format, differenceInDays, isBefore, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '@/components/EmptyState';
import { Tables } from '@/integrations/supabase/types';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

type ComplianceEvent = Tables<'compliance_events'>;

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
  const [events, setEvents] = useState<ComplianceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ComplianceEvent | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [markingComplete, setMarkingComplete] = useState<string | null>(null);
  const [markCompleteSheetOpen, setMarkCompleteSheetOpen] = useState(false);
  const [markCompleteTarget, setMarkCompleteTarget] = useState<ComplianceEvent | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    inspection_type: '',
    inspection_name: '',
    due_date: undefined as Date | undefined,
    advance_notice_days: 30,
    notes: '',
    is_recurring: false,
    recurrence_value: 1,
    recurrence_unit: 'years' as 'days' | 'weeks' | 'months' | 'years',
  });

  useEffect(() => {
    loadEvents();
  }, [ride.id]);

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('compliance_events')
        .select('*')
        .eq('ride_id', ride.id)
        .in('category', ['inspection', 'ndt'])
        .neq('status', 'cancelled')
        .order('due_date', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading inspection events:', error);
      if (navigator.onLine) {
        toast({
          title: "Error",
          description: "Failed to load inspection schedules",
          variant: "destructive",
        });
      }
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
      is_recurring: false,
      recurrence_value: 1,
      recurrence_unit: 'years',
    });
    setEditingEvent(null);
  };

  const handleEdit = (event: ComplianceEvent) => {
    let recurrenceValue = 1;
    let recurrenceUnit: 'days' | 'weeks' | 'months' | 'years' = 'years';
    if (event.recurrence_rule) {
      const parts = event.recurrence_rule.split(':');
      if (parts.length === 2) {
        recurrenceUnit = parts[0] as any;
        recurrenceValue = parseInt(parts[1]) || 1;
      }
    }

    setFormData({
      inspection_type: event.event_type,
      inspection_name: event.event_name,
      due_date: new Date(event.due_date),
      advance_notice_days: event.advance_notice_days,
      notes: event.notes || '',
      is_recurring: event.is_recurring,
      recurrence_value: recurrenceValue,
      recurrence_unit: recurrenceUnit,
    });
    setEditingEvent(event);
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
        toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
        return;
      }

      const category = formData.inspection_type === 'ndt' ? 'ndt' : 'inspection';
      const recurrenceRule = formData.is_recurring
        ? `${formData.recurrence_unit}:${formData.recurrence_value}`
        : null;
      const dueDateStr = formData.due_date.toISOString().split('T')[0];

      const eventData = {
        user_id: user.id,
        ride_id: ride.id,
        category,
        event_type: formData.inspection_type,
        event_name: formData.inspection_name,
        due_date: dueDateStr,
        advance_notice_days: formData.advance_notice_days,
        notes: formData.notes || null,
        is_recurring: formData.is_recurring,
        recurrence_rule: recurrenceRule,
        recurrence_anchor_date: formData.is_recurring ? dueDateStr : null,
        auto_create_next: formData.is_recurring,
        reminder_enabled: true,
        reminder_days: JSON.stringify([formData.advance_notice_days, 14, 7, 1]),
      };

      if (editingEvent) {
        const { error } = await supabase
          .from('compliance_events')
          .update(eventData)
          .eq('id', editingEvent.id);
        if (error) throw error;
        toast({ title: "Success", description: "Inspection schedule updated" });
      } else {
        const seriesId = formData.is_recurring ? crypto.randomUUID() : null;
        const { error } = await supabase
          .from('compliance_events')
          .insert([{ ...eventData, series_id: seriesId, status: 'open' }]);
        if (error) throw error;
        toast({ title: "Success", description: "Inspection schedule created" });
      }

      setDialogOpen(false);
      resetForm();
      loadEvents();
      queryClient.invalidateQueries({ queryKey: ['compliance'] });
    } catch (error) {
      console.error('Error saving inspection schedule:', error);
      toast({ title: "Error", description: "Failed to save inspection schedule", variant: "destructive" });
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('compliance_events')
        .update({ status: 'cancelled' })
        .eq('id', eventId);
      if (error) throw error;
      toast({ title: "Success", description: "Inspection schedule removed" });
      loadEvents();
      queryClient.invalidateQueries({ queryKey: ['compliance'] });
    } catch (error) {
      console.error('Error deleting inspection schedule:', error);
      toast({ title: "Error", description: "Failed to delete inspection schedule", variant: "destructive" });
    }
  };

  const handleMarkComplete = (event: ComplianceEvent) => {
    setMarkCompleteTarget(event);
    setMarkCompleteSheetOpen(true);
  };

  const handleMarkCompleteFinished = () => {
    loadEvents();
    queryClient.invalidateQueries({ queryKey: ['compliance'] });
  };

  const getStatusBadge = (event: ComplianceEvent) => {
    if (event.status === 'completed') {
      return <Badge className="bg-green-100 text-green-800 border-green-200">Completed</Badge>;
    }
    const due = new Date(event.due_date);
    const today = new Date();
    const daysUntilDue = differenceInDays(due, today);

    if (isBefore(due, today)) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Overdue ({Math.abs(daysUntilDue)}d)
      </Badge>;
    } else if (daysUntilDue <= event.advance_notice_days) {
      return <Badge variant="secondary" className="flex items-center gap-1 bg-warning/15 text-warning border-warning/30">
        <Clock className="h-3 w-3" />
        Due Soon ({daysUntilDue}d)
      </Badge>;
    } else {
      return <Badge variant="outline" className="flex items-center gap-1">
        <CalendarIcon className="h-3 w-3" />
        Scheduled
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

  const scheduledEvents = events.filter(e => e.status === 'open');
  const completedEvents = events.filter(e => e.status === 'completed');

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          Schedule inspections with due dates and advance notifications. When completed, recurring inspections automatically create the next occurrence.
        </AlertDescription>
      </Alert>
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Inspection Schedules</h3>
          <p className="text-sm text-muted-foreground">
            {scheduledEvents.length} scheduled · {completedEvents.length} completed
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? 'Edit Inspection Schedule' : 'Add Inspection Schedule'}
              </DialogTitle>
              <DialogDescription>
                Set up inspection schedules with advance notice and recurrence
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Inspection Type *</Label>
                <Select
                  value={formData.inspection_type}
                  onValueChange={(value) => setFormData({ ...formData, inspection_type: value })}
                >
                  <SelectTrigger><SelectValue placeholder="Select inspection type" /></SelectTrigger>
                  <SelectContent>
                    {INSPECTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Inspection Name *</Label>
                <Input
                  value={formData.inspection_name}
                  onChange={(e) => setFormData({ ...formData, inspection_name: e.target.value })}
                  placeholder="Enter inspection name"
                />
              </div>

              <div className="space-y-2">
                <Label>Due Date *</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.due_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.due_date ? format(formData.due_date, "d MMM yyyy") : "Select due date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.due_date}
                      onSelect={(date) => { setFormData({ ...formData, due_date: date }); setCalendarOpen(false); }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Advance Notice (Days)</Label>
                <Input
                  type="number" min="1" max="365"
                  value={formData.advance_notice_days}
                  onChange={(e) => setFormData({ ...formData, advance_notice_days: parseInt(e.target.value) || 30 })}
                />
              </div>

              {/* Recurrence */}
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <Label className="font-medium">Recurring</Label>
                  </div>
                  <Switch
                    checked={formData.is_recurring}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
                  />
                </div>
                {formData.is_recurring && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Every</span>
                    <Input
                      type="number" min="1" max="99"
                      value={formData.recurrence_value}
                      onChange={(e) => setFormData({ ...formData, recurrence_value: parseInt(e.target.value) || 1 })}
                      className="w-16 h-9"
                    />
                    <Select value={formData.recurrence_unit} onValueChange={(v) => setFormData({ ...formData, recurrence_unit: v as any })}>
                      <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="days">Days</SelectItem>
                        <SelectItem value="weeks">Weeks</SelectItem>
                        <SelectItem value="months">Months</SelectItem>
                        <SelectItem value="years">Years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes or requirements"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave}>{editingEvent ? 'Update' : 'Create'} Schedule</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {scheduledEvents.length === 0 && completedEvents.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="No inspection schedules found"
          description="Add your first inspection schedule to start tracking due dates"
          variant="compact"
        />
      ) : (
        <div className="space-y-4">
          {scheduledEvents.map((event) => (
            <Card key={event.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">{event.event_name}</h4>
                      {getStatusBadge(event)}
                      {event.is_recurring && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Repeat className="h-3 w-3" /> Recurring
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><span className="font-medium">Type:</span> {INSPECTION_TYPES.find(t => t.value === event.event_type)?.label || event.event_type}</p>
                      <p><span className="font-medium">Due Date:</span> {format(new Date(event.due_date), 'd MMM yyyy')}</p>
                      <p><span className="font-medium">Advance Notice:</span> {event.advance_notice_days} days</p>
                      {event.notes && <p><span className="font-medium">Notes:</span> {event.notes}</p>}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkComplete(event)}
                      disabled={markingComplete === event.id}
                      className="gap-1"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Complete</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(event)}>
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
                            Are you sure you want to delete "{event.event_name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(event.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {event.is_recurring && event.auto_create_next && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Completing this will automatically schedule the next occurrence.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Completed section */}
          {completedEvents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Completed</h4>
              {completedEvents.slice(0, 5).map((event) => (
                <Card key={event.id} className="opacity-70">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">{event.event_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {event.completed_at ? format(new Date(event.completed_at), 'd MMM yyyy') : ''}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mark Complete Sheet */}
      {markCompleteTarget && (
        <MarkCompleteSheet
          open={markCompleteSheetOpen}
          onOpenChange={(open) => { setMarkCompleteSheetOpen(open); if (!open) setMarkCompleteTarget(null); }}
          eventId={markCompleteTarget.id}
          eventName={markCompleteTarget.event_name}
          isRecurring={markCompleteTarget.is_recurring}
          recurrenceRule={markCompleteTarget.recurrence_rule}
          onCompleted={handleMarkCompleteFinished}
        />
      )}
    </div>
  );
};

export default InspectionScheduleManager;
