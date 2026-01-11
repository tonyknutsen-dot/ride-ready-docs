import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Lock,
  Repeat
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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

// Event types with plan requirements
// Basic plan: Document expiry alerts only (as per pricing - "Expiry alerts 30 & 7 days")
// Advanced plan: Full inspection scheduling, maintenance, NDT, checks
const EVENT_TYPES = [
  // Basic plan - document expiry reminders
  { value: 'insurance-expiry', label: 'Insurance Expiry', plan: 'basic', category: 'Document Expiry' },
  { value: 'doc-expiry', label: 'DOC/ADIPS Expiry', plan: 'basic', category: 'Document Expiry' },
  { value: 'safety-cert-expiry', label: 'Safety Certificate Expiry', plan: 'basic', category: 'Document Expiry' },
  { value: 'other-document-expiry', label: 'Other Document Expiry', plan: 'basic', category: 'Document Expiry' },
  
  // Advanced plan - inspections
  { value: 'in-service', label: 'In-Service Inspection', plan: 'advanced', category: 'Inspections' },
  { value: 'electrical', label: 'Electrical Inspection', plan: 'advanced', category: 'Inspections' },
  { value: 'ndt', label: 'NDT Inspection', plan: 'advanced', category: 'Inspections' },
  { value: 'structural', label: 'Structural Inspection', plan: 'advanced', category: 'Inspections' },
  { value: 'hydraulic', label: 'Hydraulic Inspection', plan: 'advanced', category: 'Inspections' },
  { value: 'mechanical', label: 'Mechanical Inspection', plan: 'advanced', category: 'Inspections' },
  { value: 'safety', label: 'Safety Inspection', plan: 'advanced', category: 'Inspections' },
  
  // Advanced plan - checks
  { value: 'daily-check', label: 'Daily Check', plan: 'advanced', category: 'Checks' },
  { value: 'monthly-check', label: 'Monthly Check', plan: 'advanced', category: 'Checks' },
  { value: 'yearly-check', label: 'Yearly Check', plan: 'advanced', category: 'Checks' },
  
  // Advanced plan - maintenance
  { value: 'maintenance', label: 'Scheduled Maintenance', plan: 'advanced', category: 'Maintenance' },
  { value: 'preventive', label: 'Preventive Maintenance', plan: 'advanced', category: 'Maintenance' },
  { value: 'repair', label: 'Repair Follow-up', plan: 'advanced', category: 'Maintenance' },
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
  const [showHelpTips, setShowHelpTips] = useState(true);
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

  const isBasicPlan = subscription?.subscriptionStatus === 'trial' || subscription?.subscriptionStatus === 'basic';

  useEffect(() => {
    if (user && subscription) {
      loadCalendarEvents();
      loadRides();
    } else {
      setLoading(false);
    }
  }, [user, currentMonth, subscription?.subscriptionStatus]);

  const loadRides = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('user_id', user.id)
        .order('ride_name');

      if (error) throw error;
      setRides(data || []);
    } catch (error) {
      console.error('Error loading rides:', error);
    }
  };

  const loadRideDocuments = async (rideId: string) => {
    if (!user?.id || !rideId) {
      setRideDocuments([]);
      return;
    }
    
    setLoadingDocuments(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, document_name, expires_at')
        .eq('user_id', user.id)
        .eq('ride_id', rideId)
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
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    
    setLoading(true);
    setLoadError(null);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      const allEvents: CalendarEvent[] = [];
      const rideIds = new Set<string>();

      // Load inspection checks
      const { data: checks } = await supabase
        .from('checks')
        .select('id, check_date, status, ride_id')
        .eq('user_id', user?.id)
        .gte('check_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('check_date', format(monthEnd, 'yyyy-MM-dd'));

      checks?.forEach(check => {
        if (check.ride_id) rideIds.add(check.ride_id);
        allEvents.push({
          id: check.id,
          title: `Check`,
          date: check.check_date,
          type: 'check',
          status: check.status as 'pending' | 'completed' | 'overdue',
          rideId: check.ride_id,
        });
      });

      // Load maintenance records (upcoming)
      const { data: maintenance } = await supabase
        .from('maintenance_records')
        .select('id, next_maintenance_due, maintenance_type, ride_id')
        .eq('user_id', user?.id)
        .not('next_maintenance_due', 'is', null)
        .gte('next_maintenance_due', format(monthStart, 'yyyy-MM-dd'))
        .lte('next_maintenance_due', format(monthEnd, 'yyyy-MM-dd'));

      maintenance?.forEach(record => {
        if (record.next_maintenance_due) {
          if (record.ride_id) rideIds.add(record.ride_id);
          allEvents.push({
            id: record.id,
            title: record.maintenance_type,
            date: record.next_maintenance_due,
            type: 'maintenance',
            status: 'pending',
            rideId: record.ride_id,
          });
        }
      });

      // Load document expiry dates
      const { data: documents } = await supabase
        .from('documents')
        .select('id, document_name, expires_at, ride_id')
        .eq('user_id', user?.id)
        .not('expires_at', 'is', null)
        .gte('expires_at', format(monthStart, 'yyyy-MM-dd'))
        .lte('expires_at', format(monthEnd, 'yyyy-MM-dd'));

      documents?.forEach(doc => {
        if (doc.expires_at) {
          if (doc.ride_id) rideIds.add(doc.ride_id);
          allEvents.push({
            id: doc.id,
            title: `${doc.document_name} Expires`,
            date: doc.expires_at,
            type: 'document_expiry',
            status: 'pending',
            rideId: doc.ride_id,
          });
        }
      });

      // Load NDT schedules
      const { data: ndt } = await supabase
        .from('ndt_schedules')
        .select('id, schedule_name, next_inspection_due, ride_id')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .not('next_inspection_due', 'is', null)
        .gte('next_inspection_due', format(monthStart, 'yyyy-MM-dd'))
        .lte('next_inspection_due', format(monthEnd, 'yyyy-MM-dd'));

      ndt?.forEach(schedule => {
        if (schedule.next_inspection_due) {
          if (schedule.ride_id) rideIds.add(schedule.ride_id);
          allEvents.push({
            id: schedule.id,
            title: schedule.schedule_name,
            date: schedule.next_inspection_due,
            type: 'ndt',
            status: 'pending',
            rideId: schedule.ride_id,
          });
        }
      });

      // Load inspection schedules
      const { data: inspectionSchedules, error: schedulesError } = await supabase
        .from('inspection_schedules')
        .select('id, inspection_name, due_date, ride_id, advance_notice_days')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .gte('due_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('due_date', format(monthEnd, 'yyyy-MM-dd'));

      if (schedulesError) {
        console.error('Error fetching inspection schedules:', schedulesError);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      inspectionSchedules?.forEach(schedule => {
        if (schedule.ride_id) rideIds.add(schedule.ride_id);
        const dueDate = new Date(schedule.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const isOverdue = dueDate < today;
        
        allEvents.push({
          id: schedule.id,
          title: `Scheduled: ${schedule.inspection_name}`,
          date: schedule.due_date,
          type: 'inspection',
          status: isOverdue ? 'overdue' : 'pending',
          rideId: schedule.ride_id,
        });
      });

      // Fetch all rides in one query
      if (rideIds.size > 0) {
        const { data: rides } = await supabase
          .from('rides')
          .select('id, ride_name')
          .in('id', Array.from(rideIds));

        const rideMap = new Map(rides?.map(r => [r.id, r.ride_name]) || []);
        
        allEvents.forEach(event => {
          if (event.rideId) {
            event.rideName = rideMap.get(event.rideId) || 'Unknown Ride';
            event.title = `${event.rideName} - ${event.title}`;
          }
        });
      }

      // Sort events by date
      allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setEvents(allEvents);
    } catch (error) {
      console.error('Error loading calendar events:', error);
      setLoadError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = parseISO(event.date);
      const matches = isSameDay(eventDate, date);
      return matches && (filterType === 'all' || event.type === filterType);
    });
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (!event.rideId) {
      toast({
        title: "Navigation Error",
        description: "Cannot navigate to event without ride information",
        variant: "destructive",
      });
      return;
    }
    
    // Navigate to the ride workspace with the appropriate tab
    const tabMap = {
      'inspection': 'inspections',
      'maintenance': 'maintenance',
      'document_expiry': 'documents',
      'ndt': 'ndt'
    };
    
    const tab = tabMap[event.type] || 'inspections';
    navigate(`/dashboard?ride=${event.rideId}&tab=${tab}`);
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
      case 'pending': return <Clock className="h-3 w-3 text-amber-600" />;
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

    // Validate form data
    try {
      const validatedData = inspectionSchema.parse(formData);

      // Determine schedule type based on event type and recurrence
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

      const scheduleData = {
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
      };

      const { error } = await supabase
        .from('inspection_schedules')
        .insert([scheduleData]);

      if (error) throw error;

      const recurrenceLabel = formData.recurrence_value === 1 
        ? formData.recurrence_unit.slice(0, -1) // Remove 's' for singular
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
          if (err.path[0]) {
            errors[err.path[0].toString()] = err.message;
          }
        });
        setFormErrors(errors);
      } else {
        console.error('Error saving inspection schedule:', error);
        toast({
          title: "Error",
          description: "Failed to create schedule",
          variant: "destructive",
        });
      }
    }
  };

  const selectedDateEvents = getEventsForDate(selectedDate);

  if (!user) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Please log in to view calendar</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* How to Use Tips - Collapsible */}
      {showHelpTips && (
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-card to-accent/5">
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">How to use the Calendar</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span><strong>Click any date</strong> to quickly add a new event</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                      <span><strong>Colored dots</strong> show events on each day (see legend below)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Repeat className="h-3 w-3 text-accent" />
                      <span><strong>Recurring events</strong> automatically reschedule after completion</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-info" />
                      <span><strong>Click an event</strong> to go to that item's details</span>
                    </li>
                  </ul>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="shrink-0 text-xs"
                onClick={() => setShowHelpTips(false)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Color Legend */}
      <Card className="border border-border/50">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium text-muted-foreground">Legend:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive shadow-sm" />
              <span>Document Expiry</span>
            </div>
            <div className={cn("flex items-center gap-1.5", isBasicPlan && "opacity-50")}>
              <div className="w-3 h-3 rounded-full bg-primary shadow-sm" />
              <span>Inspections</span>
              {isBasicPlan && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">Upgrade</span>
              )}
            </div>
            <div className={cn("flex items-center gap-1.5", isBasicPlan && "opacity-50")}>
              <div className="w-3 h-3 rounded-full bg-accent shadow-sm" />
              <span>Maintenance</span>
              {isBasicPlan && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">Upgrade</span>
              )}
            </div>
            <div className={cn("flex items-center gap-1.5", isBasicPlan && "opacity-50")}>
              <div className="w-3 h-3 rounded-full bg-info shadow-sm" />
              <span>NDT Tests</span>
              {isBasicPlan && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">Upgrade</span>
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <span>Overdue</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Show helpful message when no events exist */}
      {!loading && events.length === 0 && (
        <Card className="border-2 border-info/30 bg-gradient-to-br from-info/10 to-primary/5 shadow-elegant">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-info/20 flex items-center justify-center shrink-0">
                <CalendarIcon className="h-5 w-5 text-info" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">Your calendar is empty</h3>
                <p className="text-sm text-muted-foreground">
                  {loadError 
                    ? 'No events yet (and we hit an error fetching some data). The calendar itself works — add events to see them here.'
                    : 'Click on any date below to add your first event, or use the "Add Event" button.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
            <p className="text-sm text-muted-foreground">
              {isBasicPlan 
                ? 'Track document expiry dates and reminders' 
                : 'Track inspections, maintenance, and document expiry dates'}
            </p>
          </div>
          
          <Dialog open={addDialogOpen} onOpenChange={(open) => {
            setAddDialogOpen(open);
            if (!open) resetForm();
          }}>
              <DialogTrigger asChild>
                <Button className="shrink-0">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Event
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Event</DialogTitle>
                  <DialogDescription>
                    Schedule an event with automatic reminders
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ride_id">Ride *</Label>
                    <Select
                      value={formData.ride_id}
                      onValueChange={(value) => {
                        setFormData({ ...formData, ride_id: value, selected_document_id: '', inspection_name: '' });
                        loadRideDocuments(value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a ride" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {rides.map((ride) => (
                          <SelectItem key={ride.id} value={ride.id}>
                            {ride.ride_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.ride_id && <p className="text-xs text-destructive">{formErrors.ride_id}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inspection_type">Event Type *</Label>
                    <Select
                      value={formData.inspection_type}
                      onValueChange={(value) => {
                        const eventType = EVENT_TYPES.find(t => t.value === value);
                        if (eventType && (eventType.plan === 'basic' || !isBasicPlan)) {
                          setFormData({ ...formData, inspection_type: value });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50 max-h-[300px]">
                        {/* Group by category */}
                        {['Document Expiry', 'Inspections', 'Checks', 'Maintenance'].map(category => {
                          const categoryTypes = EVENT_TYPES.filter(t => t.category === category);
                          if (categoryTypes.length === 0) return null;
                          
                          return (
                            <div key={category}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                                {category}
                              </div>
                              {categoryTypes.map((type) => {
                                const isLocked = type.plan === 'advanced' && isBasicPlan;
                                return (
                                  <SelectItem 
                                    key={type.value} 
                                    value={type.value}
                                    disabled={isLocked}
                                    className={cn(
                                      isLocked && "opacity-50 cursor-not-allowed"
                                    )}
                                  >
                                    <div className="flex items-center justify-between w-full gap-2">
                                      <span>{type.label}</span>
                                      {isLocked && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                          Upgrade
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </div>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {isBasicPlan && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p className="flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Some event types require the Operations & Maintenance plan
                        </p>
                        <button
                          type="button"
                          onClick={() => navigate('/plan-billing')}
                          className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                        >
                          Upgrade your plan →
                        </button>
                      </div>
                    )}
                    {formErrors.inspection_type && <p className="text-xs text-destructive">{formErrors.inspection_type}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inspection_name">
                      {formData.inspection_type.includes('expiry') ? 'Document *' : 'Event Name *'}
                    </Label>
                    {formData.inspection_type.includes('expiry') ? (
                      <>
                        <Select
                          value={formData.selected_document_id}
                          onValueChange={(value) => {
                            const doc = rideDocuments.find(d => d.id === value);
                            setFormData({ 
                              ...formData, 
                              selected_document_id: value,
                              inspection_name: doc?.document_name || '',
                              due_date: doc?.expires_at ? new Date(doc.expires_at) : formData.due_date
                            });
                          }}
                          disabled={!formData.ride_id || loadingDocuments}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={
                              !formData.ride_id 
                                ? "Select a ride first" 
                                : loadingDocuments 
                                  ? "Loading documents..." 
                                  : rideDocuments.length === 0 
                                    ? "No documents uploaded for this ride" 
                                    : "Select a document"
                            } />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {rideDocuments.map((doc) => (
                              <SelectItem key={doc.id} value={doc.id}>
                                {doc.document_name}
                                {doc.expires_at && (
                                  <span className="text-muted-foreground ml-2">
                                    (expires {format(new Date(doc.expires_at), 'dd/MM/yyyy')})
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {formData.ride_id && rideDocuments.length === 0 && !loadingDocuments && (
                          <p className="text-xs text-muted-foreground">
                            No documents uploaded yet. <button type="button" onClick={() => navigate(`/dashboard?ride=${formData.ride_id}&tab=documents`)} className="text-primary hover:underline">Upload documents</button> first.
                          </p>
                        )}
                      </>
                    ) : (
                      <Input
                        id="inspection_name"
                        value={formData.inspection_name}
                        onChange={(e) => setFormData({ ...formData, inspection_name: e.target.value })}
                        placeholder="e.g., Annual Safety Inspection"
                        maxLength={200}
                      />
                    )}
                    {formErrors.inspection_name && <p className="text-xs text-destructive">{formErrors.inspection_name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Due Date *</Label>
                    <Popover open={calendarPickerOpen} onOpenChange={setCalendarPickerOpen}>
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
                      <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.due_date}
                          onSelect={(date) => {
                            setFormData({ ...formData, due_date: date });
                            setCalendarPickerOpen(false);
                          }}
                          initialFocus
                          disabled={(date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                    {formErrors.due_date && <p className="text-xs text-destructive">{formErrors.due_date}</p>}
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
                      Reminders start this many days before the due date
                    </p>
                    {formErrors.advance_notice_days && <p className="text-xs text-destructive">{formErrors.advance_notice_days}</p>}
                  </div>

                  {/* Reminder Settings */}
                  <div className="space-y-3 p-4 rounded-lg bg-secondary/50 border border-border">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="enable_reminders" className="font-medium">Email Reminders</Label>
                      <input
                        type="checkbox"
                        id="enable_reminders"
                        checked={formData.enable_reminders}
                        onChange={(e) => setFormData({ ...formData, enable_reminders: e.target.checked })}
                        className="h-4 w-4 rounded border-border"
                      />
                    </div>
                    {formData.enable_reminders && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          You'll receive reminder emails at the following intervals:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {[30, 14, 7, 3, 1].map((days) => (
                            <button
                              key={days}
                              type="button"
                              onClick={() => {
                                const current = formData.reminder_days;
                                const updated = current.includes(days)
                                  ? current.filter(d => d !== days)
                                  : [...current, days].sort((a, b) => b - a);
                                setFormData({ ...formData, reminder_days: updated });
                              }}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                                formData.reminder_days.includes(days)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              )}
                            >
                              {days === 1 ? '1 day before' : `${days} days before`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recurring Event Settings */}
                  <div className="space-y-3 p-4 rounded-lg bg-accent/10 border border-accent/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="is_recurring" className="font-medium">Recurring Event</Label>
                        <p className="text-xs text-muted-foreground">Automatically schedule future occurrences</p>
                      </div>
                      <input
                        type="checkbox"
                        id="is_recurring"
                        checked={formData.is_recurring}
                        onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                        className="h-4 w-4 rounded border-border"
                      />
                    </div>
                    {formData.is_recurring && (
                      <div className="space-y-3 pt-3 border-t border-accent/20">
                        <Label className="text-sm">Repeat Every</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            value={formData.recurrence_value}
                            onChange={(e) => setFormData({ ...formData, recurrence_value: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-20"
                          />
                          <Select
                            value={formData.recurrence_unit}
                            onValueChange={(value) => setFormData({ ...formData, recurrence_unit: value as typeof formData.recurrence_unit })}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              <SelectItem value="days">Day(s)</SelectItem>
                              <SelectItem value="weeks">Week(s)</SelectItem>
                              <SelectItem value="months">Month(s)</SelectItem>
                              <SelectItem value="years">Year(s)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          After completing this event, the next occurrence will be automatically scheduled
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Additional notes or requirements"
                      rows={3}
                      maxLength={1000}
                    />
                    {formErrors.notes && <p className="text-xs text-destructive">{formErrors.notes}</p>}
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddInspection}>
                      Create Schedule
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
        </div>

        {/* Month Navigation */}
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="border-2 hover:border-primary hover:bg-primary/10"
                onClick={() => {
                  const newMonth = addDays(currentMonth, -30);
                  setCurrentMonth(newMonth);
                  setSelectedDate(startOfMonth(newMonth));
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center min-w-[200px]">
                <p className="text-lg font-bold text-primary">
                  {format(currentMonth, 'MMMM yyyy')}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="border-2 hover:border-primary hover:bg-primary/10"
                onClick={() => {
                  const newMonth = addDays(currentMonth, 30);
                  setCurrentMonth(newMonth);
                  setSelectedDate(startOfMonth(newMonth));
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="lg:col-span-2 border-2 border-primary/20 shadow-elegant">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                Your Events
              </h3>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 border border-border">
                <Filter className="h-4 w-4 text-primary" />
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="text-sm border-0 bg-transparent focus:outline-none focus:ring-0 font-medium"
                >
                  <option value="all">All Events</option>
                  {!isBasicPlan && (
                    <>
                      <option value="inspection">Inspections</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="ndt">NDT Tests</option>
                    </>
                  )}
                  <option value="document_expiry">Document Expiry</option>
                </select>
              </div>
            </div>
            
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date);
                }
              }}
              onDayClick={(date) => {
                // Double-click or click on empty date opens quick-add
                const dayEvents = getEventsForDate(date);
                if (dayEvents.length === 0) {
                  openQuickAdd(date);
                }
              }}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              className="rounded-lg border-2 border-border bg-card [&_.rdp-day]:cursor-pointer [&_.rdp-day:hover]:bg-primary/10"
              components={{
                DayContent: ({ date }) => {
                  const dayEvents = getEventsForDate(date);
                  const hasInspection = dayEvents.some(e => e.type === 'inspection');
                  const hasMaintenance = dayEvents.some(e => e.type === 'maintenance');
                  const hasDocExpiry = dayEvents.some(e => e.type === 'document_expiry');
                  const hasNDT = dayEvents.some(e => e.type === 'ndt');
                  
                  return (
                    <div className="relative w-full h-full flex flex-col items-center justify-center">
                      <span>{date.getDate()}</span>
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {hasInspection && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-sm" />}
                          {hasMaintenance && <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-sm" />}
                          {hasDocExpiry && <div className="w-1.5 h-1.5 rounded-full bg-destructive shadow-sm" />}
                          {hasNDT && <div className="w-1.5 h-1.5 rounded-full bg-info shadow-sm" />}
                        </div>
                      )}
                    </div>
                  );
                }
              }}
              modifiers={{
                hasEvents: (date) => getEventsForDate(date).length > 0,
                overdue: (date) => getEventsForDate(date).some(e => 
                  e.status === 'overdue' || (e.status === 'pending' && new Date(e.date) < new Date())
                ),
              }}
              modifiersClassNames={{
                hasEvents: "font-bold",
                overdue: "bg-destructive/10 text-destructive",
              }}
            />
          </CardContent>
        </Card>

        {/* Events for Selected Date */}
        <Card className="border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-transparent shadow-elegant">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                <CalendarIcon className="h-4 w-4 text-accent-foreground" />
              </div>
              {format(selectedDate, 'MMMM d, yyyy')}
            </CardTitle>
            <CardDescription>
              {selectedDateEvents.length} event(s) scheduled
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDateEvents.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <div className="w-14 h-14 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon className="h-7 w-7 opacity-50" />
                </div>
                <p className="font-medium mb-1">No events scheduled</p>
                <p className="text-sm mb-4">Add an inspection for this date</p>
                <Button 
                  size="sm" 
                  onClick={() => openQuickAdd(selectedDate)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Event
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateEvents.map((event) => (
                  <div 
                    key={event.id} 
                    onClick={() => handleEventClick(event)}
                    className="p-2 md:p-3 rounded-lg border bg-card-hover hover:bg-accent/50 transition-smooth cursor-pointer"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {getStatusIcon(event.status)}
                          <p className="font-medium text-xs md:text-sm break-words">
                            {event.title}
                          </p>
                        </div>
                        {event.rideName && (
                          <p className="text-xs text-muted-foreground break-words">
                            {event.rideName}
                          </p>
                        )}
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs shrink-0 self-start", getEventTypeColor(event.type))}
                      >
                        {event.type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
          <CardDescription>
            Next 7 days overview
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {events
                .filter(event => {
                  const eventDate = parseISO(event.date);
                  const today = new Date();
                  const nextWeek = addDays(today, 7);
                  return eventDate >= today && eventDate <= nextWeek;
                })
                .slice(0, 5)
                .map((event) => (
                  <div 
                    key={event.id}
                    onClick={() => handleEventClick(event)}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card-hover hover:bg-accent/50 transition-smooth cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(event.status)}
                      <div>
                        <p className="font-medium text-sm">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(event.date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={getEventTypeColor(event.type)}
                    >
                      {event.type.replace('_', ' ')}
                    </Badge>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CalendarView;