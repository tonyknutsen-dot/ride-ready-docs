import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Calendar as CalendarIcon, 
  ChevronDown, 
  ChevronUp,
  Download, 
  Search, 
  Filter,
  User,
  FileText,
  TrendingUp,
  CheckCircle2,
  XCircle,
  MinusCircle,
  MapPin,
  Cloud,
  Eye
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, subDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { EmptyState } from '@/components/EmptyState';
import CheckDetailDialog from './CheckDetailDialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PDF_COLORS,
  generateDocId,
  buildFileName,
  blobToDataUrl,
  drawPDFHeader,
  drawSectionTitle,
  drawEquipmentDetails,
  drawSummaryBox,
  PDF_TABLE_HEAD_STYLES,
  PDF_TABLE_BODY_STYLES,
  PDF_TABLE_ALT_ROW,
  drawAllPageFooters,
  drawComplianceStatement,
} from '@/utils/pdfUtils';

type Check = Tables<'checks'>;

type CheckWithResults = Check & {
  check_results: Array<{
    is_checked: boolean;
    result: 'pass' | 'fail' | 'na' | null;
    template_item_id: string;
  }>;
};

interface ChecksHistoryProps {
  rideId: string;
  rideName: string;
  frequency?: string;
}

interface MonthGroup {
  month: string;
  checks: CheckWithResults[];
  passRate: number;
  totalChecks: number;
  passedChecks: number;
}

const ChecksHistory = ({ rideId, rideName, frequency = 'daily' }: ChecksHistoryProps) => {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const [checks, setChecks] = useState<CheckWithResults[]>([]);
  const [filteredChecks, setFilteredChecks] = useState<CheckWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | 'daily' | 'monthly' | 'yearly'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed' | 'partial'>('all');
  const [dateRange, setDateRange] = useState<'7' | '30' | '90' | 'thisMonth' | 'thisYear' | 'custom'>('30');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [startCalendarOpen, setStartCalendarOpen] = useState(false);
  const [endCalendarOpen, setEndCalendarOpen] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<CheckWithResults | null>(null);
  const [showCheckDetail, setShowCheckDetail] = useState(false);
  const itemsPerPage = 20;

  useEffect(() => {
    if (effectiveUserId) {
      loadChecks();
    }
  }, [effectiveUserId, rideId, dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    applyFilters();
  }, [checks, searchTerm, frequencyFilter, statusFilter]);

  const getDateRange = () => {
    const today = new Date();
    let startDate: Date;
    let endDate: Date = today;

    if (dateRange === 'custom' && customStartDate && customEndDate) {
      startDate = customStartDate;
      endDate = customEndDate;
    } else if (dateRange === 'thisMonth') {
      startDate = startOfMonth(today);
      endDate = endOfMonth(today);
    } else if (dateRange === 'thisYear') {
      startDate = startOfYear(today);
      endDate = today;
    } else {
      const days = parseInt(dateRange);
      startDate = subDays(today, days);
    }

    return { 
      startDate: format(startDate, 'yyyy-MM-dd'), 
      endDate: format(endDate, 'yyyy-MM-dd') 
    };
  };

  const loadChecks = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange();

      const { data, error } = await supabase
        .from('checks')
        .select(`
          *,
          check_results (
            is_checked,
            result,
            template_item_id
          )
        `)
        .eq('user_id', effectiveUserId)
        .eq('ride_id', rideId)
        .eq('check_frequency', frequency)
        .eq('is_test_data', false) // Exclude test data
        .gte('check_date', startDate)
        .lte('check_date', endDate)
        .order('check_date', { ascending: false });

      if (error) throw error;

      setChecks(data as CheckWithResults[] || []);
    } catch (error) {
      console.error('Error loading checks:', error);
      toast({
        title: "Error",
        description: "Failed to load checks history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...checks];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(check => 
        check.inspector_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (check.notes && check.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Frequency filter
    if (frequencyFilter !== 'all') {
      filtered = filtered.filter(check => check.check_frequency === frequencyFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(check => check.status === statusFilter);
    }

    setFilteredChecks(filtered);
    setCurrentPage(1);
  };

  const groupByMonth = (): MonthGroup[] => {
    const groups: { [key: string]: CheckWithResults[] } = {};

    filteredChecks.forEach(check => {
      const monthKey = format(parseISO(check.check_date), 'MMMM yyyy');
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(check);
    });

    return Object.entries(groups).map(([month, checks]) => {
      const passedChecks = checks.filter(c => c.status === 'passed').length;
      const totalChecks = checks.length;
      const passRate = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;

      return {
        month,
        checks,
        passRate: Math.round(passRate),
        totalChecks,
        passedChecks
      };
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'partial':
        return <MinusCircle className="h-4 w-4 text-warning" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'passed' ? 'default' : status === 'failed' ? 'destructive' : 'secondary';
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return <Badge variant={variant}>{label}</Badge>;
  };

  const exportToPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const docId = generateDocId('CHECK');

    // Fetch profile for company branding
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user?.id)
      .single();

    // Fetch company logo
    let logoDataUrl: string | null = null;
    if (profile?.company_logo_path) {
      try {
        const { data: logoBlob } = await supabase.storage
          .from('ride-documents')
          .download(profile.company_logo_path);
        if (logoBlob) logoDataUrl = await blobToDataUrl(logoBlob);
      } catch (_) { /* skip */ }
    }

    // Fetch ride image
    const { data: rideImageDoc } = await supabase
      .from('documents')
      .select('file_path')
      .eq('ride_id', rideId)
      .like('mime_type', 'image/%')
      .limit(1)
      .maybeSingle();

    let rideImageDataUrl: string | null = null;
    if (rideImageDoc) {
      try {
        const { data: imageBlob } = await supabase.storage
          .from('ride-documents')
          .download(rideImageDoc.file_path);
        if (imageBlob) rideImageDataUrl = await blobToDataUrl(imageBlob);
      } catch (_) { /* skip */ }
    }

    const { startDate, endDate } = getDateRange();
    const companyName = profile?.company_name || profile?.showmen_name || 'Safety Checks Report';
    const frequencyLabel = frequency === 'daily' ? 'DAILY' : frequency === 'monthly' ? 'MONTHLY' : frequency === 'yearly' ? 'YEARLY' : frequency.toUpperCase();

    // Standard header
    let currentY = drawPDFHeader({
      doc,
      logoDataUrl,
      companyName,
      controllerName: profile?.controller_name,
      reportTitle: `${frequencyLabel} SAFETY CHECKS`,
      period: `${startDate} – ${endDate}`,
      generatedDate: format(new Date(), 'dd MMM yyyy'),
      docId,
    });

    // Equipment details + image
    currentY = drawSectionTitle(doc, 'Equipment Details', currentY);
    currentY = await drawEquipmentDetails({
      doc,
      y: currentY,
      fields: [
        { label: 'Equipment', value: rideName },
        { label: 'Total Checks', value: String(filteredChecks.length) },
        { label: 'Pass Rate', value: `${overallStats.passRate}%` },
        { label: 'Period', value: `${startDate} – ${endDate}` },
      ],
      imageDataUrl: rideImageDataUrl,
    });

    // Summary metrics box
    currentY = drawSummaryBox(doc, [
      { label: 'Total Checks', value: String(overallStats.total) },
      { label: 'Passed', value: String(overallStats.passed), accent: true },
      { label: 'Failed', value: String(overallStats.failed) },
      { label: 'Pass Rate', value: `${overallStats.passRate}%`, accent: true },
    ], currentY);

    // Each check record
    for (const check of filteredChecks) {
      doc.addPage();
      let y = 20;

      y = drawSectionTitle(doc, `Safety Check — ${format(parseISO(check.check_date), 'd MMM yyyy')}`, y);

      // Details table
      autoTable(doc, {
        startY: y,
        body: [
          ['Date', format(parseISO(check.check_date), 'd MMM yyyy'), 'Inspector', check.inspector_name],
          ['Frequency', check.check_frequency, 'Status', check.status.toUpperCase()],
          ...(((check as any).weather_conditions || (check as any).location) ? [
            ['Weather', (check as any).weather_conditions || '-', 'Location', (check as any).location || '-'],
          ] : []),
        ],
        styles: { ...PDF_TABLE_BODY_STYLES },
        alternateRowStyles: PDF_TABLE_ALT_ROW,
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 }, 2: { fontStyle: 'bold', cellWidth: 32 } },
        margin: { left: 13, right: 13 },
      });

      y = (doc as any).lastAutoTable.finalY + 6;

      if (check.check_results && check.check_results.length > 0) {
        const passed = check.check_results.filter(r => r.result === 'pass' || (r.result === null && r.is_checked)).length;
        const failed = check.check_results.filter(r => r.result === 'fail').length;
        const total = check.check_results.length;

        y = drawSummaryBox(doc, [
          { label: 'Items Checked', value: String(total) },
          { label: 'Passed', value: String(passed), accent: true },
          { label: 'Failed', value: String(failed) },
          { label: 'Result', value: failed === 0 ? 'PASS' : 'FAIL', accent: failed === 0 },
        ], y);
      }

      if (check.notes) {
        y = drawSectionTitle(doc, 'Notes', y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...PDF_COLORS.body);
        const lines = doc.splitTextToSize(check.notes, pageWidth - 26);
        doc.text(lines, 13, y);
      }
    }

    drawAllPageFooters(doc, docId);
    doc.save(buildFileName([rideName, frequency, 'SafetyChecks', format(new Date(), 'yyyyMMdd')]));

    toast({
      title: "Export Complete",
      description: `Professional report with ${filteredChecks.length} checks exported`,
    });
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Frequency', 'Inspector', 'Status', 'Weather', 'Location', 'Notes'];
    const rows = filteredChecks.map(check => [
      format(parseISO(check.check_date), 'yyyy-MM-dd'),
      check.check_frequency,
      check.inspector_name,
      check.status,
      (check as any).weather_conditions || '',
      (check as any).location || '',
      check.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checks-history-${rideName}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Checks history exported to CSV",
    });
  };

  const monthGroups = groupByMonth();
  const totalPages = Math.ceil(filteredChecks.length / itemsPerPage);
  const paginatedChecks = filteredChecks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const overallStats = {
    total: filteredChecks.length,
    passed: filteredChecks.filter(c => c.status === 'passed').length,
    failed: filteredChecks.filter(c => c.status === 'failed').length,
    partial: filteredChecks.filter(c => c.status === 'partial').length,
    passRate: filteredChecks.length > 0 
      ? Math.round((filteredChecks.filter(c => c.status === 'passed').length / filteredChecks.length) * 100)
      : 0
  };

  if (loading) {
    return (
      <div className="checksWrap -mx-4 px-4 pt-4 pb-24 space-y-4">
        <div className="kpiGrid">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 animate-pulse h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="checksWrap -mx-4 px-4 pt-4 pb-32 space-y-4">

      {/* ── KPI cards ── */}
      <div className="kpiGrid">
        <KpiCard title={`${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Checks`} value={overallStats.total} tone="neutral" />
        <KpiCard title="Passed" value={overallStats.passed} tone="good" />
        <KpiCard title="Failed" value={overallStats.failed} tone="bad" />
        <KpiCard title="Partial" value={overallStats.partial} tone="warn" />
      </div>

      {/* Pass Rate full-width */}
      <div className="t-card p-4 flex items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <div className="text-xs font-bold text-muted-foreground">Pass Rate</div>
          <div className="text-3xl font-extrabold text-foreground">{overallStats.passRate}%</div>
        </div>
        <TrendingUp className="h-8 w-8 text-muted-foreground shrink-0" />
      </div>

      {/* ── Filters card ── */}
      <div className="t-card overflow-hidden">
        <div className="t-card-header flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="t-title text-base">Filters &amp; Search</div>
            <div className="text-xs text-muted-foreground mt-0.5">Refine your checks history view</div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={exportToPDF}
              className="rounded-xl border border-border px-3 py-2 text-xs font-bold bg-card hover:bg-muted/50 flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />PDF
            </button>
            <button
              type="button"
              onClick={exportToCSV}
              className="rounded-xl border border-border px-3 py-2 text-xs font-bold bg-card hover:bg-muted/50 flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />CSV
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Search */}
          <label className="block space-y-1">
            <div className="text-xs font-bold text-muted-foreground">Search</div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Inspector or notes…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <div className="text-xs font-bold text-muted-foreground">Frequency</div>
              <select
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={frequencyFilter}
                onChange={(e) => setFrequencyFilter(e.target.value as any)}
              >
                <option value="all">All Frequencies</option>
                <option value="preopening">Pre-Opening</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>

            <label className="block space-y-1">
              <div className="text-xs font-bold text-muted-foreground">Status</div>
              <select
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">All Statuses</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="partial">Partial</option>
              </select>
            </label>

            <label className="block space-y-1 col-span-2">
              <div className="text-xs font-bold text-muted-foreground">Date Range</div>
              <select
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="thisYear">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </label>
          </div>

          {/* Custom date pickers */}
          {dateRange === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-muted-foreground">Start Date</div>
                <Popover open={startCalendarOpen} onOpenChange={setStartCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm rounded-xl", !customStartDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "d MMM yyyy") : "Pick start"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                    <Calendar mode="single" selected={customStartDate} onSelect={(d) => { setCustomStartDate(d); setStartCalendarOpen(false); }} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold text-muted-foreground">End Date</div>
                <Popover open={endCalendarOpen} onOpenChange={setEndCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm rounded-xl", !customEndDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "d MMM yyyy") : "Pick end"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                    <Calendar mode="single" selected={customEndDate} onSelect={(d) => { setCustomEndDate(d); setEndCalendarOpen(false); }} initialFocus disabled={(d) => customStartDate ? d < customStartDate : false} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Month groups ── */}
      {monthGroups.length === 0 ? (
        <EmptyState icon={FileText} title="No checks found" description="No checks found for the selected filters" variant="compact" />
      ) : (
        monthGroups.map((group) => (
          <div key={group.month} className="t-card overflow-hidden">
            {/* Month header */}
            <div className="t-card-header flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="t-title text-base">{group.month}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {group.totalChecks} check{group.totalChecks !== 1 ? 's' : ''} · {group.passedChecks} passed · {group.passRate}% pass rate
                </div>
              </div>
              <span className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-extrabold border",
                group.passRate >= 80 ? 'bg-success/10 border-success/30 text-success' :
                group.passRate >= 50 ? 'bg-warning/10 border-warning/30 text-warning' :
                                       'bg-destructive/10 border-destructive/30 text-destructive'
              )}>
                {group.passRate}%
              </span>
            </div>

            {/* Check rows */}
            <div className="p-4 space-y-3">
              {group.checks.map((check) => (
                <div
                  key={check.id}
                  className="rounded-2xl border border-border bg-card p-3 flex items-start justify-between gap-3 min-w-0 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => { setSelectedCheck(check); setShowCheckDetail(true); }}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(check.check_date), 'd MMM yyyy')} · <span className="font-semibold capitalize">{check.check_frequency}</span>
                    </div>
                    <div className="font-extrabold text-foreground truncate">{check.inspector_name}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
                      {(check as any).weather_conditions && (
                        <span className="flex items-center gap-1">
                          <Cloud className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[120px]">{(check as any).weather_conditions}</span>
                        </span>
                      )}
                      {(check as any).location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[140px]">{(check as any).location}</span>
                        </span>
                      )}
                    </div>
                    {check.notes && (
                      <p className="text-xs text-muted-foreground italic line-clamp-1">{check.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-extrabold border",
                      check.status === 'passed'  ? 'bg-success/10 border-success/30 text-success' :
                      check.status === 'failed'  ? 'bg-destructive/10 border-destructive/30 text-destructive' :
                      check.status === 'partial' ? 'bg-warning/10 border-warning/30 text-warning' :
                                                   'bg-muted border-border text-muted-foreground'
                    )}>
                      {check.status.charAt(0).toUpperCase() + check.status.slice(1)}
                    </span>
                    <Eye className="h-4 w-4 text-muted-foreground hidden sm:block" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredChecks.length)} of {filteredChecks.length}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl border border-border px-4 py-2 text-sm font-bold bg-card hover:bg-muted/50 disabled:opacity-40"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >Previous</button>
            <button
              type="button"
              className="rounded-xl border border-border px-4 py-2 text-sm font-bold bg-card hover:bg-muted/50 disabled:opacity-40"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >Next</button>
          </div>
        </div>
      )}

      {/* ── Sticky export bar ── */}
      <div className="fixed left-0 right-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-xl mx-auto px-4 py-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={exportToPDF} className="rounded-xl border border-border py-3 text-sm font-extrabold bg-card hover:bg-muted/50 flex items-center justify-center gap-1.5">
            <Download className="h-4 w-4" />Export PDF
          </button>
          <button type="button" onClick={exportToCSV} className="t-btn-primary rounded-xl py-3 text-sm">
            <Download className="h-4 w-4" />Export CSV
          </button>
        </div>
      </div>

      <CheckDetailDialog check={selectedCheck} open={showCheckDetail} onOpenChange={setShowCheckDetail} />
    </div>
  );
};

// ── Local sub-components ──────────────────────────────────────────────

function KpiCard({ title, value, tone }: { title: string; value: number; tone: 'neutral' | 'good' | 'bad' | 'warn' }) {
  const cls =
    tone === 'good' ? 'border-success/30 bg-success/5' :
    tone === 'bad'  ? 'border-destructive/30 bg-destructive/5' :
    tone === 'warn' ? 'border-warning/30 bg-warning/5' :
                      'border-border bg-card';
  return (
    <div className={cn('kpiCard rounded-2xl border shadow-sm p-4', cls)}>
      <div className="text-xs font-bold text-muted-foreground truncate">{title}</div>
      <div className="mt-1 text-3xl font-extrabold text-foreground">{value}</div>
    </div>
  );
}

export default ChecksHistory;

