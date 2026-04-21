import { useState, useEffect } from 'react';
import { format, subMonths } from 'date-fns';
import { FileDown, Filter, Clock, CheckSquare, AlertTriangle, Wrench, Shield, GitBranch, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/PageHeader';
import { generateTimelineReportPdf, storeTimelineReportPdf, type TimelineEvent } from '@/utils/timelineReportPdf';
import ExportActionsDialog, { type ExportResult } from '@/components/ExportActionsDialog';
import ExportDateRangePicker, { type DateRange } from '@/components/ExportDateRangePicker';

const EVENT_TYPE_CONFIG: Record<string, { icon: any; color: string; bgColor: string; borderColor: string; label: string }> = {
  CHECK: { icon: CheckSquare, color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200', label: 'Check' },
  DEFECT: { icon: AlertTriangle, color: 'text-destructive', bgColor: 'bg-destructive/5', borderColor: 'border-destructive/20', label: 'Defect' },
  MAINTENANCE: { icon: Wrench, color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', label: 'Maintenance' },
  COMPLIANCE: { icon: Shield, color: 'text-primary', bgColor: 'bg-primary/5', borderColor: 'border-primary/20', label: 'Compliance' },
  AMENDMENT: { icon: GitBranch, color: 'text-muted-foreground', bgColor: 'bg-muted', borderColor: 'border-border', label: 'Amendment' },
};

interface ReportsPageProps {
  preFilterRideId?: string;
  preFilterRideName?: string;
}

export default function Reports({ preFilterRideId, preFilterRideName }: ReportsPageProps) {
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subMonths(new Date(), 3),
    to: new Date(),
    preset: '3m',
  });
  const startDate = dateRange.from ?? subMonths(new Date(), 12);
  const endDate = dateRange.to ?? new Date();
  const [selectedRideId, setSelectedRideId] = useState<string>(preFilterRideId || 'all');
  const [rides, setRides] = useState<Array<{ id: string; ride_name: string; ride_code: string }>>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [filters, setFilters] = useState({
    checks: true,
    defects: true,
    maintenance: true,
    compliance: true,
    amendments: true,
  });

  // Load rides for the selector
  useEffect(() => {
    if (!effectiveUserId) return;
    supabase
      .from('rides')
      .select('id, ride_name, ride_code')
      .eq('user_id', effectiveUserId)
      .order('ride_name')
      .then(({ data }) => setRides(data || []));
  }, [effectiveUserId]);

  // Load timeline events
  useEffect(() => {
    loadEvents();
  }, [effectiveUserId, selectedRideId, startDate, endDate, filters]);

  const loadEvents = async () => {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      // Build active event types from filters
      const activeTypes: string[] = [];
      if (filters.checks) activeTypes.push('CHECK');
      if (filters.defects) activeTypes.push('DEFECT');
      if (filters.maintenance) activeTypes.push('MAINTENANCE');
      if (filters.compliance) activeTypes.push('COMPLIANCE');
      if (filters.amendments) activeTypes.push('AMENDMENT');

      if (activeTypes.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('timeline_events' as any)
        .select('*')
        .eq('user_id', effectiveUserId)
        .in('event_type', activeTypes)
        .gte('event_datetime', startDate.toISOString())
        .lte('event_datetime', endDate.toISOString())
        .order('event_datetime', { ascending: false })
        .limit(500);

      if (selectedRideId !== 'all') {
        query = query.eq('ride_id', selectedRideId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Failed to load timeline events:', error);
        toast({ title: 'Failed to load events', description: error.message, variant: 'destructive' });
      }
      setEvents((data as unknown as TimelineEvent[]) || []);
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!effectiveUserId || events.length === 0) return;
    setGenerating(true);
    try {
      const selectedRide = rides.find(r => r.id === selectedRideId);
      const scope = selectedRideId === 'all' ? 'all' as const : 'single' as const;

      const { blob, documentId, fileName } = await generateTimelineReportPdf({
        events,
        startDate,
        endDate,
        scope,
        rideName: selectedRide?.ride_name,
        rideId: selectedRide?.id,
        rideCode: selectedRide?.ride_code,
        filters,
        userId: effectiveUserId,
      });

      // Save to Documents callback (not auto)
      const saveToDocuments = async (): Promise<string | void> => {
        const resultId = await storeTimelineReportPdf(blob, fileName, documentId, {
          rideId: selectedRide?.id,
          rideName: selectedRide?.ride_name,
          userId: effectiveUserId,
          startDate,
          endDate,
          scope,
        });
        return resultId || undefined;
      };

      setExportResult({ blob, fileName, onSaveToDocuments: saveToDocuments });
      setExportDialogOpen(true);
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast({ title: 'Failed to generate report', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Count per type
  const typeCounts: Record<string, number> = {};
  events.forEach(e => { typeCounts[e.event_type] = (typeCounts[e.event_type] || 0) + 1; });

  const isRideScoped = !!preFilterRideId;

  return (
    <div className="space-y-6 pb-24">
      {!isRideScoped && (
        <PageHeader
          title="Reports"
          subtitle="Generate timeline reports across all activities"
          icon={<FileText className="h-5 w-5" />}
        />
      )}

      {/* Filters Card */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Report Filters
          </CardTitle>
          <CardDescription>Select a date range and categories to include</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Start Date</Label>
              <Popover open={startCalOpen} onOpenChange={setStartCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'dd MMM yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(d) => { if (d) setStartDate(d); setStartCalOpen(false); }} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">End Date</Label>
              <Popover open={endCalOpen} onOpenChange={setEndCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'dd MMM yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={(d) => { if (d) setEndDate(d); setEndCalOpen(false); }} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Ride Selector - only when not pre-filtered */}
          {!isRideScoped && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Scope</Label>
              <Select value={selectedRideId} onValueChange={setSelectedRideId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Rides" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rides</SelectItem>
                  {rides.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.ride_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category Toggles */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Include</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {([
                { key: 'checks' as const, label: 'Operational Checks', icon: CheckSquare },
                { key: 'defects' as const, label: 'Defects', icon: AlertTriangle },
                { key: 'maintenance' as const, label: 'Maintenance', icon: Wrench },
                { key: 'compliance' as const, label: 'Compliance', icon: Shield },
                { key: 'amendments' as const, label: 'Amendments', icon: GitBranch },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => toggleFilter(key)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all",
                    filters[key]
                      ? "bg-primary/5 border-primary/30 text-primary"
                      : "bg-muted/30 border-border text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Badges */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(typeCounts).map(([type, count]) => {
          const cfg = EVENT_TYPE_CONFIG[type];
          if (!cfg) return null;
          return (
            <Badge key={type} variant="outline" className={cn("gap-1.5 py-1 px-2.5", cfg.bgColor, cfg.borderColor, cfg.color)}>
              <cfg.icon className="h-3.5 w-3.5" />
              {cfg.label}: {count}
            </Badge>
          );
        })}
        {events.length > 0 && (
          <Badge variant="outline" className="gap-1.5 py-1 px-2.5">
            <Clock className="h-3.5 w-3.5" />
            Total: {events.length}
          </Badge>
        )}
      </div>

      {/* Generate PDF Button */}
      <Button
        onClick={handleGeneratePdf}
        disabled={generating || events.length === 0}
        className="w-full sm:w-auto gap-2"
        size="lg"
      >
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        {generating ? 'Generating…' : 'Generate PDF Report'}
      </Button>

      {/* Timeline Events List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Clock className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No events found</p>
              <p className="text-xs text-muted-foreground mt-1">Adjust your date range or filters</p>
            </CardContent>
          </Card>
        ) : (
          events.map((event) => {
            const cfg = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.CHECK;
            const Icon = cfg.icon;
            return (
              <div
                key={`${event.event_type}-${event.reference_id}`}
                className={cn("flex items-start gap-3 p-3.5 rounded-xl border transition-colors hover:bg-muted/30", cfg.borderColor)}
              >
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", cfg.bgColor)}>
                  <Icon className={cn("h-4 w-4", cfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.description}</p>
                    </div>
                    <Badge variant="outline" className={cn("shrink-0 text-[10px] font-bold", cfg.bgColor, cfg.borderColor, cfg.color)}>
                      {event.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <span>{event.event_datetime ? format(new Date(event.event_datetime), 'dd MMM yyyy HH:mm') : '—'}</span>
                    {selectedRideId === 'all' && event.ride_name && (
                      <>
                        <span>·</span>
                        <span className="truncate">{event.ride_name}</span>
                      </>
                    )}
                    {event.created_by_name && (
                      <>
                        <span>·</span>
                        <span className="truncate">{event.created_by_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ExportActionsDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} result={exportResult} />
    </div>
  );
}
