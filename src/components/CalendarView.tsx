import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
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
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isSameDay, addDays, startOfMonth, endOfMonth } from 'date-fns';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'inspection' | 'maintenance' | 'document_expiry' | 'ndt';
  status: 'pending' | 'completed' | 'overdue';
  rideId?: string;
  rideName?: string;
}

const CalendarView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    if (user) {
      loadCalendarEvents();
    } else {
      setLoading(false);
    }
  }, [user, currentMonth]);

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
      const { data: inspections } = await supabase
        .from('inspection_checks')
        .select('id, check_date, status, ride_id')
        .eq('user_id', user?.id)
        .gte('check_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('check_date', format(monthEnd, 'yyyy-MM-dd'));

      inspections?.forEach(inspection => {
        if (inspection.ride_id) rideIds.add(inspection.ride_id);
        allEvents.push({
          id: inspection.id,
          title: `Inspection`,
          date: inspection.check_date,
          type: 'inspection',
          status: inspection.status as 'pending' | 'completed' | 'overdue',
          rideId: inspection.ride_id,
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
    return events.filter(event => 
      isSameDay(parseISO(event.date), date) && 
      (filterType === 'all' || event.type === filterType)
    );
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'inspection': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'maintenance': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'document_expiry': return 'bg-red-100 text-red-800 border-red-200';
      case 'ndt': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'overdue': return <AlertTriangle className="h-3 w-3 text-destructive" />;
      case 'pending': return <Clock className="h-3 w-3 text-amber-600" />;
      default: return null;
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
      {/* Header with Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Calendar View
              </CardTitle>
              <CardDescription>
                View and manage inspection schedules and important dates
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addDays(currentMonth, -30))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-3">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addDays(currentMonth, 30))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Schedule</h3>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="text-sm border rounded px-2 py-1 bg-background"
                >
                  <option value="all">All Events</option>
                  <option value="inspection">Inspections</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="document_expiry">Document Expiry</option>
                  <option value="ndt">NDT Tests</option>
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
              modifiers={{
                hasEvents: (date) => getEventsForDate(date).length > 0,
                overdue: (date) => getEventsForDate(date).some(e => 
                  e.status === 'overdue' || (e.status === 'pending' && new Date(e.date) < new Date())
                ),
              }}
              modifiersClassNames={{
                hasEvents: "bg-accent/50 font-bold",
                overdue: "bg-destructive/20 text-destructive",
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
                    className="p-3 rounded-lg border bg-card-hover hover:bg-accent/50 transition-smooth"
                  >
                    <div className="flex items-start justify-between space-x-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          {getStatusIcon(event.status)}
                          <p className="font-medium text-sm truncate">
                            {event.title}
                          </p>
                        </div>
                        {event.rideName && (
                          <p className="text-xs text-muted-foreground">
                            {event.rideName}
                          </p>
                        )}
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs shrink-0", getEventTypeColor(event.type))}
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
                    className="flex items-center justify-between p-3 rounded-lg border bg-card-hover hover:bg-accent/50 transition-smooth"
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