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
  MinusCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

type Check = Tables<'checks'>;

type CheckWithResults = Check & {
  check_results: Array<{
    is_checked: boolean;
    template_item_id: string;
  }>;
};

interface ChecksHistoryProps {
  rideId: string;
  rideName: string;
}

interface MonthGroup {
  month: string;
  checks: CheckWithResults[];
  passRate: number;
  totalChecks: number;
  passedChecks: number;
}

const ChecksHistory = ({ rideId, rideName }: ChecksHistoryProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [checks, setChecks] = useState<CheckWithResults[]>([]);
  const [filteredChecks, setFilteredChecks] = useState<CheckWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | 'daily' | 'monthly' | 'yearly'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed' | 'partial'>('all');
  const [dateRange, setDateRange] = useState<'7' | '30' | '90' | 'custom'>('30');
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
            template_item_id
          )
        `)
        .eq('user_id', user?.id)
        .eq('ride_id', rideId)
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

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text(`Checks History - ${rideName}`, 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 30);
    doc.text(`Period: ${getDateRange().startDate} to ${getDateRange().endDate}`, 14, 37);
    
    const tableData = filteredChecks.map(check => [
      format(parseISO(check.check_date), 'PP'),
      check.check_frequency,
      check.inspector_name,
      check.status,
      check.notes || '-'
    ]);

    (doc as any).autoTable({
      startY: 45,
      head: [['Date', 'Frequency', 'Inspector', 'Status', 'Notes']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`checks-history-${rideName}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);

    toast({
      title: "Export Complete",
      description: "Checks history exported to PDF",
    });
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Frequency', 'Inspector', 'Status', 'Notes'];
    const rows = filteredChecks.map(check => [
      format(parseISO(check.check_date), 'yyyy-MM-dd'),
      check.check_frequency,
      check.inspector_name,
      check.status,
      check.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
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
                      {customStartDate ? format(customStartDate, "PPP") : "Pick start date"}
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
                      {customEndDate ? format(customEndDate, "PPP") : "Pick end date"}
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
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No checks found for the selected filters</p>
            </CardContent>
          </Card>
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
                              {check.notes && (
                                <>
                                  <span>•</span>
                                  <span className="italic">{check.notes.substring(0, 50)}{check.notes.length > 50 ? '...' : ''}</span>
                                </>
                              )}
                            </div>
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
