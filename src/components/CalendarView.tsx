import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Clock,
  AlertTriangle,
  Repeat
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isSameDay, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { z } from 'zod';
import { Tables } from '@/integrations/supabase/types';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'check' | 'inspection' | 'maintenance' | 'document_expiry' | 'ndt';
  status: 'pending' | 'completed' | 'overdue';
  rideId?: string;
  rideName?: string;
}

type Ride = Tables<'rides'>;

const EVENT_TYPES = [
  { value: 'insurance-expiry', label: 'Insurance Expiry', category: 'Document Expiry' },
  { value: 'doc-expiry', label: 'Inspection Certificate Expiry', category: 'Document Expiry' },
  { value: 'safety-cert-expiry', label: 'Safety Certificate Expiry', category: 'Document Expiry' },
  { value: 'other-document-expiry', label: 'Other Document Expiry', category: 'Document Expiry' },
  { value: 'in-service', label: 'In-Service Inspection', category: 'Inspections' },
  { value: 'electrical', label: 'Electrical Inspection', category: 'Inspections' },
  { value: 'ndt', label: 'NDT Inspection', category: 'Inspections' },
  { value: 'structural', label: 'Structural Inspection', category: 'Inspections' },
  { value: 'hydraulic', label: 'Hydraulic Inspection', category: 'Inspections' },
  { value: 'mechanical', label: 'Mechanical Inspection', category: 'Inspections' },
  { value: 'safety', label: 'Safety Inspection', category: 'Inspections' },
  { value: 'daily-check', label: 'Daily Check', category: 'Checks' },
  { value: 'monthly-check', label: 'Monthly Check', category: 'Checks' },
  { value: 'yearly-check', label: 'Yearly Check', category: 'Checks' },
  { value: 'maintenance', label: 'Scheduled Maintenance', category: 'Maintenance' },
  { value: 'preventive', label: 'Preventive Maintenance', category: 'Maintenance' },
  { value: 'repair', label: 'Repair Follow-up', category: 'Maintenance' },
];

const inspectionSchema = z.object({
  ride_id: z.string().uuid({ message: "Please select a ride" }),
  inspection_type: z.string().min(1, { message: "Please select an inspection type" }),
  inspection_name: z.string().trim().min(1, { message: "Inspection name is required" }).max(200, { message: "Inspection name must be less than 200 characters" }),
  due_date: z.date({ required_error: "Due date is required" }),
  advance_notice_days: z.number().min(1, { message: "Advance notice must be at least 1 day" }).max(365, { message: "Advance notice cannot exceed 365 days" }),
  notes: z.string().max(1000, { message: "Notes must be less than 1000 characters" }).optional(),
});

const CalendarView = () => {
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
  const [showHelpTips, setShowHelpTips] = useState(false);
  const [rides, setRides] = useState<Ride[]>([]);
  const [rideDocuments, setRideDocuments] = useState<{ id: string; document_name: string; expires_at: string | null }[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [formData, setFormData] = useState({
    selected_document_id: '',
    ride_id: '',
    inspection_type: '',
    inspection_name: '',
    due_date: undefined as Date | undefined,
    advance_notice_days: 30,
    notes: '',
    enable_reminders: true,
    reminder_days: [7, 1] as number[],
    is_recurring: false,
    recurrence_value: 1,
    recurrence_unit: 'months' as 'days' | 'weeks' | 'months' | 'years',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const isTrialOrExpired = subscription?.subscriptionStatus === 'expired';

  useEffect(() => {
    if (user && subscription && effectiveUserId) {
      loadCalendarEvents();
      loadRides();
    } else {
      setLoading(false);
    }
  }, [user, currentMonth, subscription?.subscriptionStatus, effectiveUserId]);

  const loadRides = async () => {
    if (!user?.id) return;
    try {
      let ridesQuery = supabase.from('rides').select('*').order('ride_name');
      if (!isStaff) ridesQuery = ridesQuery.eq('user_id', effectiveUserId) as any;
      const { data, error } = await ridesQuery;
      if (error) throw error;
      setRides(data || []);
    } catch (error) {
      console.error('Error loading rides:', error);
    }
  };

  const loadRideDocuments = async (rideId: string) => {
    if (!user?.id || !rideId) { setRideDocuments([]); return; }
    setLoadingDocuments(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, document_name, expires_at')
        .eq('ride_id', rideId)
        .eq('user_id', effectiveUserId)
        .order('document_name');
      if (error) throw error;
      setRideDocuments(data || []);
    } catch (error) {
      console.error('Error loading ride documents:', error);
      setRideDocuments([]);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const loadCalendarEvents = async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const allEvents: CalendarEvent[] = [];
      const rideIds = new Set<string>();

      const buildQuery = (baseQuery: any) => isStaff ? baseQuery : baseQuery.eq('user_id', effectiveUserId);

      const { data: checks } = await buildQuery(
        supabase.from('checks').select('id, check_date, status, ride_id')
          .gte('check_date', format(monthStart, 'yyyy-MM-dd'))
          .lte('check_date', format(monthEnd, 'yyyy-MM-dd'))
          .eq('is_test_data', false)
      );
      checks?.forEach((check: any) => {
        if (check.ride_id) rideIds.add(check.ride_id);
        allEvents.push({ id: check.id, title: 'Check', date: check.check_date, type: 'check', status: check.status as any, rideId: check.ride_id });
      });

      const { data: maintenance } = await buildQuery(
        supabase.from('maintenance_records').select('id, next_maintenance_due, maintenance_type, ride_id')
          .not('next_maintenance_due', 'is', null)
          .gte('next_maintenance_due', format(monthStart, 'yyyy-MM-dd'))
          .lte('next_maintenance_due', format(monthEnd, 'yyyy-MM-dd'))
      );
      maintenance?.forEach((record: any) => {
        if (record.next_maintenance_due) {
          if (record.ride_id) rideIds.add(record.ride_id);
          allEvents.push({ id: record.id, title: record.maintenance_type, date: record.next_maintenance_due, type: 'maintenance', status: 'pending', rideId: record.ride_id });
        }
      });

      const { data: documents } = await buildQuery(
        supabase.from('documents').select('id, document_name, expires_at, ride_id')
          .not('expires_at', 'is', null)
          .gte('expires_at', format(monthStart, 'yyyy-MM-dd'))
          .lte('expires_at', format(monthEnd, 'yyyy-MM-dd'))
      );
      documents?.forEach((doc: any) => {
        if (doc.expires_at) {
          if (doc.ride_id) rideIds.add(doc.ride_id);
          allEvents.push({ id: doc.id, title: `${doc.document_name} Expires`, date: doc.expires_at, type: 'document_expiry', status: 'pending', rideId: doc.ride_id });
        }
      });

      const { data: ndt } = await buildQuery(
        supabase.from('ndt_schedules').select('id, schedule_name, next_inspection_due, ride_id')
          .eq('is_active', true)
          .not('next_inspection_due', 'is', null)
          .gte('next_inspection_due', format(monthStart, 'yyyy-MM-dd'))
          .lte('next_inspection_due', format(monthEnd, 'yyyy-MM-dd'))
      );
      ndt?.forEach((schedule: any) => {
        if (schedule.next_inspection_due) {
          if (schedule.ride_id) rideIds.add(schedule.ride_id);
          allEvents.push({ id: schedule.id, title: schedule.schedule_name, date: schedule.next_inspection_due, type: 'ndt', status: 'pending', rideId: schedule.ride_id });
        }
      });

      const { data: inspectionSchedules, error: schedulesError } = await buildQuery(
        supabase.from('inspection_schedules').select('id, inspection_name, due_date, ride_id, advance_notice_days')
          .eq('is_active', true)
          .gte('due_date', format(monthStart, 'yyyy-MM-dd'))
          .lte('due_date', format(monthEnd, 'yyyy-MM-dd'))
      );
      if (schedulesError) console.error('Error fetching inspection schedules:', schedulesError);

      const todayForOverdue = new Date();
      todayForOverdue.setHours(0, 0, 0, 0);
      inspectionSchedules?.forEach((schedule: any) => {
        if (schedule.ride_id) rideIds.add(schedule.ride_id);
        const dueDate = new Date(schedule.due_date);
        dueDate.setHours(0, 0, 0, 0);
        allEvents.push({ id: schedule.id, title: `Scheduled: ${schedule.inspection_name}`, date: schedule.due_date, type: 'inspection', status: dueDate < todayForOverdue ? 'overdue' : 'pending', rideId: schedule.ride_id });
      });

      if (rideIds.size > 0) {
        let ridesQuery = supabase.from('rides').select('id, ride_name').in('id', Array.from(rideIds));
        if (!isStaff) ridesQuery = ridesQuery.eq('user_id', effectiveUserId) as any;
        const { data: ridesData } = await ridesQuery;
        const rideMap = new Map(ridesData?.map((r: any) => [r.id, r.ride_name]) || []);
        allEvents.forEach(event => {
          if (event.rideId) {
            event.rideName = rideMap.get(event.rideId) || 'Unknown Ride';
            event.title = `${event.rideName} - ${event.title}`;
          }
        });
      }

      allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(allEvents);
    } catch (error) {
      console.error('Error loading calendar events:', error);
      setLoadError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getEventsForDate = (date: Date) =>
    events.filter(event => isSameDay(parseISO(event.date), date) && (filterType === 'all' || event.type === filterType));

  const handleEventClick = (event: CalendarEvent) => {
    if (!event.rideId) {
      toast({ title: "Navigation Error", description: "Cannot navigate to event without ride information", variant: "destructive" });
      return;
    }
    navigate(`/rides/${event.rideId}`);
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'inspection': return 'bg-primary/10 text-primary border-primary/20';
      case 'maintenance': return 'bg-accent/50 text-accent-foreground border-accent';
      case 'document_expiry': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'ndt': return 'bg-secondary text-secondary-foreground border-secondary';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'overdue': return <AlertTriangle className="h-3 w-3 text-destructive" />;
      case 'pending': return <Clock className="h-3 w-3 text-warning" />;
      default: return null;
    }
  };

  const resetForm = () => {
    setFormData({
      selected_document_id: '',
      ride_id: '',
      inspection_type: '',
      inspection_name: '',
      due_date: undefined,
      advance_notice_days: 30,
      notes: '',
      enable_reminders: true,
      reminder_days: [7, 1],
      is_recurring: false,
      recurrence_value: 1,
      recurrence_unit: 'months',
    });
    setFormErrors({});
    setRideDocuments([]);
  };

  const openQuickAdd = (date: Date) => {
    setFormData(prev => ({ ...prev, due_date: date }));
    setAddDialogOpen(true);
  };

  const handleAddInspection = async () => {
    setFormErrors({});
    try {
      const validatedData = inspectionSchema.parse(formData);

      let scheduleType = 'inspection';
      if (formData.inspection_type.includes('expiry')) {
        scheduleType = formData.is_recurring ? 'recurring_document' : 'document';
      } else if (formData.inspection_type.includes('maintenance') || formData.inspection_type.includes('preventive') || formData.inspection_type.includes('repair')) {
        scheduleType = formData.is_recurring ? 'recurring_maintenance' : 'maintenance';
      } else if (formData.inspection_type.includes('check')) {
        scheduleType = formData.is_recurring ? 'recurring_check' : 'check';
      } else {
        scheduleType = formData.is_recurring ? 'recurring_inspection' : 'inspection';
      }

      const { error } = await supabase.from('inspection_schedules').insert([{
        user_id: user!.id,
        ride_id: validatedData.ride_id,
        inspection_type: validatedData.inspection_type,
        inspection_name: validatedData.inspection_name,
        due_date: format(validatedData.due_date, 'yyyy-MM-dd'),
        advance_notice_days: validatedData.advance_notice_days,
        notes: formData.is_recurring
          ? `${validatedData.notes || ''}\n[Recurring: every ${formData.recurrence_value} ${formData.recurrence_unit}]`.trim()
          : validatedData.notes || null,
        schedule_type: scheduleType,
      }]);

      if (error) throw error;

      const recurrenceLabel = formData.recurrence_value === 1
        ? formData.recurrence_unit.slice(0, -1)
        : `${formData.recurrence_value} ${formData.recurrence_unit}`;

      toast({
        title: "Success",
        description: formData.is_recurring
          ? `Recurring schedule created (every ${recurrenceLabel})`
          : "Schedule created successfully",
      });

      setAddDialogOpen(false);
      resetForm();
      loadCalendarEvents();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) errors[err.path[0].toString()] = err.message;
        });
        setFormErrors(errors);
      } else {
        console.error('Error saving inspection schedule:', error);
        toast({ title: "Error", description: "Failed to create schedule", variant: "destructive" });
      }
    }
  };

  const selectedDateEvents = getEventsForDate(selectedDate);

  if (!user) {
    return (
      <div className="bg-white border border-border rounded-2xl p-8 text-center">
        <p className="text-muted-foreground">Please log in to view the calendar</p>
      </div>
    );
  }

  // Status chips
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const overdueCount = events.filter(e => e.status === 'overdue' || (e.status === 'pending' && new Date(e.date) < todayStart)).length;
  const dueSoonCount = events.filter(e => {
    const d = new Date(e.date);
    return d >= todayStart && d <= addDays(todayStart, 7) && e.status !== 'overdue';
  }).length;
  const thisMonthCount = events.filter(e => {
    const d = new Date(e.date);
    return d >= startOfMonth(currentMonth) && d <= endOfMonth(currentMonth);
  }).length;

  const upcomingEvents = events.filter(event => {
    const eventDate = parseISO(event.date);
    const now = new Date();
    return eventDate >= now && eventDate <= addDays(now, 30);
  }).slice(0, 20);

  return (
    <div className="space-y-4">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground">Inspections, maintenance and expiry dates</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Event</DialogTitle>
              <DialogDescription>Schedule an event with automatic reminders</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ride_id">Ride *</Label>
                <Select value={formData.ride_id} onValueChange={(value) => { setFormData({ ...formData, ride_id: value, selected_document_id: '', inspection_name: '' }); loadRideDocuments(value); }}>
                  <SelectTrigger><SelectValue placeholder="Select a ride" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {rides.map((ride) => <SelectItem key={ride.id} value={ride.id}>{ride.ride_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.ride_id && <p className="text-xs text-destructive">{formErrors.ride_id}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="inspection_type">Event Type *</Label>
                <Select value={formData.inspection_type} onValueChange={(value) => setFormData({ ...formData, inspection_type: value })}>
                  <SelectTrigger><SelectValue placeholder="Select event type" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-[300px]">
                    {['Document Expiry', 'Inspections', 'Checks', 'Maintenance'].map(category => {
                      const categoryTypes = EVENT_TYPES.filter(t => t.category === category);
                      if (categoryTypes.length === 0) return null;
                      return (
                        <div key={category}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">{category}</div>
                          {categoryTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                        </div>
                      );
                    })}
                  </SelectContent>
                </Select>
                {formErrors.inspection_type && <p className="text-xs text-destructive">{formErrors.inspection_type}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="inspection_name">{formData.inspection_type.includes('expiry') ? 'Document *' : 'Event Name *'}</Label>
                {formData.inspection_type.includes('expiry') ? (
                  <>
                    <Select value={formData.selected_document_id} onValueChange={(value) => {
                      const doc = rideDocuments.find(d => d.id === value);
                      setFormData({ ...formData, selected_document_id: value, inspection_name: doc?.document_name || '', due_date: doc?.expires_at ? new Date(doc.expires_at) : formData.due_date });
                    }} disabled={!formData.ride_id || loadingDocuments}>
                      <SelectTrigger>
                        <SelectValue placeholder={!formData.ride_id ? "Select a ride first" : loadingDocuments ? "Loading documents..." : rideDocuments.length === 0 ? "No documents uploaded for this ride" : "Select a document"} />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {rideDocuments.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            {doc.document_name}
                            {doc.expires_at && <span className="text-muted-foreground ml-2">(expires {format(new Date(doc.expires_at), 'dd/MM/yyyy')})</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.ride_id && rideDocuments.length === 0 && !loadingDocuments && (
                      <p className="text-xs text-muted-foreground">No documents uploaded yet. <button type="button" onClick={() => navigate(`/rides/${formData.ride_id}`)} className="text-primary hover:underline">Upload documents</button> first.</p>
                    )}
                  </>
                ) : (
                  <Input id="inspection_name" value={formData.inspection_name} onChange={(e) => setFormData({ ...formData, inspection_name: e.target.value })} placeholder="e.g., Annual Safety Inspection" maxLength={200} />
                )}
                {formErrors.inspection_name && <p className="text-xs text-destructive">{formErrors.inspection_name}</p>}
              </div>

              <div className="space-y-2">
                <Label>Due Date *</Label>
                <Popover open={calendarPickerOpen} onOpenChange={setCalendarPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.due_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.due_date ? format(formData.due_date, "d MMM yyyy") : "Select due date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                    <Calendar mode="single" selected={formData.due_date} onSelect={(date) => { setFormData({ ...formData, due_date: date }); setCalendarPickerOpen(false); }} initialFocus disabled={(date) => date < new Date()} />
                  </PopoverContent>
                </Popover>
                {formErrors.due_date && <p className="text-xs text-destructive">{formErrors.due_date}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="advance_notice_days">Advance Notice (Days)</Label>
                <Input id="advance_notice_days" type="number" min="1" max="365" value={formData.advance_notice_days} onChange={(e) => setFormData({ ...formData, advance_notice_days: parseInt(e.target.value) || 30 })} />
                <p className="text-xs text-muted-foreground">Reminders start this many days before the due date</p>
                {formErrors.advance_notice_days && <p className="text-xs text-destructive">{formErrors.advance_notice_days}</p>}
              </div>

              <div className="space-y-3 p-4 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enable_reminders" className="font-medium">Email Reminders</Label>
                  <input type="checkbox" id="enable_reminders" checked={formData.enable_reminders} onChange={(e) => setFormData({ ...formData, enable_reminders: e.target.checked })} className="h-4 w-4 rounded border-border" />
                </div>
                {formData.enable_reminders && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">You'll receive reminder emails at the following intervals:</p>
                    <div className="flex flex-wrap gap-2">
                      {[30, 14, 7, 3, 1].map((days) => (
                        <button key={days} type="button" onClick={() => {
                          const current = formData.reminder_days;
                          const updated = current.includes(days) ? current.filter(d => d !== days) : [...current, days].sort((a, b) => b - a);
                          setFormData({ ...formData, reminder_days: updated });
                        }} className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-colors", formData.reminder_days.includes(days) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                          {days === 1 ? '1 day before' : `${days} days before`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4 rounded-lg bg-accent/10 border border-accent/20">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="is_recurring" className="font-medium">Recurring Event</Label>
                    <p className="text-xs text-muted-foreground">Automatically schedule future occurrences</p>
                  </div>
                  <input type="checkbox" id="is_recurring" checked={formData.is_recurring} onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })} className="h-4 w-4 rounded border-border" />
                </div>
                {formData.is_recurring && (
                  <div className="space-y-3 pt-3 border-t border-accent/20">
                    <Label className="text-sm">Repeat Every</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" min="1" max="365" value={formData.recurrence_value} onChange={(e) => setFormData({ ...formData, recurrence_value: Math.max(1, parseInt(e.target.value) || 1) })} className="w-20" />
                      <Select value={formData.recurrence_unit} onValueChange={(value) => setFormData({ ...formData, recurrence_unit: value as typeof formData.recurrence_unit })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="days">Day(s)</SelectItem>
                          <SelectItem value="weeks">Week(s)</SelectItem>
                          <SelectItem value="months">Month(s)</SelectItem>
                          <SelectItem value="years">Year(s)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">After completing this event, the next occurrence will be automatically scheduled</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes or requirements" rows={3} maxLength={1000} />
                {formErrors.notes && <p className="text-xs text-destructive">{formErrors.notes}</p>}
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddInspection}>Create Schedule</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Status chips ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
          <div className="text-xs text-destructive font-medium">Overdue</div>
          <div className="text-lg font-bold text-destructive">{overdueCount}</div>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
          <div className="text-xs text-warning font-medium">Due soon</div>
          <div className="text-lg font-bold text-warning">{dueSoonCount}</div>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="text-xs text-muted-foreground font-medium">This month</div>
          <div className="text-lg font-bold text-foreground">{thisMonthCount}</div>
        </div>
      </div>

      {/* ── Calendar + Day Events ── */}
      <div className="grid gap-4 lg:gap-5 lg:grid-cols-3">

        {/* Calendar card */}
        <div className="lg:col-span-2 bg-white border border-border rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <p className="font-semibold text-base text-foreground">{format(currentMonth, 'MMMM yyyy')}</p>
            <div className="flex items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
                  <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Filter events" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="inspection">Inspections</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="ndt">NDT Tests</SelectItem>
                  <SelectItem value="document_expiry">Doc Expiry</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-9 w-9"
                onClick={() => { const m = addDays(currentMonth, -30); setCurrentMonth(m); setSelectedDate(startOfMonth(m)); }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9"
                onClick={() => { const m = addDays(currentMonth, 30); setCurrentMonth(m); setSelectedDate(startOfMonth(m)); }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => { if (date) setSelectedDate(date); }}
            onDayClick={(date) => { if (getEventsForDate(date).length === 0) openQuickAdd(date); }}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            className="rounded-xl border border-border bg-white w-full [&_.rdp]:w-full [&_.rdp-months]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full [&_.rdp-day]:cursor-pointer [&_.rdp-day]:h-10 [&_.rdp-day]:sm:h-12 [&_.rdp-cell]:p-0.5 [&_.rdp-day:hover]:bg-primary/10 [&_.rdp-head_cell]:text-xs [&_.rdp-head_cell]:font-medium [&_.rdp-head_cell]:text-muted-foreground [&_.rdp-day_selected]:!bg-primary [&_.rdp-day_selected]:!text-primary-foreground [&_.rdp-day_selected]:!rounded-lg"
            components={{
              DayContent: ({ date }) => {
                const dayEvents = getEventsForDate(date);
                return (
                  <div className="relative w-full h-full flex flex-col items-center justify-center py-1">
                    <span className="text-sm sm:text-base">{date.getDate()}</span>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 absolute bottom-1">
                        {dayEvents.some(e => e.type === 'inspection') && <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary" />}
                        {dayEvents.some(e => e.type === 'maintenance') && <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#3B82F6]" />}
                        {dayEvents.some(e => e.type === 'document_expiry') && <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-destructive" />}
                        {dayEvents.some(e => e.type === 'ndt') && <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#8B5CF6]" />}
                      </div>
                    )}
                  </div>
                );
              }
            }}
            modifiers={{
              hasEvents: (date) => getEventsForDate(date).length > 0,
              overdue: (date) => getEventsForDate(date).some(e => e.status === 'overdue' || (e.status === 'pending' && new Date(e.date) < new Date())),
            }}
            modifiersClassNames={{
              hasEvents: "font-bold",
              overdue: "bg-destructive/10 text-destructive",
            }}
          />

          {/* Collapsible legend */}
          <details className="mt-3 rounded-xl bg-muted/30 border border-border">
            <summary className="px-3 py-2.5 text-xs font-medium text-muted-foreground cursor-pointer select-none list-none">
              Legend
            </summary>
            <div className="px-3 pb-3 grid grid-cols-2 gap-2 text-xs text-foreground border-t border-border pt-2.5">
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary shrink-0" /> Inspections</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#3B82F6] shrink-0" /> Maintenance</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-destructive shrink-0" /> Doc Expiry</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#8B5CF6] shrink-0" /> NDT</div>
              <div className="flex items-center gap-2"><Clock className="h-3 w-3 text-warning shrink-0" /> Pending</div>
              <div className="flex items-center gap-2"><AlertTriangle className="h-3 w-3 text-destructive shrink-0" /> Overdue</div>
            </div>
          </details>
        </div>

        {/* Selected day events */}
        <div className="bg-white border border-border rounded-2xl shadow-sm flex flex-col">
          <div className="px-4 pt-4 pb-3 border-b border-border flex items-start justify-between">
            <div>
              <p className="font-semibold text-foreground text-sm">{format(selectedDate, 'EEE d MMM yyyy')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedDateEvents.length === 0
                  ? '0 events'
                  : `${selectedDateEvents.length} event${selectedDateEvents.length > 1 ? 's' : ''}`}
              </p>
            </div>
            <Button size="sm" onClick={() => openQuickAdd(selectedDate)}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {selectedDateEvents.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/30 p-5 text-center">
                <p className="text-sm font-medium text-foreground">No events for this date</p>
                <p className="text-xs text-muted-foreground mt-1">Add an inspection, maintenance or expiry reminder.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDateEvents.map((event) => (
                  <button key={event.id} onClick={() => handleEventClick(event)}
                    className="w-full p-3 rounded-xl border border-border bg-white hover:border-primary/30 hover:bg-muted/30 transition-colors text-left">
                    <div className="flex items-start gap-2.5">
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-1.5 shrink-0",
                        event.type === 'inspection' && "bg-primary",
                        event.type === 'maintenance' && "bg-[#3B82F6]",
                        event.type === 'document_expiry' && "bg-destructive",
                        event.type === 'ndt' && "bg-[#8B5CF6]",
                        event.type === 'check' && "bg-muted-foreground",
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          {getStatusIcon(event.status)}
                          <p className="font-semibold text-sm text-foreground truncate">{event.title.split(' - ').pop()}</p>
                        </div>
                        {event.rideName && <p className="text-xs text-muted-foreground truncate">{event.rideName}</p>}
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 shrink-0", getEventTypeColor(event.type))}>
                        {event.type === 'document_expiry' ? 'Expiry' : event.type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Upcoming Events (30 days) ── */}
      <div className="bg-white border border-border rounded-2xl p-4 md:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-foreground text-sm">Upcoming</p>
          <span className="text-xs text-muted-foreground">Next 30 days</span>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />)}
          </div>
        ) : upcomingEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nothing scheduled in the next 30 days.</p>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((event) => (
              <div key={event.id} onClick={() => handleEventClick(event)}
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-white hover:border-primary/30 hover:bg-muted/30 transition-colors cursor-pointer">
                <div className="flex items-center gap-3 min-w-0">
                  {getStatusIcon(event.status)}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(event.date), 'EEE d MMM')}</p>
                  </div>
                </div>
                <Badge variant="outline" className={cn("ml-3 shrink-0", getEventTypeColor(event.type))}>
                  {event.type.replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Help Guide (collapsed by default) ── */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          onClick={() => setShowHelpTips(v => !v)}
        >
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-muted-foreground">Show calendar guide</span>
          </div>
          <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", showHelpTips && "rotate-90")} />
        </button>
        {showHelpTips && (
          <div className="px-4 pb-4 border-t border-border">
            <ul className="text-sm text-muted-foreground space-y-2 mt-3">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span><strong className="text-foreground">Click any date</strong> to quickly add a new event</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span><strong className="text-foreground">Coloured dots</strong> below a date show event types (see legend)</span>
              </li>
              <li className="flex items-start gap-2">
                <Repeat className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <span><strong className="text-foreground">Recurring events</strong> automatically reschedule after completion</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span><strong className="text-foreground">Click an event</strong> to navigate to that item's details</span>
              </li>
            </ul>
          </div>
        )}
      </div>

    </div>
  );
};

export default CalendarView;
