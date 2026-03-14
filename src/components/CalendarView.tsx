import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
  Repeat,
  ExternalLink,
  Trash2,
  ChevronRight as ChevronRightIcon,
  Pencil,
  Bell,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useSubscription } from '@/hooks/useSubscription';
import { useBillingWriteGuard } from '@/hooks/useBillingWriteGuard';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isSameDay, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { z } from 'zod';
import { Tables } from '@/integrations/supabase/types';
import MarkCompleteSheet from '@/components/MarkCompleteSheet';
import { useAppRole } from '@/hooks/useAppRole';
import { can_create_calendar_event, can_complete_regulatory } from '@/utils/permissions';

interface CalendarEvent {
  id: string;
  title: string;
  eventName: string;
  date: string;
  type: 'inspection' | 'maintenance' | 'document_expiry' | 'ndt';
  eventCategory: 'regulatory' | 'operational';
  status: 'open' | 'completed' | 'overdue' | 'cancelled';
  rideId?: string;
  rideName?: string;
  notes?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  autoCreateNext?: boolean;
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
  { value: 'maintenance', label: 'Scheduled Maintenance', category: 'Maintenance' },
  { value: 'preventive', label: 'Preventive Maintenance', category: 'Maintenance' },
  { value: 'repair', label: 'Repair Follow-up', category: 'Maintenance' },
];

interface EventDefaults {
  category: string;
  defaultName: string;
  recurring: { enabled: boolean; every: 'days' | 'weeks' | 'months' | 'years'; interval: number } | null;
  reminders: number[];
  complianceCategory: string; // maps to compliance_events.category
}

const EVENT_DEFAULTS: Record<string, EventDefaults> = {
  'insurance-expiry':      { category: 'Document Expiry', defaultName: 'Insurance expiry',               recurring: { enabled: true,  every: 'years',  interval: 1 }, reminders: [60, 30, 14, 7, 1], complianceCategory: 'doc_expiry' },
  'doc-expiry':            { category: 'Document Expiry', defaultName: 'Inspection certificate expiry',   recurring: { enabled: true,  every: 'years',  interval: 1 }, reminders: [60, 30, 14, 7, 1], complianceCategory: 'doc_expiry' },
  'safety-cert-expiry':    { category: 'Document Expiry', defaultName: 'Safety certificate expiry',       recurring: { enabled: true,  every: 'years',  interval: 1 }, reminders: [60, 30, 14, 7, 1], complianceCategory: 'doc_expiry' },
  'other-document-expiry': { category: 'Document Expiry', defaultName: 'Document expiry',                 recurring: null,                                            reminders: [60, 30, 14, 7],    complianceCategory: 'doc_expiry' },
  'in-service':  { category: 'Inspections', defaultName: 'In-service inspection',  recurring: { enabled: true, every: 'years', interval: 1 }, reminders: [60, 30, 14, 7, 1],    complianceCategory: 'inspection' },
  'electrical':  { category: 'Inspections', defaultName: 'Electrical inspection',  recurring: { enabled: true, every: 'years', interval: 1 }, reminders: [60, 30, 14, 7, 1],    complianceCategory: 'inspection' },
  'ndt':         { category: 'Inspections', defaultName: 'NDT inspection',         recurring: { enabled: true, every: 'years', interval: 1 }, reminders: [90, 60, 30, 14, 7, 1], complianceCategory: 'ndt' },
  'structural':  { category: 'Inspections', defaultName: 'Structural inspection',  recurring: { enabled: true, every: 'years', interval: 1 }, reminders: [60, 30, 14, 7, 1],    complianceCategory: 'inspection' },
  'hydraulic':   { category: 'Inspections', defaultName: 'Hydraulic inspection',   recurring: { enabled: true, every: 'years', interval: 1 }, reminders: [60, 30, 14, 7, 1],    complianceCategory: 'inspection' },
  'mechanical':  { category: 'Inspections', defaultName: 'Mechanical inspection',  recurring: { enabled: true, every: 'years', interval: 1 }, reminders: [60, 30, 14, 7, 1],    complianceCategory: 'inspection' },
  'safety':      { category: 'Inspections', defaultName: 'Safety inspection',      recurring: { enabled: true, every: 'years', interval: 1 }, reminders: [60, 30, 14, 7, 1],    complianceCategory: 'inspection' },
  'maintenance': { category: 'Maintenance', defaultName: 'Scheduled maintenance',  recurring: null,                                            reminders: [14, 7, 1], complianceCategory: 'maintenance' },
  'preventive':  { category: 'Maintenance', defaultName: 'Preventive maintenance', recurring: { enabled: true, every: 'months', interval: 1 }, reminders: [14, 7, 1], complianceCategory: 'maintenance' },
  'repair':      { category: 'Maintenance', defaultName: 'Repair follow-up',       recurring: null,                                            reminders: [7, 3, 1],  complianceCategory: 'maintenance' },
};

const inspectionSchema = z.object({
  ride_id: z.string().uuid({ message: "Please select a ride" }),
  inspection_type: z.string().min(1, { message: "Please select an inspection type" }),
  inspection_name: z.string().trim().min(1, { message: "Inspection name is required" }).max(200, { message: "Inspection name must be less than 200 characters" }),
  due_date: z.date({ required_error: "Due date is required" }),
  advance_notice_days: z.number().min(1).max(365),
  notes: z.string().max(1000).optional(),
});

function mapCategoryToType(category: string): CalendarEvent['type'] {
  switch (category) {
    case 'inspection': return 'inspection';
    case 'maintenance': return 'maintenance';
    case 'doc_expiry': return 'document_expiry';
    case 'ndt': return 'ndt';
    default: return 'inspection';
  }
}

const CalendarView = () => {
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const appRole = useAppRole();
  const canCreateEvent = can_create_calendar_event(appRole);
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const { subscription } = useSubscription();
  const { guardWrite } = useBillingWriteGuard();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
  const [showHelpTips, setShowHelpTips] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [markCompleteSheetOpen, setMarkCompleteSheetOpen] = useState(false);
  const [markCompleteTarget, setMarkCompleteTarget] = useState<CalendarEvent | null>(null);
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

      // Fetch from compliance_events (single source of truth)
      let query = supabase
        .from('compliance_events')
        .select('id, event_name, due_date, category, status, ride_id, notes, is_recurring, recurrence_rule, auto_create_next')
        .gte('due_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('due_date', format(monthEnd, 'yyyy-MM-dd'))
        .neq('status', 'cancelled');

      if (!isStaff) query = query.eq('user_id', effectiveUserId) as any;

      const { data: complianceEvents, error } = await query;
      if (error) throw error;

      const rideIds = new Set<string>();
      const todayForOverdue = new Date();
      todayForOverdue.setHours(0, 0, 0, 0);

      (complianceEvents || []).forEach((ce: any) => {
        if (ce.ride_id) rideIds.add(ce.ride_id);
        const dueDate = new Date(ce.due_date);
        dueDate.setHours(0, 0, 0, 0);

        let status: CalendarEvent['status'] = ce.status;
        if (ce.status === 'open' && dueDate < todayForOverdue) {
          status = 'overdue';
        }

        allEvents.push({
          id: ce.id,
          title: ce.event_name,
          eventName: ce.event_name,
          date: ce.due_date,
          type: mapCategoryToType(ce.category),
          eventCategory: ce.event_category || 'regulatory',
          status,
          rideId: ce.ride_id,
          notes: ce.notes,
          isRecurring: ce.is_recurring,
          recurrenceRule: ce.recurrence_rule,
          autoCreateNext: ce.auto_create_next,
        });
      });

      // Resolve ride names
      if (rideIds.size > 0) {
        let ridesQuery = supabase.from('rides').select('id, ride_name').in('id', Array.from(rideIds));
        if (!isStaff) ridesQuery = ridesQuery.eq('user_id', effectiveUserId) as any;
        const { data: ridesData } = await ridesQuery;
        const rideMap = new Map(ridesData?.map((r: any) => [r.id, r.ride_name]) || []);
        allEvents.forEach(event => {
          if (event.rideId) {
            event.rideName = rideMap.get(event.rideId) || 'Unknown Ride';
            event.title = `${event.rideName} - ${event.eventName}`;
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
    setSelectedEvent(event);
    setEventDetailOpen(true);
  };

  const handleMarkComplete = (event: CalendarEvent) => {
    setMarkCompleteTarget(event);
    setMarkCompleteSheetOpen(true);
  };

  const handleMarkCompleteFinished = () => {
    setEventDetailOpen(false);
    setSelectedEvent(null);
    loadCalendarEvents();
  };

  const handleDeleteEvent = async (event: CalendarEvent) => {
    try {
      const { error } = await supabase
        .from('compliance_events')
        .update({ status: 'cancelled' })
        .eq('id', event.id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Event removed from calendar." });
      setDeleteConfirmOpen(false);
      setEventDetailOpen(false);
      setSelectedEvent(null);
      loadCalendarEvents();
      queryClient.invalidateQueries({ queryKey: ['compliance'] });
    } catch {
      toast({ title: "Error", description: "Could not delete event.", variant: "destructive" });
    }
  };

  const handleEditEvent = (event: CalendarEvent) => {
    const eventType = event.type === 'inspection' ? 'safety' : event.type === 'maintenance' ? 'maintenance' : event.type === 'ndt' ? 'ndt' : 'doc-expiry';
    const defaults = EVENT_DEFAULTS[eventType];
    setFormData({
      selected_document_id: '',
      ride_id: event.rideId || '',
      inspection_type: eventType,
      inspection_name: event.eventName,
      due_date: parseISO(event.date),
      advance_notice_days: 30,
      notes: event.notes || '',
      enable_reminders: true,
      reminder_days: defaults?.reminders ?? [7, 1],
      is_recurring: event.isRecurring || false,
      recurrence_value: defaults?.recurring?.interval ?? 1,
      recurrence_unit: (defaults?.recurring?.every ?? 'months') as 'days' | 'weeks' | 'months' | 'years',
    });
    setEventDetailOpen(false);
    setEditingEvent(true);
    setAddDialogOpen(true);
  };

  const getEventTypeLabel = (event: CalendarEvent) => {
    if (event.type === 'document_expiry') return 'Document Expiry';
    if (event.type === 'ndt') return 'NDT Inspection';
    if (event.type === 'maintenance') return 'Maintenance';
    if (event.type === 'inspection') return 'Inspection';
    return 'Event';
  };

  const getStatusChip = (event: CalendarEvent) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(event.date);
    d.setHours(0, 0, 0, 0);
    if (event.status === 'completed') return { label: 'Completed', className: 'bg-green-100 text-green-800 border-green-200' };
    if (d < today || event.status === 'overdue') return { label: 'Overdue', className: 'bg-destructive/10 text-destructive border-destructive/20' };
    if (d <= addDays(today, 7)) return { label: 'Due soon', className: 'bg-amber-100 text-amber-800 border-amber-200' };
    return { label: 'Scheduled', className: 'bg-muted text-muted-foreground border-border' };
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
    if (!canCreateEvent) {
      toast({ title: 'Permission denied', description: 'Only the Controller or Manager can add calendar events.', variant: 'destructive' });
      return;
    }
    setFormData(prev => ({ ...prev, due_date: date }));
    setAddDialogOpen(true);
  };

  const handleAddEvent = async () => {
    setFormErrors({});
    try {
      if (formData.inspection_type.includes('check')) {
        toast({ title: "Use the Checks module", description: "Daily, monthly and pre-opening checks are managed in the Checks module.", variant: "destructive" });
        return;
      }

      const validatedData = inspectionSchema.parse(formData);
      const defaults = EVENT_DEFAULTS[formData.inspection_type];
      const complianceCategory = defaults?.complianceCategory || 'inspection';

      const recurrenceRule = formData.is_recurring
        ? `${formData.recurrence_unit}:${formData.recurrence_value}`
        : null;

      const seriesId = formData.is_recurring ? crypto.randomUUID() : null;

      const { error } = await supabase.from('compliance_events').insert([{
        user_id: user!.id,
        ride_id: validatedData.ride_id,
        category: complianceCategory,
        event_type: formData.inspection_type,
        event_name: validatedData.inspection_name,
        due_date: format(validatedData.due_date, 'yyyy-MM-dd'),
        status: 'open',
        notes: validatedData.notes || null,
        advance_notice_days: validatedData.advance_notice_days,
        is_recurring: formData.is_recurring,
        recurrence_rule: recurrenceRule,
        recurrence_anchor_date: formData.is_recurring ? format(validatedData.due_date, 'yyyy-MM-dd') : null,
        series_id: seriesId,
        auto_create_next: formData.is_recurring,
        reminder_days: formData.enable_reminders ? formData.reminder_days : [],
        reminder_enabled: formData.enable_reminders,
      }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: formData.is_recurring
          ? `Recurring schedule created (every ${formData.recurrence_value} ${formData.recurrence_unit})`
          : "Schedule created successfully",
      });

      setAddDialogOpen(false);
      resetForm();
      loadCalendarEvents();
      queryClient.invalidateQueries({ queryKey: ['compliance'] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) errors[err.path[0].toString()] = err.message;
        });
        setFormErrors(errors);
      } else {
        console.error('Error saving event:', error);
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

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const overdueCount = events.filter(e => e.status === 'overdue' || (e.status === 'open' && new Date(e.date) < todayStart)).length;
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
          {canCreateEvent && (
            <DialogTrigger asChild>
              <Button className="shrink-0">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-md p-0 gap-0 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
              <DialogTitle className="text-lg font-semibold text-foreground">Add Event</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                Schedule reminders for inspections, maintenance and expiries.
              </DialogDescription>

              <div className="grid grid-cols-2 gap-2 mt-4">
                {[
                  { label: 'Inspection', value: 'safety' },
                  { label: 'Maintenance', value: 'maintenance' },
                  { label: 'Doc expiry', value: 'doc-expiry' },
                  { label: 'NDT', value: 'ndt' },
                ].map(preset => {
                  const defaults = EVENT_DEFAULTS[preset.value];
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => {
                        if (!defaults) return;
                        setFormData(prev => ({
                          ...prev,
                          inspection_type: preset.value,
                          reminder_days: defaults.reminders,
                          is_recurring: defaults.recurring?.enabled ?? false,
                          recurrence_value: defaults.recurring?.interval ?? 1,
                          recurrence_unit: (defaults.recurring?.every ?? 'months') as typeof prev.recurrence_unit,
                          inspection_name: prev.inspection_name ? prev.inspection_name : defaults.defaultName,
                        }));
                      }}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-sm font-semibold text-left transition-colors",
                        formData.inspection_type === preset.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:bg-muted/50"
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                Daily &amp; pre-opening checks are managed in the{' '}
                <button type="button" onClick={() => { setAddDialogOpen(false); navigate('/checks'); }} className="text-primary hover:underline font-medium">Checks module</button>
                , not scheduled here.
              </p>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Details card */}
              <div className="rounded-2xl border border-border bg-white p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Details</p>

                <div className="space-y-1.5">
                  <Label htmlFor="ride_id" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ride *</Label>
                  <Select value={formData.ride_id} onValueChange={(value) => { setFormData({ ...formData, ride_id: value, selected_document_id: '', inspection_name: '' }); loadRideDocuments(value); }}>
                    <SelectTrigger><SelectValue placeholder="Select a ride" /></SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {rides.map((ride) => <SelectItem key={ride.id} value={ride.id}>{ride.ride_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {formErrors.ride_id && <p className="text-xs text-destructive">{formErrors.ride_id}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {formData.inspection_type.includes('expiry') ? 'Document *' : 'Event Name *'}
                  </Label>
                  {formData.inspection_type.includes('expiry') ? (
                    <>
                      <Select value={formData.selected_document_id} onValueChange={(value) => {
                        const doc = rideDocuments.find(d => d.id === value);
                        setFormData({ ...formData, selected_document_id: value, inspection_name: doc?.document_name || '', due_date: doc?.expires_at ? new Date(doc.expires_at) : formData.due_date });
                      }} disabled={!formData.ride_id || loadingDocuments}>
                        <SelectTrigger>
                          <SelectValue placeholder={!formData.ride_id ? "Select a ride first" : loadingDocuments ? "Loading documents..." : rideDocuments.length === 0 ? "No documents for this ride" : "Select a document"} />
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
                        <p className="text-xs text-muted-foreground">No documents yet. <button type="button" onClick={() => navigate(`/rides/${formData.ride_id}`)} className="text-primary hover:underline">Upload documents</button> first.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <Input id="inspection_name" value={formData.inspection_name} onChange={(e) => setFormData({ ...formData, inspection_name: e.target.value })} placeholder="e.g., Annual Safety Inspection" maxLength={200} />
                      <p className="text-xs text-muted-foreground">This name appears on reports and reminders.</p>
                    </>
                  )}
                  {formErrors.inspection_name && <p className="text-xs text-destructive">{formErrors.inspection_name}</p>}
                </div>

                {!formData.inspection_type && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Event Type *</Label>
                    <Select
                      value={formData.inspection_type}
                      onValueChange={(value) => {
                        const defaults = EVENT_DEFAULTS[value];
                        setFormData(prev => ({
                          ...prev,
                          inspection_type: value,
                          reminder_days: defaults?.reminders ?? prev.reminder_days,
                          is_recurring: defaults?.recurring?.enabled ?? false,
                          recurrence_value: defaults?.recurring?.interval ?? 1,
                          recurrence_unit: (defaults?.recurring?.every ?? 'months') as typeof prev.recurrence_unit,
                          inspection_name: prev.inspection_name ? prev.inspection_name : (defaults?.defaultName ?? ''),
                        }));
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select event type" /></SelectTrigger>
                      <SelectContent className="bg-popover z-50 max-h-[300px]">
                        {['Document Expiry', 'Inspections', 'Maintenance'].map(category => {
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
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date *</Label>
                  <Popover open={calendarPickerOpen} onOpenChange={setCalendarPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.due_date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.due_date ? format(formData.due_date, "d MMM yyyy") : "Select due date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                      <Calendar mode="single" selected={formData.due_date} onSelect={(date) => { setFormData({ ...formData, due_date: date }); setCalendarPickerOpen(false); }} initialFocus disabled={(date) => date < new Date()} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  {formErrors.due_date && <p className="text-xs text-destructive">{formErrors.due_date}</p>}
                </div>
              </div>

              {/* Reminders card */}
              <div className="rounded-2xl border border-border bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Reminders</p>
                    <p className="text-xs text-muted-foreground">Choose when you want to be notified.</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.enable_reminders}
                      onChange={(e) => setFormData({ ...formData, enable_reminders: e.target.checked })}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    Email
                  </label>
                </div>

                {formData.enable_reminders && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {[90, 60, 30, 14, 7, 3, 1].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => {
                            const current = formData.reminder_days;
                            const updated = current.includes(days) ? current.filter(d => d !== days) : [...current, days].sort((a, b) => b - a);
                            setFormData({ ...formData, reminder_days: updated });
                          }}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                            formData.reminder_days.includes(days)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                          )}
                        >
                          {days === 1 ? '1 day' : `${days} days`}
                        </button>
                      ))}
                    </div>
                    <div className="rounded-xl bg-muted/30 border border-border px-3 py-2 text-xs text-muted-foreground">
                      Reminders sent relative to the due date.
                    </div>
                  </>
                )}
              </div>

              {/* Recurring card */}
              <div className="rounded-2xl border border-border bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Recurring</p>
                    <p className="text-xs text-muted-foreground">Auto-create future occurrences.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    className="w-5 h-5 rounded border-border accent-primary cursor-pointer"
                  />
                </div>

                {formData.is_recurring && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Repeat every</Label>
                      <Select
                        value={`${formData.recurrence_value}-${formData.recurrence_unit}`}
                        onValueChange={(val) => {
                          const [v, u] = val.split('-');
                          setFormData({ ...formData, recurrence_value: parseInt(v), recurrence_unit: u as typeof formData.recurrence_unit });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="1-years">1 year</SelectItem>
                          <SelectItem value="12-months">12 months</SelectItem>
                          <SelectItem value="6-months">6 months</SelectItem>
                          <SelectItem value="3-months">3 months</SelectItem>
                          <SelectItem value="1-months">1 month</SelectItem>
                          <SelectItem value="1-weeks">1 week</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">End</Label>
                      <Select defaultValue="never">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="never">Never</SelectItem>
                          <SelectItem value="5">After 5 times</SelectItem>
                          <SelectItem value="10">After 10 times</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes card */}
              <div className="rounded-2xl border border-border bg-white p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Notes</p>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Requirements, access notes, reference numbers, etc."
                  rows={3}
                  maxLength={1000}
                />
                {formErrors.notes && <p className="text-xs text-destructive">{formErrors.notes}</p>}
              </div>
            </div>

            {/* Sticky footer */}
            <div className="shrink-0 border-t border-border bg-white px-5 py-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleAddEvent}>
                Create Schedule
              </Button>
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
            onDayClick={(date) => { if (canCreateEvent && getEventsForDate(date).length === 0) openQuickAdd(date); }}
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
              overdue: (date) => getEventsForDate(date).some(e => e.status === 'overdue' || (e.status === 'open' && new Date(e.date) < new Date())),
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
            {canCreateEvent && (
              <Button size="sm" onClick={() => openQuickAdd(selectedDate)}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            )}
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
                    className="w-full p-3 rounded-xl border border-border bg-background hover:border-primary/30 hover:bg-muted/30 transition-colors text-left">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        event.type === 'inspection' && "bg-primary",
                        event.type === 'maintenance' && "bg-blue-500",
                        event.type === 'document_expiry' && "bg-destructive",
                        event.type === 'ndt' && "bg-violet-500",
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{event.eventName}</p>
                        {event.rideName && <p className="text-xs text-muted-foreground truncate">{event.rideName}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {event.status === 'completed' && <Badge className="text-[10px] px-1.5 bg-green-100 text-green-800 border-green-200">Done</Badge>}
                        {event.status === 'overdue' && <Badge className="text-[10px] px-1.5 bg-destructive/10 text-destructive border-destructive/20">Overdue</Badge>}
                        <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
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
              <button key={event.id} onClick={() => handleEventClick(event)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:border-primary/30 hover:bg-muted/30 transition-colors text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    event.type === 'inspection' && "bg-primary",
                    event.type === 'maintenance' && "bg-blue-500",
                    event.type === 'document_expiry' && "bg-destructive",
                    event.type === 'ndt' && "bg-violet-500",
                  )} />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{event.eventName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {event.rideName && <span>{event.rideName} · </span>}
                      {format(parseISO(event.date), 'EEE d MMM')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 ml-3 shrink-0">
                  {event.status === 'overdue'
                    ? <Badge className="text-[10px] px-1.5 bg-destructive/10 text-destructive border-destructive/20">Overdue</Badge>
                    : <Badge variant="outline" className={cn("text-[10px] px-1.5", getEventTypeColor(event.type))}>
                        {event.type === 'document_expiry' ? 'Expiry' : event.type.replace('_', ' ')}
                      </Badge>
                  }
                  <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
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
                <span><strong className="text-foreground">Click an event</strong> to view details, mark complete, or delete</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* ── Event Detail Sheet with Mark Complete ── */}
      <Sheet open={eventDetailOpen} onOpenChange={(open) => { setEventDetailOpen(open); if (!open) setDeleteConfirmOpen(false); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] flex flex-col p-0">
          {selectedEvent && (() => {
            const statusChip = getStatusChip(selectedEvent);
            const eventTypeLabel = getEventTypeLabel(selectedEvent);
            const isCompleted = selectedEvent.status === 'completed';
            return (
              <>
                {/* Header */}
                <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={cn(
                        "w-3 h-3 rounded-full mt-1 shrink-0",
                        selectedEvent.type === 'inspection' && "bg-primary",
                        selectedEvent.type === 'maintenance' && "bg-blue-500",
                        selectedEvent.type === 'document_expiry' && "bg-destructive",
                        selectedEvent.type === 'ndt' && "bg-violet-500",
                      )} />
                      <div className="min-w-0">
                        <SheetTitle className="text-base font-semibold text-foreground leading-tight">{selectedEvent.eventName}</SheetTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{eventTypeLabel}</p>
                      </div>
                    </div>
                    <Badge className={cn("shrink-0 text-xs", statusChip.className)}>
                      {statusChip.label}
                    </Badge>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

                  {/* Due date */}
                  <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Due date</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{format(parseISO(selectedEvent.date), 'EEEE, d MMMM yyyy')}</p>
                    </div>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>

                  {/* Ride */}
                  {selectedEvent.rideName && selectedEvent.rideId && (
                    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ride / Equipment</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{selectedEvent.rideName}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/rides/${selectedEvent.rideId}`); setEventDetailOpen(false); }}
                        className="flex items-center gap-1 text-xs text-primary font-medium hover:underline shrink-0"
                      >
                        View <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Recurring info */}
                  <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Recurring</p>
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      {selectedEvent.isRecurring && selectedEvent.recurrenceRule
                        ? `Every ${selectedEvent.recurrenceRule.replace(':', ' ')}`
                        : 'Not recurring'}
                    </span>
                  </div>

                  {/* Notes */}
                  <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Notes</p>
                    {selectedEvent.notes ? (
                      <p className="text-sm text-foreground">{selectedEvent.notes}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </div>

                  {/* Recurring auto-create confirmation */}
                  {!isCompleted && selectedEvent.isRecurring && selectedEvent.autoCreateNext && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                      <p className="text-xs text-primary font-medium">
                        <Repeat className="h-3 w-3 inline mr-1" />
                        Completing this will automatically schedule the next occurrence.
                      </p>
                    </div>
                  )}

                  {/* Delete confirmation inline */}
                  {deleteConfirmOpen && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 space-y-3">
                      <p className="text-sm font-semibold text-destructive">Delete this event?</p>
                      <p className="text-xs text-muted-foreground">This will permanently remove <strong>{selectedEvent.eventName}</strong> from your calendar.</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                        <Button size="sm" className="flex-1 bg-destructive text-white hover:bg-destructive/90" onClick={() => handleDeleteEvent(selectedEvent)}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                {(() => {
                  const isRegulatory = selectedEvent.eventCategory === 'regulatory';
                  const canComplete = isRegulatory ? can_complete_regulatory(appRole) : true;
                  return (
                    <div className="shrink-0 border-t border-border bg-background px-5 py-4 flex gap-2">
                      {canCreateEvent && !isCompleted && !deleteConfirmOpen && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => setDeleteConfirmOpen(true)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {canCreateEvent && !isCompleted && (
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleEditEvent(selectedEvent)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      )}
                      {canComplete && !isCompleted ? (
                        <Button
                          className="flex-1 gap-1.5"
                          onClick={() => handleMarkComplete(selectedEvent)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Mark Complete
                        </Button>
                      ) : (
                        <Button className="flex-1" onClick={() => { setEventDetailOpen(false); setDeleteConfirmOpen(false); }}>
                          Close
                        </Button>
                      )}
                    </div>
                  );
                })()}
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Mark Complete Sheet */}
      {markCompleteTarget && (
        <MarkCompleteSheet
          open={markCompleteSheetOpen}
          onOpenChange={(open) => { setMarkCompleteSheetOpen(open); if (!open) setMarkCompleteTarget(null); }}
          eventId={markCompleteTarget.id}
          eventName={markCompleteTarget.eventName}
          isRecurring={markCompleteTarget.isRecurring}
          recurrenceRule={markCompleteTarget.recurrenceRule}
          onCompleted={handleMarkCompleteFinished}
        />
      )}

    </div>
  );
};

export default CalendarView;
