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
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'partial':
        return <MinusCircle className="h-4 w-4 text-amber-600" />;
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
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading checks history...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-primary">{overallStats.total}</div>
            <div className="text-xs text-muted-foreground capitalize">{frequency} Checks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-green-600">{overallStats.passed}</div>
            <div className="text-xs text-muted-foreground">Passed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-destructive">{overallStats.failed}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-amber-600">{overallStats.partial}</div>
            <div className="text-xs text-muted-foreground">Partial</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div className="text-2xl font-bold">{overallStats.passRate}%</div>
            </div>
            <div className="text-xs text-muted-foreground">Pass Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters & Search
              </CardTitle>
              <CardDescription>Refine your checks history view</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToPDF}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Inspector or notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Frequency Filter */}
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequencyFilter} onValueChange={(value: any) => setFrequencyFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">All Frequencies</SelectItem>
                  <SelectItem value="preopening">Pre-Opening</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="thisYear">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Date Range */}
          {dateRange === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover open={startCalendarOpen} onOpenChange={setStartCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "d MMM yyyy") : "Pick start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={(date) => {
                        setCustomStartDate(date);
                        setStartCalendarOpen(false);
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover open={endCalendarOpen} onOpenChange={setEndCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "d MMM yyyy") : "Pick end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={(date) => {
                        setCustomEndDate(date);
                        setEndCalendarOpen(false);
                      }}
                      initialFocus
                      disabled={(date) => customStartDate ? date < customStartDate : false}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Groups */}
      <div className="space-y-4">
        {monthGroups.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No checks found"
            description="No checks found for the selected filters"
            variant="compact"
          />
        ) : (
          monthGroups.map((group) => (
            <Collapsible key={group.month} defaultOpen>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <CardTitle className="text-lg">{group.month}</CardTitle>
                          <CardDescription>
                            {group.totalChecks} checks • {group.passedChecks} passed • {group.passRate}% pass rate
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={group.passRate >= 80 ? 'default' : group.passRate >= 50 ? 'secondary' : 'destructive'}>
                        {group.passRate}%
                      </Badge>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-2">
                    {group.checks.map((check) => (
                      <div 
                        key={check.id} 
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedCheck(check);
                          setShowCheckDetail(true);
                        }}
                      >
                        <div className="shrink-0 mt-1">
                          {getStatusIcon(check.status)}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium text-sm">{format(parseISO(check.check_date), 'PP')}</span>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {check.check_frequency}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[120px] sm:max-w-none">{check.inspector_name}</span>
                            </div>
                            {(check as any).weather_conditions && (
                              <div className="flex items-center gap-1">
                                <Cloud className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-[80px] sm:max-w-none">{(check as any).weather_conditions}</span>
                              </div>
                            )}
                            {(check as any).location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-[100px] sm:max-w-[200px]">{(check as any).location}</span>
                              </div>
                            )}
                          </div>
                          {check.notes && (
                            <p className="text-xs text-muted-foreground italic line-clamp-2">
                              {check.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {getStatusBadge(check.status)}
                          <Eye className="h-4 w-4 text-muted-foreground hidden sm:block" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredChecks.length)} of {filteredChecks.length} checks
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Check Detail Dialog */}
      <CheckDetailDialog
        check={selectedCheck}
        open={showCheckDetail}
        onOpenChange={setShowCheckDetail}
      />
    </div>
  );
};

export default ChecksHistory;
