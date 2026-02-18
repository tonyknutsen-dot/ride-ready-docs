import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar, FileDown, FileText, Clock, Wrench, TestTube, Building, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, parseISO, isWithinInterval, subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
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
} from '@/utils/pdfUtils';
import { Ride } from '@/types/ride';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';

type MaintenanceRecord = Tables<'maintenance_records'>;
type Check = Tables<'checks'>;
type Defect = Tables<'defects'>;
type Document = Tables<'documents'>;
type AnnualInspection = Tables<'annual_inspection_reports'>;

interface TimelineEvent {
  date: Date;
  type: 'check' | 'maintenance' | 'defect' | 'inspection' | 'ndt_schedule' | 'ndt_report';
  title: string;
  description: string;
  status?: string;
  severity?: string;
}

interface EquipmentTimelineReportProps {
  ride: Ride;
}

const EquipmentTimelineReport = ({ ride }: EquipmentTimelineReportProps) => {
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState<Date | undefined>(subMonths(new Date(), 12));
  const [reportDateTo, setReportDateTo] = useState<Date | undefined>(new Date());
  const [reportFromCalendarOpen, setReportFromCalendarOpen] = useState(false);
  const [reportToCalendarOpen, setReportToCalendarOpen] = useState(false);
  const [eventCounts, setEventCounts] = useState({ checks: 0, maintenance: 0, defects: 0, inspections: 0, ndt: 0 });
  const { toast } = useToast();
  const { effectiveUserId } = useEffectiveUserId();

  useEffect(() => {
    if (reportDialogOpen) {
      loadEventCounts();
    }
  }, [reportDialogOpen, reportDateFrom, reportDateTo, ride.id]);

  const loadEventCounts = async () => {
    setLoading(true);
    try {
      if (!effectiveUserId) return;

      const dateFilter = (date: string) => {
        if (!reportDateFrom || !reportDateTo) return true;
        const d = parseISO(date);
        return isWithinInterval(d, { start: reportDateFrom, end: reportDateTo });
      };

      // Load checks - use effectiveUserId for staff/testers, exclude test data
      const { data: checks } = await supabase
        .from('checks')
        .select('check_date')
        .eq('ride_id', ride.id)
        .eq('user_id', effectiveUserId)
        .eq('is_test_data', false);
      
      // Load maintenance - exclude test data
      const { data: maintenance } = await supabase
        .from('maintenance_records')
        .select('maintenance_date')
        .eq('ride_id', ride.id)
        .eq('user_id', effectiveUserId)
        .eq('is_test_data', false);

      // Load defects - exclude test data
      const { data: defects } = await supabase
        .from('defects')
        .select('reported_at')
        .eq('ride_id', ride.id)
        .eq('user_id', effectiveUserId)
        .eq('is_test_data', false);

      // Load annual inspections
      const { data: inspections } = await supabase
        .from('annual_inspection_reports')
        .select('inspection_date')
        .eq('ride_id', ride.id)
        .eq('user_id', effectiveUserId);

      // Load NDT documents
      const { data: ndtDocs } = await supabase
        .from('documents')
        .select('uploaded_at')
        .eq('ride_id', ride.id)
        .eq('user_id', effectiveUserId)
        .in('document_type', ['ndt_schedule', 'ndt_report']);

      setEventCounts({
        checks: (checks || []).filter(c => dateFilter(c.check_date)).length,
        maintenance: (maintenance || []).filter(m => dateFilter(m.maintenance_date)).length,
        defects: (defects || []).filter(d => dateFilter(d.reported_at)).length,
        inspections: (inspections || []).filter(i => dateFilter(i.inspection_date)).length,
        ndt: (ndtDocs || []).filter(n => dateFilter(n.uploaded_at)).length,
      });
    } catch (error) {
      console.error('Error loading event counts:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTimelineReport = async () => {
    setGeneratingPdf(true);
    try {
      if (!effectiveUserId) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', effectiveUserId)
        .single();

      // Load all data - use effectiveUserId for staff/testers, exclude test data
      const [checksResult, maintenanceResult, defectsResult, inspectionsResult, ndtDocsResult] = await Promise.all([
        supabase.from('checks').select('*').eq('ride_id', ride.id).eq('user_id', effectiveUserId).eq('is_test_data', false),
        supabase.from('maintenance_records').select('*').eq('ride_id', ride.id).eq('user_id', effectiveUserId).eq('is_test_data', false),
        supabase.from('defects').select('*').eq('ride_id', ride.id).eq('user_id', effectiveUserId).eq('is_test_data', false),
        supabase.from('annual_inspection_reports').select('*').eq('ride_id', ride.id).eq('user_id', effectiveUserId),
        supabase.from('documents').select('*').eq('ride_id', ride.id).eq('user_id', effectiveUserId).eq('is_test_data', false).in('document_type', ['ndt_schedule', 'ndt_report']),
      ]);

      const dateFilter = (date: string) => {
        if (!reportDateFrom || !reportDateTo) return true;
        const d = parseISO(date);
        return isWithinInterval(d, { start: reportDateFrom, end: reportDateTo });
      };

      // Build timeline events
      const events: TimelineEvent[] = [];

      // Add checks
      (checksResult.data || []).filter(c => dateFilter(c.check_date)).forEach(check => {
        const frequencyLabel = {
          'preopening': 'Pre-Opening',
          'daily': 'Daily',
          'weekly': 'Weekly',
          'monthly': 'Monthly',
          'yearly': 'Yearly'
        }[check.check_frequency] || check.check_frequency;
        
        events.push({
          date: parseISO(check.check_date),
          type: 'check',
          title: `${frequencyLabel} Check`,
          description: `Performed by ${check.inspector_name}`,
          status: check.status,
        });
      });

      // Add maintenance
      (maintenanceResult.data || []).filter(m => dateFilter(m.maintenance_date)).forEach(record => {
        events.push({
          date: parseISO(record.maintenance_date),
          type: 'maintenance',
          title: `Maintenance: ${record.maintenance_type}`,
          description: record.description.substring(0, 80) + (record.description.length > 80 ? '...' : ''),
        });
      });

      // Add defects
      (defectsResult.data || []).filter(d => dateFilter(d.reported_at)).forEach(defect => {
        events.push({
          date: parseISO(defect.reported_at),
          type: 'defect',
          title: `Defect Reported`,
          description: defect.description.substring(0, 80) + (defect.description.length > 80 ? '...' : ''),
          status: defect.status,
          severity: defect.severity,
        });
      });

      // Add annual inspections
      (inspectionsResult.data || []).filter(i => dateFilter(i.inspection_date)).forEach(inspection => {
        events.push({
          date: parseISO(inspection.inspection_date),
          type: 'inspection',
          title: `Annual Inspection`,
          description: `By ${inspection.inspection_company} - ${inspection.inspector_name}`,
          status: inspection.inspection_status,
        });
      });

      // Add NDT documents
      (ndtDocsResult.data || []).filter(d => dateFilter(d.uploaded_at)).forEach(doc => {
        events.push({
          date: parseISO(doc.uploaded_at),
          type: doc.document_type === 'ndt_schedule' ? 'ndt_schedule' : 'ndt_report',
          title: doc.document_type === 'ndt_schedule' ? 'NDT Schedule Uploaded' : 'NDT Report Uploaded',
          description: doc.document_name,
        });
      });

      // Sort by date descending (most recent first)
      events.sort((a, b) => b.date.getTime() - a.date.getTime());

      if (events.length === 0) {
        toast({
          title: "No Events",
          description: "No activities found for the selected date range",
          variant: "destructive",
        });
        setGeneratingPdf(false);
        return;
      }

      // Fetch company logo
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

      // Generate PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Footer handled by drawAllPageFooters from pdfUtils

      let yPos = 20;

      // Header with logo
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, 'AUTO', 20, yPos - 5, 18, 18);
        } catch (e) {
          console.log('Could not add logo');
        }
      }

      // Company name
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      const companyName = profile?.company_name || profile?.showmen_name || 'Equipment Timeline';
      doc.text(companyName, pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;

      if (profile?.controller_name) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(`Controller: ${profile.controller_name}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;
      }

      yPos += 8;

      // Report title
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('EQUIPMENT TIMELINE REPORT', pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;

      // Date range
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80);
      const dateRangeText = `Period: ${reportDateFrom ? format(reportDateFrom, 'dd/MM/yyyy') : 'All'} to ${reportDateTo ? format(reportDateTo, 'dd/MM/yyyy') : 'Present'}`;
      doc.text(dateRangeText, pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;

      // Divider
      doc.setDrawColor(180);
      doc.line(20, yPos, pageWidth - 20, yPos);
      yPos += 10;

      // Equipment details
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Equipment Details', 20, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);

      const leftCol = 20;
      const labelWidth = 32;

      doc.setFont('helvetica', 'bold');
      doc.text('Name:', leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(ride.ride_name, leftCol + labelWidth, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'bold');
      doc.text('Category:', leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(ride.ride_categories?.name || '-', leftCol + labelWidth, yPos);
      yPos += 6;

      if (ride.manufacturer) {
        doc.setFont('helvetica', 'bold');
        doc.text('Manufacturer:', leftCol, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(ride.manufacturer, leftCol + labelWidth, yPos);
        yPos += 6;
      }

      if (ride.serial_number) {
        doc.setFont('helvetica', 'bold');
        doc.text('Serial No:', leftCol, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(ride.serial_number, leftCol + labelWidth, yPos);
        yPos += 6;
      }

      yPos += 5;

      // Summary stats
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', 20, yPos);
      yPos += 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const checksCount = events.filter(e => e.type === 'check').length;
      const maintenanceCount = events.filter(e => e.type === 'maintenance').length;
      const defectsCount = events.filter(e => e.type === 'defect').length;
      const inspectionsCount = events.filter(e => e.type === 'inspection').length;
      const ndtCount = events.filter(e => e.type === 'ndt_schedule' || e.type === 'ndt_report').length;

      doc.text(`Total Events: ${events.length}  |  Checks: ${checksCount}  |  Maintenance: ${maintenanceCount}  |  Defects: ${defectsCount}  |  Inspections: ${inspectionsCount}  |  NDT: ${ndtCount}`, 20, yPos);
      yPos += 10;

      // Divider
      doc.setDrawColor(180);
      doc.line(20, yPos, pageWidth - 20, yPos);
      yPos += 8;

      // Timeline table
      const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
          'check': '✓ Check',
          'maintenance': '🔧 Maintenance',
          'defect': '⚠ Defect',
          'inspection': '📋 Annual Inspection',
          'ndt_schedule': '🔬 NDT Schedule',
          'ndt_report': '🔬 NDT Report',
        };
        return labels[type] || type;
      };

      const tableData = events.map(event => [
        format(event.date, 'dd/MM/yyyy'),
        getTypeLabel(event.type),
        event.title,
        event.description,
        event.status || '-',
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'Type', 'Event', 'Details', 'Status']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [80, 80, 80], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 28 },
          2: { cellWidth: 35 },
          3: { cellWidth: 65 },
          4: { cellWidth: 20 },
        },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        margin: { left: 20, right: 20 },
      });

      drawAllPageFooters(doc);

      // Save PDF
      const fileName = `${ride.ride_name.replace(/[^a-z0-9]/gi, '_')}_Timeline_${format(new Date(), 'yyyyMMdd')}.pdf`;
      doc.save(fileName);

      toast({
        title: "Report Generated",
        description: `Timeline report with ${events.length} events has been downloaded`,
      });

      setReportDialogOpen(false);
    } catch (error: any) {
      console.error('Error generating timeline report:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const totalEvents = eventCounts.checks + eventCounts.maintenance + eventCounts.defects + eventCounts.inspections + eventCounts.ndt;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Equipment Timeline Report
          </CardTitle>
          <CardDescription>
            Generate a comprehensive PDF report showing all activities for {ride.ride_name} in chronological order
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setReportDialogOpen(true)}>
            <FileDown className="h-4 w-4 mr-2" />
            Generate Timeline Report
          </Button>
        </CardContent>
      </Card>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Generate Timeline Report</DialogTitle>
            <DialogDescription>
              Select a date range to include in the report for {ride.ride_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Date Range Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From Date</Label>
                <Popover open={reportFromCalendarOpen} onOpenChange={setReportFromCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1",
                        !reportDateFrom && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {reportDateFrom ? format(reportDateFrom, "dd/MM/yyyy") : "Select"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={reportDateFrom}
                      onSelect={(date) => {
                        setReportDateFrom(date);
                        setReportFromCalendarOpen(false);
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>To Date</Label>
                <Popover open={reportToCalendarOpen} onOpenChange={setReportToCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1",
                        !reportDateTo && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {reportDateTo ? format(reportDateTo, "dd/MM/yyyy") : "Select"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={reportDateTo}
                      onSelect={(date) => {
                        setReportDateTo(date);
                        setReportToCalendarOpen(false);
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Event counts preview */}
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-sm font-medium mb-3">Events in selected period:</p>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Checks: {eventCounts.checks}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-blue-600" />
                    <span>Maintenance: {eventCounts.maintenance}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span>Defects: {eventCounts.defects}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-purple-600" />
                    <span>Inspections: {eventCounts.inspections}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TestTube className="h-4 w-4 text-cyan-600" />
                    <span>NDT: {eventCounts.ndt}</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <Clock className="h-4 w-4" />
                    <span>Total: {totalEvents}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={generateTimelineReport} disabled={generatingPdf || totalEvents === 0}>
              <FileDown className="h-4 w-4 mr-2" />
              {generatingPdf ? 'Generating...' : 'Generate PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EquipmentTimelineReport;
