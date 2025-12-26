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
  AlertTriangle
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
  const [rides, setRides] = useState<Ride[]>([]);
  const [formData, setFormData] = useState({
    ride_id: '',
    inspection_type: '',
    inspection_name: '',
    due_date: undefined as Date | undefined,
    advance_notice_days: 30,
    notes: '',
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
      ride_id: '',
      inspection_type: '',
      inspection_name: '',
      due_date: undefined,
      advance_notice_days: 30,
      notes: '',
    });
    setFormErrors({});
  };

  const handleAddInspection = async () => {
    setFormErrors({});

    // Validate form data
    try {
      const validatedData = inspectionSchema.parse(formData);

      const scheduleData = {
        user_id: user!.id,
        ride_id: validatedData.ride_id,
        inspection_type: validatedData.inspection_type,
        inspection_name: validatedData.inspection_name,
        due_date: format(validatedData.due_date, 'yyyy-MM-dd'),
        advance_notice_days: validatedData.advance_notice_days,
        notes: validatedData.notes || null,
        schedule_type: 'inspection',
      };

      const { error } = await supabase
        .from('inspection_schedules')
        .insert([scheduleData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Inspection schedule created successfully",
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
          description: "Failed to create inspection schedule",
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
      {/* Show helpful message when no events exist */}
      {!loading && events.length === 0 && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <CalendarIcon className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-semibold">Your calendar is empty</h3>
                <p className="text-sm text-muted-foreground">
                  {loadError 
                    ? 'No events yet (and we hit an error fetching some data). The calendar itself works — add checks/expiries to see them here.'
                    : 'No events yet. Add inspections, maintenance, or document expiry dates to see them here.'}
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
              Track inspections, maintenance, and document expiry dates
            </p>
          </div>
          
          <Dialog open={addDialogOpen} onOpenChange={(open) => {
            setAddDialogOpen(open);
            if (!open) resetForm();
          }}>
              <DialogTrigger asChild>
                <Button className="shrink-0">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Inspection
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Inspection Schedule</DialogTitle>
                  <DialogDescription>
                    Schedule an inspection with automatic reminders
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ride_id">Ride *</Label>
                    <Select
                      value={formData.ride_id}
                      onValueChange={(value) => setFormData({ ...formData, ride_id: value })}
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
                    <Label htmlFor="inspection_type">Inspection Type *</Label>
                    <Select
                      value={formData.inspection_type}
                      onValueChange={(value) => setFormData({ ...formData, inspection_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select inspection type" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {INSPECTION_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.inspection_type && <p className="text-xs text-destructive">{formErrors.inspection_type}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inspection_name">Inspection Name *</Label>
                    <Input
                      id="inspection_name"
                      value={formData.inspection_name}
                      onChange={(e) => setFormData({ ...formData, inspection_name: e.target.value })}
                      placeholder="e.g., Annual Safety Inspection"
                      maxLength={200}
                    />
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
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const newMonth = addDays(currentMonth, -30);
                  setCurrentMonth(newMonth);
                  setSelectedDate(startOfMonth(newMonth));
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center min-w-[200px]">
                <p className="text-lg font-semibold">
                  {format(currentMonth, 'MMMM yyyy')}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
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
        <Card className="lg:col-span-2">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="font-semibold text-lg">Your Events</h3>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="text-sm border rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
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
              onSelect={(date) => date && setSelectedDate(date)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              className="rounded-md border"
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
                          {hasInspection && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                          {hasMaintenance && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                          {hasDocExpiry && <div className="w-1.5 h-1.5 rounded-full bg-destructive" />}
                          {hasNDT && <div className="w-1.5 h-1.5 rounded-full bg-secondary" />}
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {format(selectedDate, 'MMMM d, yyyy')}
            </CardTitle>
            <CardDescription>
              {selectedDateEvents.length} event(s) scheduled
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDateEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No events scheduled</p>
                <p className="text-sm">Select a different date or add new events</p>
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