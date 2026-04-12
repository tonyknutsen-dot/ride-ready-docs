import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Plus, Calendar as CalendarIcon, Edit, Trash2, AlertTriangle, Clock, Repeat, CheckCircle2, MoreVertical, FileText, Download, User, Building2, ChevronRight } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { openDocumentById } from '@/utils/documentOpen';
import { getSignedStorageUrl } from '@/utils/exportFileActions';
import MarkCompleteSheet from '@/components/MarkCompleteSheet';
import { format, differenceInDays, isBefore } from 'date-fns';
import { formatDateUK } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBillingWriteGuard } from '@/hooks/useBillingWriteGuard';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateComplianceQueries } from '@/utils/queryInvalidation';
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
  const { guardWrite } = useBillingWriteGuard();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ComplianceEvent | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [markingComplete, setMarkingComplete] = useState<string | null>(null);
  const [markCompleteSheetOpen, setMarkCompleteSheetOpen] = useState(false);
  const [markCompleteTarget, setMarkCompleteTarget] = useState<ComplianceEvent | null>(null);
  const [detailEvent, setDetailEvent] = useState<ComplianceEvent | null>(null);
  const [linkedDocId, setLinkedDocId] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const { toast } = useToast();
  // Look up linked document when a completed event is selected
  useEffect(() => {
    if (!detailEvent) { setLinkedDocId(null); return; }
    let cancelled = false;
    setLoadingDoc(true);
    (async () => {
      const { data: rdoc } = await supabase
        .from('ride_documents')
        .select('id')
        .eq('related_event_id', detailEvent.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setLinkedDocId(rdoc?.id || null);
        setLoadingDoc(false);
      }
    })();
    return () => { cancelled = true; };
  }, [detailEvent]);

  const handleViewDocument = () => {
    if (!linkedDocId) return;
    openDocumentById({ documentId: linkedDocId, navigate, sourceComponent: 'InspectionScheduleManager', toast });
  };

  const handleDownloadDocument = async () => {
    if (!linkedDocId) return;
    const { data: rdoc } = await supabase
      .from('ride_documents')
      .select('file_url, title')
      .eq('id', linkedDocId)
      .maybeSingle();
    if (!rdoc?.file_url) { toast({ title: 'No file available', variant: 'destructive' }); return; }
    const url = await getSignedStorageUrl(rdoc.file_url);
    if (!url) { toast({ title: 'Could not generate download link', variant: 'destructive' }); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = rdoc.title || 'document.pdf';
    a.click();
  };

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
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (guardWrite()) return;
    if (!formData.inspection_type || !formData.inspection_name || !formData.due_date) {
      toast({
        title: "Missing fields",
        description: "Please fill in the type, name, and due date.",
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
        toast({ title: "Updated", description: "Inspection schedule updated." });
      } else {
        const seriesId = formData.is_recurring ? crypto.randomUUID() : null;
        const { error } = await supabase
          .from('compliance_events')
          .insert([{ ...eventData, series_id: seriesId, status: 'open' }]);
        if (error) throw error;
        toast({ title: "Created", description: "Inspection schedule created." });
      }

      setSheetOpen(false);
      resetForm();
      loadEvents();
      invalidateComplianceQueries(queryClient);
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
      toast({ title: "Removed", description: "Inspection schedule removed." });
      loadEvents();
      invalidateComplianceQueries(queryClient);
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
    invalidateComplianceQueries(queryClient);
  };

  const getStatusBadge = (event: ComplianceEvent) => {
    if (event.status === 'completed') {
      return <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] px-1.5 py-0">Completed</Badge>;
    }
    const due = new Date(event.due_date);
    const today = new Date();
    const daysUntilDue = differenceInDays(due, today);

    if (isBefore(due, today)) {
      return (
        <span className="inline-flex items-center gap-1">
          <Badge variant="destructive" className="flex items-center gap-1 text-[10px] px-1.5 py-0 whitespace-nowrap">
            <AlertTriangle className="h-2.5 w-2.5" />
            Overdue
          </Badge>
          <span className="text-[10px] text-destructive font-medium">{Math.abs(daysUntilDue)}d</span>
        </span>
      );
    } else if (daysUntilDue <= event.advance_notice_days) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-warning/15 text-warning border-warning/30 text-[10px] px-1.5 py-0">
          <Clock className="h-2.5 w-2.5" />
          Due in {daysUntilDue}d
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="flex items-center gap-1 text-[10px] px-1.5 py-0">
          <CalendarIcon className="h-2.5 w-2.5" />
          Scheduled
        </Badge>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-sm text-muted-foreground">Loading…</span>
      </div>
    );
  }

  const scheduledEvents = events.filter(e => e.status === 'open');
  const completedEvents = events.filter(e => e.status === 'completed');

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Scheduled Inspections</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track due dates and get advance reminders for inspections.
            {scheduledEvents.length > 0 && ` ${scheduledEvents.length} scheduled`}
            {completedEvents.length > 0 && ` · ${completedEvents.length} completed`}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => { resetForm(); setSheetOpen(true); }}
          className="gap-1.5 h-8"
        >
          <Plus className="h-3.5 w-3.5" />
          New Schedule
        </Button>
      </div>

      {/* Add/Edit Sheet — full-height on mobile, avoids scroll-inside-scroll */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) resetForm(); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>
              {editingEvent ? 'Edit Inspection' : 'New Scheduled Inspection'}
            </SheetTitle>
            <SheetDescription>
              Set up an inspection with a due date and optional recurring schedule.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5">
            {/* Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Inspection Type</Label>
              <Select
                value={formData.inspection_type}
                onValueChange={(value) => setFormData({ ...formData, inspection_type: value })}
              >
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {INSPECTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Name</Label>
              <Input
                value={formData.inspection_name}
                onChange={(e) => setFormData({ ...formData, inspection_name: e.target.value })}
                placeholder="e.g. Annual structural inspection"
              />
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Due Date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.due_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.due_date ? format(formData.due_date, "d MMM yyyy") : "Select date"}
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

            {/* Reminder */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reminder before due date (days)</Label>
              <Input
                type="number" min="1" max="365"
                value={formData.advance_notice_days}
                onChange={(e) => setFormData({ ...formData, advance_notice_days: parseInt(e.target.value) || 30 })}
              />
              <p className="text-[10px] text-muted-foreground">You'll be reminded this many days before the due date.</p>
            </div>

            {/* Recurrence */}
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium">Repeat after completion</Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Automatically create the next schedule when completed.</p>
                </div>
                <Switch
                  checked={formData.is_recurring}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
                />
              </div>
              {formData.is_recurring && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">Every</span>
                  <Input
                    type="number" min="1" max="99"
                    value={formData.recurrence_value}
                    onChange={(e) => setFormData({ ...formData, recurrence_value: parseInt(e.target.value) || 1 })}
                    className="w-16 h-8 text-sm"
                  />
                  <Select value={formData.recurrence_unit} onValueChange={(v) => setFormData({ ...formData, recurrence_unit: v as any })}>
                    <SelectTrigger className="w-[100px] h-8 text-sm"><SelectValue /></SelectTrigger>
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

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes (optional)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional details"
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setSheetOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} className="flex-1">{editingEvent ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Empty state */}
      {scheduledEvents.length === 0 && completedEvents.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="No scheduled inspections"
          description="Add an inspection to start tracking due dates and reminders."
          variant="compact"
        />
      ) : (
        <div className="space-y-3">
          {/* Scheduled cards */}
          {scheduledEvents.map((event) => (
            <Card key={event.id} className="border-border">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  {/* Left: info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-sm font-semibold truncate">{event.event_name}</h4>
                      {getStatusBadge(event)}
                      {event.is_recurring && (
                        <Badge variant="outline" className="gap-0.5 text-[10px] px-1.5 py-0">
                          <Repeat className="h-2.5 w-2.5" /> Repeats
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {INSPECTION_TYPES.find(t => t.value === event.event_type)?.label || event.event_type}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Due {format(new Date(event.due_date), 'd MMM yyyy')}
                      {event.notes && <span className="ml-1.5 opacity-70">· {event.notes}</span>}
                    </p>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleMarkComplete(event)}
                      disabled={markingComplete === event.id}
                      className="h-7 px-2.5 text-xs gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Complete
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(event)}>
                          <Edit className="h-3.5 w-3.5 mr-2" /> Edit
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete inspection schedule</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{event.event_name}"? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(event.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {event.is_recurring && event.auto_create_next && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Next occurrence will be created automatically on completion.
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/70 mt-1 border-t border-border/30 pt-1.5">
                  Press <span className="font-semibold text-muted-foreground">Complete</span> to record this inspection as done — this removes it from your dashboard and Inspections Due list.
                  {event.is_recurring ? ' A new due date will be created automatically.' : ''}
                  {' '}You can optionally attach a report or certificate during completion.
                </p>
              </CardContent>
            </Card>
          ))}

          {/* Completed section */}
          {completedEvents.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Completed</h4>
              {completedEvents.slice(0, 5).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setDetailEvent(event)}
                  aria-label={`View completion record for ${event.event_name}`}
                  className="w-full flex items-center justify-between py-3 px-3.5 rounded-lg border border-border bg-card gap-3 text-left shadow-sm hover:shadow hover:border-foreground/20 active:bg-muted/50 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{event.event_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {INSPECTION_TYPES.find(t => t.value === event.event_type)?.label || event.event_type}
                        {event.completed_by_name && <span> · {event.completed_by_name}</span>}
                      </p>
                      <p className="text-[10px] text-primary/70 mt-0.5">View completion record</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {event.completed_at ? format(new Date(event.completed_at), 'd MMM yyyy') : ''}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mark Complete Sheet */}

      {/* Completed Detail Drawer */}
      <Sheet open={!!detailEvent} onOpenChange={(open) => { if (!open) setDetailEvent(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">{detailEvent?.event_name}</SheetTitle>
            <SheetDescription>
              {INSPECTION_TYPES.find(t => t.value === detailEvent?.event_type)?.label || detailEvent?.event_type} · {ride.ride_name}
            </SheetDescription>
          </SheetHeader>

          {detailEvent && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Completed</p>
                  <p className="text-sm font-medium">
                    {detailEvent.completed_at
                      ? format(new Date(detailEvent.completed_at), "d MMM yyyy 'at' HH:mm")
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Due Date</p>
                  <p className="text-sm font-medium">{formatDateUK(new Date(detailEvent.due_date))}</p>
                </div>
              </div>

              {(detailEvent.completed_by_name || detailEvent.completed_by_role) && (
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Completed By</p>
                    <p className="text-sm font-medium">
                      {detailEvent.completed_by_name || '—'}
                      {detailEvent.completed_by_role && (
                        <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0">{detailEvent.completed_by_role}</Badge>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {detailEvent.inspector_company && (
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Inspector / Company</p>
                    <p className="text-sm font-medium">{detailEvent.inspector_company}</p>
                  </div>
                </div>
              )}

              {detailEvent.certificate_reference && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Certificate / Report Ref</p>
                  <p className="text-sm font-mono">{detailEvent.certificate_reference}</p>
                </div>
              )}

              {detailEvent.full_document_id && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Document ID</p>
                  <p className="text-xs font-mono text-muted-foreground">{detailEvent.full_document_id}</p>
                </div>
              )}

              {detailEvent.is_recurring && detailEvent.next_event_id && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Next Due Date</p>
                  <Badge variant="secondary" className="text-xs mt-0.5">Recurring — next occurrence created</Badge>
                </div>
              )}

              {detailEvent.completion_notes && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Notes</p>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-2 mt-1">{detailEvent.completion_notes}</p>
                </div>
              )}

              {detailEvent.evidence_urls && detailEvent.evidence_urls.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Attachments ({detailEvent.evidence_urls.length})</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {detailEvent.evidence_urls.map((url, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {url.split('/').pop()?.slice(0, 25) || `File ${i + 1}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-3 space-y-2">
                {loadingDoc ? (
                  <p className="text-xs text-muted-foreground">Looking up linked document…</p>
                ) : linkedDocId ? (
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 gap-1.5" onClick={handleViewDocument}>
                      <FileText className="h-3.5 w-3.5" /> View Document
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDownloadDocument}>
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    This completion was recorded before document linking was available. No linked completion document exists for this historical record.
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {markCompleteTarget && (
        <MarkCompleteSheet
          open={markCompleteSheetOpen}
          onOpenChange={(open) => { setMarkCompleteSheetOpen(open); if (!open) setMarkCompleteTarget(null); }}
          eventId={markCompleteTarget.id}
          eventName={markCompleteTarget.event_name}
          eventCategory={markCompleteTarget.category}
          eventType={markCompleteTarget.event_type}
          rideId={ride.id}
          rideName={ride.ride_name}
          dueDate={markCompleteTarget.due_date}
          isRecurring={markCompleteTarget.is_recurring}
          recurrenceRule={markCompleteTarget.recurrence_rule}
          onCompleted={handleMarkCompleteFinished}
        />
      )}
    </div>
  );
};

export default InspectionScheduleManager;
