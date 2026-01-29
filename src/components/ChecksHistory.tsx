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
  Cloud
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, subDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { EmptyState } from '@/components/EmptyState';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
  const itemsPerPage = 20;

  useEffect(() => {
    if (user) {
      loadChecks();
    }
  }, [user, rideId, dateRange, customStartDate, customEndDate]);

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
        .eq('user_id', user?.id)
        .eq('ride_id', rideId)
        .eq('check_frequency', frequency)
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
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;

    // Fetch profile for company branding
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user?.id)
      .single();

    // Fetch company logo if available
    let logoDataUrl: string | null = null;
    if (profile?.company_logo_path) {
      try {
        const { data: logoBlob } = await supabase.storage
          .from('ride-documents')
          .download(profile.company_logo_path);
        if (logoBlob) {
          logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(logoBlob);
          });
        }
      } catch (e) {
        console.log('Could not load company logo');
      }
    }

    // Fetch ride image if available
    const { data: rideImageDoc } = await supabase
      .from('documents')
      .select('file_path')
      .eq('ride_id', rideId)
      .like('mime_type', 'image/%')
      .limit(1)
      .maybeSingle();

    let rideImageDataUrl: string | null = null;
    let imageW = 40, imageH = 30;
    if (rideImageDoc) {
      try {
        const { data: imageBlob } = await supabase.storage
          .from('ride-documents')
          .download(rideImageDoc.file_path);
        if (imageBlob) {
          rideImageDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(imageBlob);
          });
          
          // Calculate aspect-ratio-preserving dimensions
          const img = new Image();
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = rideImageDataUrl!;
          });
          
          if (img.naturalWidth && img.naturalHeight) {
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            const maxW = 40, maxH = 30;
            if (aspectRatio > maxW / maxH) {
              imageW = maxW;
              imageH = maxW / aspectRatio;
            } else {
              imageH = maxH;
              imageW = maxH * aspectRatio;
            }
          }
        }
      } catch (e) {
        console.log('Could not load ride image');
      }
    }

    // Helper function to add footer
    const addFooter = (pageNum: number, totalPages: number) => {
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text('tarmacbuddy.com', pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
      doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, pageHeight - 10, { align: 'left' });
      doc.setTextColor(0);
    };

    let currentY = margin;

    // === HEADER SECTION ===
    // Logo on left, company info centered
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'AUTO', margin, currentY - 5, 18, 18);
      } catch (e) {
        console.log('Could not add logo to PDF');
      }
    }

    // Company name - always centered on page
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    const companyName = profile?.company_name || profile?.showmen_name || 'Safety Checks Report';
    doc.text(companyName, pageWidth / 2, currentY, { align: 'center' });
    currentY += 6;

    // Controller name below company
    if (profile?.controller_name) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Controller: ${profile.controller_name}`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 5;
    }

    currentY += 8;

    // Report title with underline
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    const frequencyLabel = frequency === 'daily' ? 'DAILY' : frequency === 'monthly' ? 'MONTHLY' : frequency === 'yearly' ? 'YEARLY' : frequency.toUpperCase();
    doc.text(`${frequencyLabel} SAFETY CHECKS REPORT`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 6;

    // Date range
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(`Period: ${getDateRange().startDate} to ${getDateRange().endDate}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;

    // Divider line
    doc.setDrawColor(180);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 10;

    // === EQUIPMENT DETAILS SECTION WITH IMAGE ===
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Equipment Details', margin, currentY);
    currentY += 8;

    const imageX = pageWidth - margin - imageW;
    const imageY = currentY;
    const labelWidth = 32;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Name:', margin, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(rideName, margin + labelWidth, currentY);
    currentY += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Total Checks:', margin, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${filteredChecks.length}`, margin + labelWidth, currentY);
    currentY += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Pass Rate:', margin, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${overallStats.passRate}%`, margin + labelWidth, currentY);
    currentY += 6;

    // Add ride image on the right side if available - with proper aspect ratio
    if (rideImageDataUrl) {
      try {
        doc.setDrawColor(200);
        doc.setLineWidth(0.5);
        doc.rect(imageX - 1, imageY - 1, imageW + 2, imageH + 2);
        doc.addImage(rideImageDataUrl, 'JPEG', imageX, imageY, imageW, imageH);
        currentY = Math.max(currentY, imageY + imageH + 5);
      } catch (e) {
        console.log('Could not add ride image to PDF');
      }
    }

    currentY += 5;
    doc.setDrawColor(200);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 10;

    // Summary stats
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', margin, currentY);
    currentY += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 139, 34);
    doc.text(`✓ Passed: ${overallStats.passed}`, margin, currentY);
    doc.setTextColor(220, 53, 69);
    doc.text(`✗ Failed: ${overallStats.failed}`, margin + 50, currentY);
    doc.setTextColor(180, 130, 50);
    doc.text(`◐ Partial: ${overallStats.partial}`, margin + 100, currentY);
    doc.setTextColor(0);
    currentY += 10;


    // Each check on its own page
    for (let i = 0; i < filteredChecks.length; i++) {
      const check = filteredChecks[i];
      doc.addPage();
      
      let currentY = margin;
      
      // Header
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Safety Check - ${format(parseISO(check.check_date), 'd MMM yyyy')}`, margin, currentY);
      currentY += 10;
      
      doc.setDrawColor(180);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 10;
      
      // Details
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const details = [
        ['Date:', format(parseISO(check.check_date), 'd MMM yyyy')],
        ['Checked By:', check.inspector_name],
        ['Frequency:', check.check_frequency],
        ['Status:', check.status.toUpperCase()],
      ];
      
      if ((check as any).weather_conditions) {
        details.push(['Weather:', (check as any).weather_conditions]);
      }
      if ((check as any).location) {
        details.push(['Location:', (check as any).location]);
      }
      if (check.notes) {
        details.push(['Notes:', check.notes]);
      }
      
      details.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, margin, currentY);
        doc.setFont('helvetica', 'normal');
        const valueText = doc.splitTextToSize(value, pageWidth - margin - 50);
        doc.text(valueText, margin + 35, currentY);
        currentY += Math.max(valueText.length * 5, 7);
      });
      
      currentY += 5;
      
      // Check results if available
      if (check.check_results && check.check_results.length > 0) {
        doc.setDrawColor(200);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 8;
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Check Items', margin, currentY);
        currentY += 8;
        
        const passed = check.check_results.filter(r => r.result === 'pass' || (r.result === null && r.is_checked)).length;
        const failed = check.check_results.filter(r => r.result === 'fail').length;
        const total = check.check_results.length;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`${passed} pass, ${failed} fail, ${total - passed - failed} N/A`, margin, currentY);
        currentY += 8;
        
        // Status indicator
        if (failed === 0 && passed === total) {
          doc.setTextColor(34, 139, 34);
          doc.text('✓ ALL CHECKS PASSED', margin, currentY);
        } else if (failed > 0) {
          doc.setTextColor(220, 53, 69);
          doc.text(`✗ ${failed} ITEM(S) FAILED`, margin, currentY);
        } else {
          doc.setTextColor(100);
          doc.text(`${passed} of ${total} items checked`, margin, currentY);
        }
        doc.setTextColor(0);
      }
    }

    // Add footers to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addFooter(i, totalPages);
    }

    doc.save(`checks-report-${rideName}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);

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
            <div className="text-xs text-muted-foreground">Total Checks</div>
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
                  <SelectItem value="daily">Daily</SelectItem>
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
                      <div key={check.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          {getStatusIcon(check.status)}
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{format(parseISO(check.check_date), 'PP')}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {check.check_frequency}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{check.inspector_name}</span>
                              {(check as any).weather_conditions && (
                                <>
                                  <span>•</span>
                                  <Cloud className="h-3 w-3" />
                                  <span>{(check as any).weather_conditions}</span>
                                </>
                              )}
                              {(check as any).location && (
                                <>
                                  <span>•</span>
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate max-w-[200px]">{(check as any).location}</span>
                                </>
                              )}
                            </div>
                            {check.notes && (
                              <p className="text-xs text-muted-foreground italic mt-1">
                                {check.notes.substring(0, 80)}{check.notes.length > 80 ? '...' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                        {getStatusBadge(check.status)}
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
    </div>
  );
};

export default ChecksHistory;
