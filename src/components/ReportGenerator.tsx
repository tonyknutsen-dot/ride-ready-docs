import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  FileText,
  Download,
  Calendar as CalendarIcon,
  Filter,
  BarChart3,
  Printer,
  Mail,
  CheckCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format as formatDate, startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface ReportData {
  totalInspections: number;
  completedInspections: number;
  overdueInspections: number;
  maintenanceRecords: number;
  totalCost: number;
  complianceRate: number;
  rideBreakdown: { [key: string]: number };
}

interface ReportFilters {
  reportType: 'compliance' | 'maintenance' | 'inspection' | 'comprehensive';
  dateRange: 'month' | 'quarter' | 'year' | 'custom';
  startDate?: Date;
  endDate?: Date;
  includeRides: string[];
  includeCharts: boolean;
  includeDetails: boolean;
}

const ReportGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>({
    reportType: 'compliance',
    dateRange: 'month',
    includeRides: [],
    includeCharts: true,
    includeDetails: true,
  });

  useEffect(() => {
    if (user) {
      loadRides();
    }
  }, [user]);

  useEffect(() => {
    if (user && rides.length > 0) {
      // Auto-select all rides by default
      setFilters(prev => ({
        ...prev,
        includeRides: rides.map(r => r.id)
      }));
    }
  }, [rides, user]);

  const loadRides = async () => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('id, ride_name')
        .eq('user_id', user?.id)
        .order('ride_name');

      if (error) throw error;
      setRides(data || []);
    } catch (error) {
      console.error('Error loading rides:', error);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    
    switch (filters.dateRange) {
      case 'month':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
      case 'quarter':
        return {
          start: startOfMonth(subMonths(now, 2)),
          end: endOfMonth(now)
        };
      case 'year':
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: new Date(now.getFullYear(), 11, 31)
        };
      case 'custom':
        return {
          start: filters.startDate || startOfMonth(now),
          end: filters.endDate || endOfMonth(now)
        };
      default:
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
    }
  };

  const generateReport = async () => {
    if (filters.includeRides.length === 0) {
      toast({
        title: "No rides selected",
        description: "Please select at least one ride for the report",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const { start, end } = getDateRange();
      const startDate = formatDate(start, 'yyyy-MM-dd');
      const endDate = formatDate(end, 'yyyy-MM-dd');

      // Load inspection data
      const { data: inspections, error: inspectionsError } = await supabase
        .from('inspection_checks')
        .select(`
          id,
          status,
          check_date,
          ride_id,
          rides(ride_name)
        `)
        .eq('user_id', user?.id)
        .in('ride_id', filters.includeRides)
        .gte('check_date', startDate)
        .lte('check_date', endDate);

      if (inspectionsError) throw inspectionsError;

      // Load maintenance data
      const { data: maintenance, error: maintenanceError } = await supabase
        .from('maintenance_records')
        .select(`
          id,
          cost,
          maintenance_date,
          ride_id,
          rides(ride_name)
        `)
        .eq('user_id', user?.id)
        .in('ride_id', filters.includeRides)
        .gte('maintenance_date', startDate)
        .lte('maintenance_date', endDate);

      if (maintenanceError) throw maintenanceError;

      // Calculate report data
      const totalInspections = inspections?.length || 0;
      const completedInspections = inspections?.filter(i => i.status === 'completed').length || 0;
      const overdueInspections = inspections?.filter(i => 
        i.status === 'pending' && i.check_date < formatDate(new Date(), 'yyyy-MM-dd')
      ).length || 0;
      const maintenanceRecords = maintenance?.length || 0;
      const totalCost = maintenance?.reduce((sum, m) => sum + (m.cost || 0), 0) || 0;
      const complianceRate = totalInspections > 0 ? (completedInspections / totalInspections) * 100 : 0;

      // Ride breakdown
      const rideBreakdown: { [key: string]: number } = {};
      inspections?.forEach(inspection => {
        const rideName = (inspection.rides as any)?.ride_name || 'Unknown';
        rideBreakdown[rideName] = (rideBreakdown[rideName] || 0) + 1;
      });

      const data: ReportData = {
        totalInspections,
        completedInspections,
        overdueInspections,
        maintenanceRecords,
        totalCost,
        complianceRate,
        rideBreakdown,
      };

      setReportData(data);
      
      toast({
        title: "Report generated",
        description: "Your compliance report has been generated successfully",
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error generating report",
        description: "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const exportReport = async (format: 'pdf' | 'csv') => {
    if (!reportData) return;

    // For now, we'll create a simple text export
    // In a real application, you'd use libraries like jsPDF or Papa Parse
    const { start, end } = getDateRange();
    
    const reportContent = `
RIDE SAFETY COMPLIANCE REPORT
Generated: ${formatDate(new Date(), 'PPP')}
Period: ${formatDate(start, 'PPP')} to ${formatDate(end, 'PPP')}
Report Type: ${filters.reportType.charAt(0).toUpperCase() + filters.reportType.slice(1)}

SUMMARY STATISTICS
==================
Total Inspections: ${reportData.totalInspections}
Completed Inspections: ${reportData.completedInspections}
Overdue Inspections: ${reportData.overdueInspections}
Maintenance Records: ${reportData.maintenanceRecords}
Total Maintenance Cost: $${reportData.totalCost.toFixed(2)}
Compliance Rate: ${reportData.complianceRate.toFixed(1)}%

RIDE BREAKDOWN
==============
${Object.entries(reportData.rideBreakdown)
  .map(([ride, count]) => `${ride}: ${count} inspections`)
  .join('\n')}

Generated by Ride Ready Docs
    `.trim();

    // Create and download file
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${formatDate(new Date(), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Report exported",
      description: `Report has been downloaded as ${format.toUpperCase()}`,
    });
  };

  const getComplianceStatus = (rate: number) => {
    if (rate >= 90) return { color: 'text-emerald-600', icon: CheckCircle, label: 'Excellent' };
    if (rate >= 75) return { color: 'text-blue-600', icon: Clock, label: 'Good' };
    if (rate >= 50) return { color: 'text-amber-600', icon: AlertTriangle, label: 'Needs Attention' };
    return { color: 'text-destructive', icon: AlertTriangle, label: 'Critical' };
  };

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Report Generator
          </CardTitle>
          <CardDescription>
            Generate compliance and maintenance reports for your rides
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Report Configuration */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Report Type</label>
                <Select value={filters.reportType} onValueChange={(value: any) => setFilters(prev => ({ ...prev, reportType: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compliance">Compliance Report</SelectItem>
                    <SelectItem value="maintenance">Maintenance Report</SelectItem>
                    <SelectItem value="inspection">Inspection Summary</SelectItem>
                    <SelectItem value="comprehensive">Comprehensive Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <Select value={filters.dateRange} onValueChange={(value: any) => setFilters(prev => ({ ...prev, dateRange: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="quarter">Last 3 Months</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filters.dateRange === 'custom' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.startDate ? formatDate(filters.startDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={filters.startDate}
                          onSelect={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.endDate ? formatDate(filters.endDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={filters.endDate}
                          onSelect={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}
            </div>

            {/* Ride Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Include Rides</label>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {rides.map((ride) => (
                  <div key={ride.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={ride.id}
                      checked={filters.includeRides.includes(ride.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilters(prev => ({
                            ...prev,
                            includeRides: [...prev.includeRides, ride.id]
                          }));
                        } else {
                          setFilters(prev => ({
                            ...prev,
                            includeRides: prev.includeRides.filter(id => id !== ride.id)
                          }));
                        }
                      }}
                    />
                    <label htmlFor={ride.id} className="text-sm">{ride.ride_name}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* Report Options */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Report Options</label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-charts"
                    checked={filters.includeCharts}
                    onCheckedChange={(checked) => setFilters(prev => ({ ...prev, includeCharts: !!checked }))}
                  />
                  <label htmlFor="include-charts" className="text-sm">Include Charts</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-details"
                    checked={filters.includeDetails}
                    onCheckedChange={(checked) => setFilters(prev => ({ ...prev, includeDetails: !!checked }))}
                  />
                  <label htmlFor="include-details" className="text-sm">Include Detailed Data</label>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex justify-start">
              <Button onClick={generateReport} disabled={generating || filters.includeRides.length === 0}>
                {generating ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Results */}
      {reportData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
                  {(() => {
                    const { icon: Icon, color } = getComplianceStatus(reportData.complianceRate);
                    return <Icon className={cn("h-4 w-4", color)} />;
                  })()}
                </div>
                <div className="text-2xl font-bold">{reportData.complianceRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  {getComplianceStatus(reportData.complianceRate).label}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Inspections</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{reportData.totalInspections}</div>
                <p className="text-xs text-muted-foreground">
                  {reportData.completedInspections} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue Items</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div className="text-2xl font-bold text-destructive">{reportData.overdueInspections}</div>
                <p className="text-xs text-muted-foreground">
                  Require attention
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Maintenance Cost</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">${reportData.totalCost.toFixed(0)}</div>
                <p className="text-xs text-muted-foreground">
                  {reportData.maintenanceRecords} records
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Ride Breakdown */}
          {filters.includeDetails && (
            <Card>
              <CardHeader>
                <CardTitle>Inspection Breakdown by Ride</CardTitle>
                <CardDescription>
                  Number of inspections performed per ride
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(reportData.rideBreakdown).map(([rideName, count]) => (
                    <div key={rideName} className="flex items-center justify-between p-3 rounded-lg border bg-card-hover">
                      <span className="font-medium">{rideName}</span>
                      <Badge variant="outline">{count} inspections</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Export Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Export Report</CardTitle>
              <CardDescription>
                Download or share your compliance report
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => exportReport('pdf')}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline" onClick={() => exportReport('csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print Report
                </Button>
                <Button variant="outline" disabled>
                  <Mail className="h-4 w-4 mr-2" />
                  Email Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReportGenerator;