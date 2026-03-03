import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Eye,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  Edit3,
  History,
  Clock,
  Lock,
  Save,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  X,
  FileDown,
  Table2,
  Camera,
  StickyNote,
} from 'lucide-react';
import { format, parseISO, subDays, startOfMonth, endOfMonth, startOfYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useAppRole } from '@/hooks/useAppRole';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { EmptyState } from '@/components/EmptyState';
import { InspectionAmendDialog } from './InspectionAmendDialog';
import {
  fetchInspectionRecordsPaginated,
  isWithinAmendmentWindow,
  type InspectionRecord,
  type FetchRecordsFilters,
} from '@/utils/inspectionRecordService';
import { generateInspectionRecordPdf } from '@/utils/inspectionRecordPdf';
import { generateCheckRecordsPdf, generateCheckRecordsCsv } from '@/utils/checkRecordsReport';
import { useAuth } from '@/contexts/AuthContext';
import { format as formatDateFns } from 'date-fns';

const PAGE_SIZE = 25;

interface InspectionRecordListProps {
  rideId: string;
  rideName: string;
  frequency?: string;
  rideCategory?: string;
  rideManufacturer?: string;
  rideSerialNumber?: string;
}

const DATE_PRESETS = [
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
  { label: 'This month', value: 'month' },
  { label: 'This year', value: 'year' },
] as const;

const InspectionRecordList = ({ rideId, rideName, frequency = 'daily', rideCategory, rideManufacturer, rideSerialNumber }: InspectionRecordListProps) => {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const role = useAppRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [amendRecord, setAmendRecord] = useState<InspectionRecord | null>(null);
  const [savingDocId, setSavingDocId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [defectsFilter, setDefectsFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [fromCalOpen, setFromCalOpen] = useState(false);
  const [toCalOpen, setToCalOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const filters: FetchRecordsFilters = useMemo(() => ({
    frequency,
    limit: PAGE_SIZE,
    dateFrom: dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
    dateTo: dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined,
    result: resultFilter !== 'all' ? resultFilter : undefined,
    hasDefects: defectsFilter === 'yes' ? true : defectsFilter === 'no' ? false : undefined,
    searchQuery: searchQuery || undefined,
  }), [frequency, dateFrom, dateTo, resultFilter, defectsFilter, searchQuery]);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['inspection-records', rideId, filters],
    queryFn: async ({ pageParam = 0 }) => {
      return fetchInspectionRecordsPaginated(rideId, {
        ...filters,
        offset: pageParam,
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.records.length, 0);
      return lastPage.hasMore ? loaded : undefined;
    },
    initialPageParam: 0,
    enabled: !!effectiveUserId,
  });

  const records = useMemo(
    () => data?.pages.flatMap(p => p.records) || [],
    [data]
  );
  const totalCount = data?.pages[0]?.totalCount || 0;

  const hasActiveFilters = !!(dateFrom || dateTo || resultFilter !== 'all' || defectsFilter !== 'all' || searchQuery);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setResultFilter('all');
    setDefectsFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setActivePreset(null);
  }, []);

  // ── Export handlers ──
  const handleExportPdf = async () => {
    if (!user?.id || !effectiveUserId || records.length === 0) return;
    setExporting('pdf');
    try {
      const { fetchInspectionRecords } = await import('@/utils/inspectionRecordService');
      const allRecords = await fetchInspectionRecords(rideId, {
        ...filters,
        limit: 5000,
        offset: 0,
      });

      const periodLabel = dateFrom && dateTo
        ? `${format(dateFrom, 'dd MMM yyyy')} – ${format(dateTo, 'dd MMM yyyy')}`
        : dateFrom
          ? `From ${format(dateFrom, 'dd MMM yyyy')}`
          : dateTo
            ? `To ${format(dateTo, 'dd MMM yyyy')}`
            : 'All records';

      const { blob, fileName } = await generateCheckRecordsPdf({
        rideId,
        rideName,
        userId: user.id,
        effectiveUserId,
        filters,
        records: allRecords,
        periodLabel,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Report exported', description: `Check Records report with ${allRecords.length} records exported as PDF.` });
    } catch (err: any) {
      console.error('PDF export failed:', err);
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  const handleExportCsv = async () => {
    if (records.length === 0) return;
    setExporting('csv');
    try {
      const { fetchInspectionRecords } = await import('@/utils/inspectionRecordService');
      const allRecords = await fetchInspectionRecords(rideId, {
        ...filters,
        limit: 5000,
        offset: 0,
      });

      const { blob, fileName } = generateCheckRecordsCsv(allRecords, rideName);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Export complete', description: `${allRecords.length} check records exported as CSV.` });
    } catch (err: any) {
      console.error('CSV export failed:', err);
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  const applyDatePreset = useCallback((preset: string) => {
    const now = new Date();
    setActivePreset(preset);
    switch (preset) {
      case '7': setDateFrom(subDays(now, 7)); setDateTo(now); break;
      case '30': setDateFrom(subDays(now, 30)); setDateTo(now); break;
      case '90': setDateFrom(subDays(now, 90)); setDateTo(now); break;
      case 'month': setDateFrom(startOfMonth(now)); setDateTo(endOfMonth(now)); break;
      case 'year': setDateFrom(startOfYear(now)); setDateTo(now); break;
    }
  }, []);

  const handleDownloadPdf = async (record: InspectionRecord) => {
    if (!record.pdf_file_path) {
      toast({ title: 'No PDF available', description: 'PDF has not been generated for this record.', variant: 'destructive' });
      return;
    }
    try {
      const { data, error } = await supabase.storage.from('ride-documents').download(record.pdf_file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Check-Record-v${record.version}-${format(parseISO(record.check_date), 'yyyy-MM-dd')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({ title: 'Download failed', description: 'Could not download the PDF.', variant: 'destructive' });
    }
  };

  const handleViewRecord = (record: InspectionRecord) => {
    navigate(`/inspection-record/${record.id}`);
  };

  const handleSaveToDocuments = async (record: InspectionRecord) => {
    if (!effectiveUserId) return;
    setSavingDocId(record.id);
    try {
      let filePath = record.pdf_file_path;
      if (!filePath) {
        const result = await generateInspectionRecordPdf({ record, rideName, rideCategory, rideManufacturer, rideSerialNumber, effectiveUserId });
        if (!result) throw new Error('PDF generation failed');
        filePath = result.filePath;
      }
      const { data: existing } = await supabase.from('documents').select('id').eq('ride_id', rideId).eq('file_path', filePath).maybeSingle();
      if (existing) {
        toast({ title: 'Already saved', description: 'This record is already in the ride documents.' });
        return;
      }
      const freqLabel = record.check_frequency === 'preopening' ? 'Pre-Opening' : record.check_frequency.charAt(0).toUpperCase() + record.check_frequency.slice(1);
      const dateStr = formatDateFns(parseISO(record.check_date), 'dd MMM yyyy');
      await supabase.from('documents').insert({
        user_id: effectiveUserId,
        ride_id: rideId,
        document_name: `${freqLabel} Check Record – ${rideName} – ${dateStr}`,
        document_type: 'inspection_record',
        file_path: filePath,
        mime_type: 'application/pdf',
        notes: `Checked by: ${record.inspector_name} | v${record.version}`,
      });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Saved to documents', description: 'Check record saved to this ride\'s document area.' });
    } catch (err: any) {
      console.error('Save to documents failed:', err);
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSavingDocId(null);
    }
  };

  const getResultBadge = (result: string, record?: InspectionRecord) => {
    const hasCriticalDefects = record && (record.defect_ids?.length || 0) > 0 && result === 'failed';
    if (hasCriticalDefects) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold border bg-destructive/10 border-destructive/30 text-destructive">
          <AlertTriangle className="h-2.5 w-2.5" />
          Failed — Defect
        </span>
      );
    }
    switch (result) {
      case 'passed':
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold border bg-success/10 border-success/30 text-success">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Passed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold border bg-destructive/10 border-destructive/30 text-destructive">
            <XCircle className="h-2.5 w-2.5" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold border bg-warning/10 border-warning/30 text-warning">
            <MinusCircle className="h-2.5 w-2.5" />
            Partial
          </span>
        );
    }
  };

  const isController = role === 'controller';

  // Build scope description
  const scopeLabel = useMemo(() => {
    if (dateFrom && dateTo) return `${format(dateFrom, 'd MMM yyyy')} – ${format(dateTo, 'd MMM yyyy')}`;
    if (dateFrom) return `from ${format(dateFrom, 'd MMM yyyy')}`;
    if (dateTo) return `up to ${format(dateTo!, 'd MMM yyyy')}`;
    return null;
  }, [dateFrom, dateTo]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground tracking-wide">
            Check Records
          </span>
          {totalCount > 0 && (
            <span className="text-[10px] font-medium text-muted-foreground">({totalCount})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Clear all
            </button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-[11px] gap-1",
              hasActiveFilters && "text-primary font-semibold"
            )}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <Filter className="h-3 w-3" />
            {hasActiveFilters ? 'Filters applied' : 'Filters'}
            {filtersOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* ── Filter panel ── */}
      {filtersOpen && (
        <div className="space-y-1.5 pb-1">
          {/* Quick range pills */}
          <div className="flex flex-wrap gap-1">
            {DATE_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => applyDatePreset(p.value)}
                className={cn(
                  "h-6 px-2.5 rounded-md text-[10px] font-semibold border transition-all",
                  activePreset === p.value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* From / To + Result + Defects in a tight grid */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <Popover open={fromCalOpen} onOpenChange={setFromCalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal h-7 text-[11px]", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3 shrink-0" />
                  {dateFrom ? format(dateFrom, "dd MMM yy") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setFromCalOpen(false); setActivePreset(null); }} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <Popover open={toCalOpen} onOpenChange={setToCalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal h-7 text-[11px]", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3 shrink-0" />
                  {dateTo ? format(dateTo, "dd MMM yy") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setToCalOpen(false); setActivePreset(null); }} disabled={(d) => dateFrom ? d < dateFrom : false} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Result" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All results</SelectItem>
                <SelectItem value="passed" className="text-xs">Passed</SelectItem>
                <SelectItem value="failed" className="text-xs">Failed</SelectItem>
                <SelectItem value="partial" className="text-xs">Partial</SelectItem>
              </SelectContent>
            </Select>

            <Select value={defectsFilter} onValueChange={setDefectsFilter}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Defects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Any</SelectItem>
                <SelectItem value="yes" className="text-xs">With defects</SelectItem>
                <SelectItem value="no" className="text-xs">No defects</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Search by name, notes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 text-[11px] pl-7"
            />
          </div>
        </div>
      )}

      {/* ── Summary + export toolbar ── */}
      {records.length > 0 && (
        <div className="flex flex-col gap-1 py-1.5">
          <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Showing <span className="font-semibold text-foreground">{totalCount}</span> record{totalCount !== 1 ? 's' : ''}
              {scopeLabel && <span className="font-medium text-foreground"> for {scopeLabel}</span>}
              {hasActiveFilters && <span> · filters applied</span>}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportPdf}
                disabled={!!exporting}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background text-[11px] font-medium text-foreground hover:bg-muted/60 active:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {exporting === 'pdf' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3 text-muted-foreground" />}
                Export PDF ({totalCount})
              </button>
              <button
                onClick={handleExportCsv}
                disabled={!!exporting}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background text-[11px] font-medium text-foreground hover:bg-muted/60 active:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {exporting === 'csv' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Table2 className="h-3 w-3 text-muted-foreground" />}
                Export CSV ({totalCount})
              </button>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground">Exports include the current filters and date range</p>
        </div>
      )}

      {/* Empty state */}
      {records.length === 0 && !isLoading && (
        <EmptyState
          icon={FileText}
          title={hasActiveFilters ? "No matching records" : "No check records"}
          description={hasActiveFilters ? "Try adjusting your filters to find records." : "Records will appear here once checks are completed."}
          variant="compact"
        />
      )}

      {/* ── Compact record rows ── */}
      {records.length > 0 && (
        <div className="space-y-0.5">
          {records.map((record) => {
            const defectCount = record.defect_ids?.length || 0;
            const hasNotes = !!record.notes;
            const hasPhotos = (record.photo_paths?.length || 0) > 0;
            const canAmend = isController && isWithinAmendmentWindow(record) && !record.superseded_by_id;

            return (
              <div
                key={record.id}
                className="rounded-lg border border-border/70 bg-card px-3 py-2 flex items-center justify-between gap-2 min-w-0 cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors"
                onClick={() => handleViewRecord(record)}
              >
                {/* Left: date + name + badges */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                      {format(parseISO(record.completed_at), 'd MMM yy')}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                      {format(parseISO(record.completed_at), 'HH:mm')}
                    </span>
                    <span className="font-semibold text-xs text-foreground truncate">{record.inspector_name}</span>
                    {record.location && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">· {record.location}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {getResultBadge(record.overall_result, record)}
                    {record.template_name && (
                      <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">{record.template_name.replace(/\bSafety\s+Check\b/gi, 'Check')}</span>
                    )}
                    {record.version > 1 && (
                      <span className="text-[9px] font-semibold text-muted-foreground bg-muted px-1 py-0.5 rounded">v{record.version}</span>
                    )}
                    {defectCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-destructive">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {defectCount}
                      </span>
                    )}
                    {hasNotes && <StickyNote className="h-2.5 w-2.5 text-muted-foreground" />}
                    {hasPhotos && <Camera className="h-2.5 w-2.5 text-muted-foreground" />}
                    {record.superseded_by_id && (
                      <span className="text-[9px] text-muted-foreground italic line-through">Superseded</span>
                    )}
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownloadPdf(record)} disabled={!record.pdf_file_path} title="Download PDF">
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSaveToDocuments(record)} disabled={savingDocId === record.id} title="Save to documents">
                    {savingDocId === record.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  </Button>
                  {canAmend && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setAmendRecord(record)} title="Amend record">
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center pt-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1.5"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <><Loader2 className="h-3 w-3 animate-spin" />Loading…</>
            ) : (
              <>Load more records</>
            )}
          </Button>
        </div>
      )}

      {/* Record count footer */}
      {records.length > 0 && !hasNextPage && totalCount > PAGE_SIZE && (
        <p className="text-center text-[10px] text-muted-foreground pt-0.5">
          All {records.length} records loaded
        </p>
      )}

      {amendRecord && (
        <InspectionAmendDialog
          record={amendRecord}
          open={!!amendRecord}
          onOpenChange={(open) => { if (!open) setAmendRecord(null); }}
          onAmended={() => {
            queryClient.invalidateQueries({ queryKey: ['inspection-records'] });
            setAmendRecord(null);
          }}
        />
      )}
    </div>
  );
};

export default InspectionRecordList;
