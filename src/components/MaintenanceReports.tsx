import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar, FileDown, FileText, Eye, AlertTriangle, History } from 'lucide-react';
import DefectsList from './DefectsList';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
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
  buildFileName,
  blobToDataUrl,
  drawSectionTitle,
  drawEquipmentDetails,
  drawSummaryBox,
  PDF_TABLE_HEAD_STYLES,
  PDF_TABLE_BODY_STYLES,
  PDF_TABLE_ALT_ROW,
  drawComplianceStatement,
} from '@/utils/pdfUtils';
import {
  drawTemplateHeader,
  drawTemplateFooters,
  generateDocumentId,
  checkOverflow,
} from '@/utils/pdfTemplate';
import { storeRideDocument, getRideCode } from '@/utils/rideDocumentService';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

type MaintenanceRecord = Tables<'maintenance_records'>;

interface MaintenanceReportsProps {
  ride: Ride;
}

const MAINTENANCE_TYPES = [
  { value: 'preventive', label: 'Preventive Maintenance' },
  { value: 'corrective', label: 'Corrective Maintenance' },
  { value: 'emergency', label: 'Emergency Repair' },
  { value: 'inspection', label: 'Inspection & Testing' },
  { value: 'lubrication', label: 'Lubrication' },
  { value: 'electrical', label: 'Electrical Work' },
  { value: 'mechanical', label: 'Mechanical Work' },
  { value: 'hydraulic', label: 'Hydraulic Work' },
  { value: 'structural', label: 'Structural Work' },
  { value: 'safety', label: 'Safety System Work' },
  { value: 'other', label: 'Other' },
];

// Sub-component: lists previously generated maintenance report PDFs for this ride
const GeneratedReportsList = ({ rideId }: { rideId: string }) => {
  const [reports, setReports] = useState<Tables<'documents'>[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('ride_id', rideId)
        .eq('user_id', user.id)
        .eq('document_type', 'maintenance_report')
        .order('uploaded_at', { ascending: false });
      setReports(data || []);
      setLoadingReports(false);
    };
    load();
  }, [rideId]);

  const handleView = async (filePath: string) => {
    const { data } = await supabase.storage.from('ride-documents').createSignedUrl(filePath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  if (loadingReports) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Generated Reports</h3>
      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reports generated yet.</p>
      ) : (
        reports.map((report) => (
          <div key={report.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{report.document_name}</p>
                <p className="text-xs text-muted-foreground">
                  Generated {format(parseISO(report.uploaded_at), 'd MMM yyyy')}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleView(report.file_path)} className="shrink-0">
              <Eye className="h-3.5 w-3.5 mr-1" />
              View
            </Button>
          </div>
        ))
      )}
    </div>
  );
};

const MaintenanceReports = ({ ride }: MaintenanceReportsProps) => {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState<Date | undefined>(subMonths(new Date(), 12));
  const [reportDateTo, setReportDateTo] = useState<Date | undefined>(new Date());
  const [reportFromCalendarOpen, setReportFromCalendarOpen] = useState(false);
  const [reportToCalendarOpen, setReportToCalendarOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadMaintenanceRecords();
  }, [ride.id]);

  const loadMaintenanceRecords = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('maintenance_records')
        .select('*')
        .eq('ride_id', ride.id)
        .eq('user_id', user.id)
        .order('maintenance_date', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error loading maintenance records:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMaintenanceTypeLabel = (type: string) => {
    return MAINTENANCE_TYPES.find(t => t.value === type)?.label || type;
  };

  const generateMaintenanceReport = async () => {
    setGeneratingPdf(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Filter records by date range
      const filteredRecords = records.filter(record => {
        const recordDate = parseISO(record.maintenance_date);
        if (reportDateFrom && reportDateTo) {
          return isWithinInterval(recordDate, { start: reportDateFrom, end: reportDateTo });
        }
        return true;
      });

      if (filteredRecords.length === 0) {
        toast({
          title: "No Records",
          description: "No maintenance records found for the selected date range",
          variant: "destructive",
        });
        setGeneratingPdf(false);
        return;
      }

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
      const { data: rideImage } = await supabase
        .from('documents')
        .select('file_path')
        .eq('ride_id', ride.id)
        .like('mime_type', 'image/%')
        .limit(1)
        .maybeSingle();

      let imageDataUrl: string | null = null;
      if (rideImage) {
        try {
          const { data: imageBlob } = await supabase.storage
            .from('ride-documents')
            .download(rideImage.file_path);
          if (imageBlob) {
            imageDataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(imageBlob);
            });
          }
        } catch (e) {
          console.log('Could not load ride image');
        }
      }

      const docId = await generateDocumentId(ride.id, 'MR');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 13;

      const templateOpts = { doc, title: 'MAINTENANCE REPORT', documentId: docId, docType: 'MR' as const };

      // === HEADER ===
      let yPos = drawTemplateHeader(templateOpts);

      // === EQUIPMENT DETAILS ===
      yPos = drawSectionTitle(doc, 'Equipment Details', yPos, margin);
      yPos = await drawEquipmentDetails({
        doc,
        y: yPos,
        margin,
        fields: [
          { label: 'Name', value: ride.ride_name },
          { label: 'Category', value: ride.ride_categories?.name },
          { label: 'Manufacturer', value: ride.manufacturer },
          { label: 'Serial No', value: ride.serial_number },
          { label: 'Year', value: ride.year_manufactured?.toString() },
          { label: 'Owner', value: ride.owner_name },
        ],
        imageDataUrl,
        maxImageW: 40,
        maxImageH: 30,
      });

      // === SUMMARY ===
      const totalCost = filteredRecords.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
      yPos = drawSectionTitle(doc, 'Report Summary', yPos, margin);
      yPos = drawSummaryBox(doc, [
        { label: 'Total Records', value: String(filteredRecords.length) },
        { label: 'Total Cost', value: `£${totalCost.toFixed(2)}`, accent: true },
        { label: 'Period', value: `${reportDateFrom ? format(reportDateFrom, 'dd/MM/yyyy') : 'All'} – ${reportDateTo ? format(reportDateTo, 'dd/MM/yyyy') : 'Present'}` },
      ], yPos, margin);

      // === MAINTENANCE RECORDS TABLE ===
      yPos = drawSectionTitle(doc, 'Maintenance Records', yPos, margin);

      const truncateText = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
      };

      const tableData = filteredRecords.map((record, index) => [
        (index + 1).toString(),
        format(parseISO(record.maintenance_date), 'dd/MM/yyyy'),
        getMaintenanceTypeLabel(record.maintenance_type),
        truncateText(record.description, 50),
        record.performed_by || '-',
        record.cost ? `£${Number(record.cost).toFixed(2)}` : '-',
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Date', 'Type', 'Work Done', 'By', 'Cost']],
        body: tableData,
        headStyles: PDF_TABLE_HEAD_STYLES,
        styles: PDF_TABLE_BODY_STYLES,
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 24, halign: 'center' },
          2: { cellWidth: 32 },
          3: { cellWidth: 52 },
          4: { cellWidth: 28 },
          5: { cellWidth: 22, halign: 'right' },
        },
        alternateRowStyles: PDF_TABLE_ALT_ROW,
        margin: { bottom: 28 },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;

      // === DETAILED RECORDS ===
      doc.addPage();
      yPos = 20;
      
      // Track attachments for appendix
      const attachmentsForAppendix: Array<{
        recordIndex: number;
        recordDate: string;
        recordType: string;
        docs: Array<{ id: string; document_name: string; mime_type: string | null; file_path: string }>;
      }> = [];

      yPos = drawSectionTitle(doc, 'Detailed Maintenance Records', yPos, margin);
      yPos = drawComplianceStatement(doc, yPos, margin);
      
      for (let i = 0; i < filteredRecords.length; i++) {
        const record = filteredRecords[i];
        
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }

        // Record header — navy strip
        doc.setFillColor(...PDF_COLORS.navy);
        doc.rect(margin, yPos - 5, pageWidth - margin * 2, 9, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PDF_COLORS.white);
        doc.text(`${i + 1}.  ${format(parseISO(record.maintenance_date), 'dd MMMM yyyy')}  —  ${getMaintenanceTypeLabel(record.maintenance_type)}`, margin + 4, yPos);
        doc.setTextColor(0);
        yPos += 11;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...PDF_COLORS.body);
        
        const detailFields: Array<[string, string | null | undefined, boolean?]> = [
          ['Description', record.description, true],
          ['Performed by', record.performed_by],
          ['Cost', record.cost ? `£${Number(record.cost).toFixed(2)}` : null],
          ['Parts replaced', record.parts_replaced],
          ['Notes', record.notes],
        ];

        for (const [label, value, isLong] of detailFields) {
          if (!value) continue;
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...PDF_COLORS.muted);
          doc.text(`${label}:`, margin + 5, yPos);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...PDF_COLORS.body);
          if (isLong) {
            const lines = doc.splitTextToSize(value, pageWidth - margin - 50);
            doc.text(lines, margin + 38, yPos);
            yPos += Math.max(lines.length * 4, 5) + 2;
          } else {
            doc.text(String(value), margin + 38, yPos);
            yPos += 5;
          }
        }
        
        // Attachments
        if (record.document_ids && record.document_ids.length > 0) {
          const { data: attachedDocs } = await supabase
            .from('documents')
            .select('id, document_name, mime_type, file_path')
            .in('id', record.document_ids);
          
          if (attachedDocs && attachedDocs.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...PDF_COLORS.muted);
            doc.text('Attachments:', margin + 5, yPos);
            yPos += 5;
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...PDF_COLORS.body);
            for (const attachment of attachedDocs) {
              doc.text(`• ${attachment.document_name}`, margin + 10, yPos);
              yPos += 4;
              if (yPos > 270) { doc.addPage(); yPos = 20; }
            }
            doc.setFontSize(9);
            yPos += 2;
            
            attachmentsForAppendix.push({
              recordIndex: i + 1,
              recordDate: format(parseISO(record.maintenance_date), 'dd MMM yyyy'),
              recordType: getMaintenanceTypeLabel(record.maintenance_type),
              docs: attachedDocs
            });
          }
        }
        
        // Record timestamp
        doc.setFontSize(7);
        doc.setTextColor(160);
        const timestampText = `Record created: ${format(parseISO(record.created_at), 'dd/MM/yyyy HH:mm')}${record.updated_at !== record.created_at ? ` | Last edited: ${format(parseISO(record.updated_at), 'dd/MM/yyyy HH:mm')}` : ''}`;
        doc.text(timestampText, margin + 5, yPos);
        doc.setTextColor(0);
        yPos += 12;
      }
      
      // === ATTACHMENTS APPENDIX ===
      if (attachmentsForAppendix.length > 0) {
        doc.addPage();
        yPos = 20;
        yPos = drawSectionTitle(doc, 'Appendix: Maintenance Attachments', yPos, margin);
        
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...PDF_COLORS.muted);
        doc.text('Supporting documents, receipts, and photographs for maintenance records.', margin, yPos);
        yPos += 10;
        
        for (const attachment of attachmentsForAppendix) {
          if (yPos > 250) { doc.addPage(); yPos = 20; }
          
          doc.setFillColor(...PDF_COLORS.navy);
          doc.rect(margin, yPos - 4, pageWidth - margin * 2, 8, 'F');
          doc.setFontSize(9.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...PDF_COLORS.white);
          doc.text(`Record ${attachment.recordIndex}: ${attachment.recordDate}  —  ${attachment.recordType}`, margin + 4, yPos);
          doc.setTextColor(0);
          yPos += 10;
          
          let photoCounter = 0;
          for (const docItem of attachment.docs) {
            const isImage = docItem.mime_type?.startsWith('image/');
            if (isImage) {
              photoCounter++;
              try {
                const { data: imageBlob } = await supabase.storage.from('ride-documents').download(docItem.file_path);
                if (imageBlob) {
                  const imgDataUrl = await blobToDataUrl(imageBlob);
                  if (yPos > 200) { doc.addPage(); yPos = 20; }
                  doc.setFontSize(9);
                  doc.setFont('helvetica', 'bold');
                  doc.setTextColor(...PDF_COLORS.body);
                  doc.text(`Photo ${photoCounter} — ${attachment.recordType} — ${attachment.recordDate}`, margin + 5, yPos);
                  yPos += 5;
                  try {
                    doc.addImage(imgDataUrl, 'AUTO', margin + 5, yPos, 60, 45);
                    yPos += 52;
                  } catch (_) {
                    doc.setFontSize(8);
                    doc.setTextColor(...PDF_COLORS.muted);
                    doc.text('[Image could not be embedded]', margin + 5, yPos);
                    yPos += 6;
                  }
                }
              } catch (_) {
                doc.setFontSize(8);
                doc.setTextColor(...PDF_COLORS.muted);
                doc.text(`• Photo ${photoCounter} (file not available)`, margin + 5, yPos);
                yPos += 5;
              }
            } else {
              doc.setFontSize(8);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(...PDF_COLORS.body);
              doc.text(`📎 ${docItem.document_name}`, margin + 5, yPos);
              yPos += 5;
            }
          }
          yPos += 5;
        }
      }

      // Add standardised footers to all pages
      drawTemplateFooters(templateOpts);
      
      // Generate filename with date range
      const fromStr = reportDateFrom ? format(reportDateFrom, 'ddMMMyyyy') : 'all';
      const toStr = reportDateTo ? format(reportDateTo, 'ddMMMyyyy') : 'present';
      const documentName = `Maintenance Report - ${ride.ride_name} - ${fromStr} to ${toStr}`;
      const fileName = `${documentName.replace(/[^a-zA-Z0-9\s-]/g, '')}.pdf`;
      
      // Convert PDF to blob for upload
      const pdfBlob = doc.output('blob');
      
      // Upload to Supabase storage
      const storagePath = `${user.id}/maintenance-reports/${ride.id}/${Date.now()}-${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('ride-documents')
        .upload(storagePath, pdfBlob, { contentType: 'application/pdf' });
      
      if (uploadError) {
        console.error('Upload error:', uploadError);
        // Still save locally even if upload fails
        doc.save(fileName);
        toast({
          title: "Report Downloaded",
          description: "Report saved locally (could not upload to documents)",
          variant: "default",
        });
      } else {
        // Create document record in database
        const { error: docError } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            ride_id: ride.id,
            document_name: documentName,
            document_type: 'maintenance_report',
            file_path: storagePath,
            mime_type: 'application/pdf',
            file_size: pdfBlob.size,
            notes: `Maintenance report covering ${filteredRecords.length} records from ${fromStr} to ${toStr}`,
            is_global: false,
          });
        
        if (docError) {
          console.error('Document record error:', docError);
        }
        
        // Also register in ride_documents
        const rideCode = await getRideCode(ride.id);
        await storeRideDocument({
          rideId: ride.id,
          rideCode,
          documentType: 'MR',
          documentId: docId,
          fileUrl: storagePath,
          title: documentName,
          metadata: { recordCount: filteredRecords.length, totalCost: totalCost },
        });
        
        // Also download locally
        doc.save(fileName);
        
        toast({
          title: "Report Generated",
          description: "Report saved to Documents and downloaded",
        });
      }
      
      setReportDialogOpen(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      {/* ── Defects ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-[13px] font-bold text-foreground tracking-[1px] uppercase">Defects</h4>
        </div>
        <div className="h-px bg-border" />
        <DefectsList rideId={ride.id} rideName={ride.ride_name} showResolved={false} />
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <History className="h-3.5 w-3.5" />
            <span>Show closed defects</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <DefectsList rideId={ride.id} rideName={ride.ride_name} showResolved={true} />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Generate Report Card */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground leading-tight">Generate Maintenance Report</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create a professional PDF report of maintenance activities
            </p>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">No maintenance records to report</p>
            <p className="text-sm text-muted-foreground">Log some maintenance activities first to generate a report</p>
          </div>
        ) : (
          <>
            {/* Summary Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-xl border border-border p-4 text-center">
                <p className="text-2xl font-bold text-foreground leading-tight">{records.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Records</p>
              </div>
              <div className="bg-primary/5 rounded-xl border border-primary/15 p-4 text-center">
                <p className="text-2xl font-bold text-foreground leading-tight">
                  £{records.reduce((sum, r) => sum + (Number(r.cost) || 0), 0).toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Cost</p>
              </div>
              <div className="bg-muted/40 rounded-xl border border-border p-4 text-center">
                <p className="text-sm font-semibold text-foreground">
                  {records.length > 0 ? format(parseISO(records[0].maintenance_date), 'MMM yyyy') : '-'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Latest Record</p>
              </div>
              <div className="bg-muted/40 rounded-xl border border-border p-4 text-center">
                <p className="text-sm font-semibold text-foreground">
                  {records.length > 0 ? format(parseISO(records[records.length - 1].maintenance_date), 'MMM yyyy') : '-'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Earliest Record</p>
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={() => setReportDialogOpen(true)}
              className="w-full h-12 rounded-xl shadow-[0_4px_12px_rgba(30,58,95,0.25)] text-sm font-semibold"
              size="lg"
            >
              <FileDown className="h-5 w-5 mr-2" />
              Generate PDF Report
            </Button>
          </>
        )}
      </div>

      {/* Report Includes Card */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Report Includes</h3>
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
          {[
            'Company / showman branding and logo',
            'Equipment details and photo',
            'Maintenance summary table',
            'Detailed work descriptions',
            'Parts replaced and cost breakdown',
            'Engineer and service provider records',
          ].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Generated Reports List */}
      <GeneratedReportsList rideId={ride.id} />

      {/* Report Options Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Maintenance Report</DialogTitle>
            <DialogDescription>
              Select a date range for your maintenance report.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Popover open={reportFromCalendarOpen} onOpenChange={setReportFromCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
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
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>To Date</Label>
                <Popover open={reportToCalendarOpen} onOpenChange={setReportToCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
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
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quick Select</Label>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => { setReportDateFrom(subMonths(new Date(), 3)); setReportDateTo(new Date()); }}>Last 3 months</Button>
                <Button variant="outline" size="sm" onClick={() => { setReportDateFrom(subMonths(new Date(), 6)); setReportDateTo(new Date()); }}>Last 6 months</Button>
                <Button variant="outline" size="sm" onClick={() => { setReportDateFrom(subMonths(new Date(), 12)); setReportDateTo(new Date()); }}>Last 12 months</Button>
                <Button variant="outline" size="sm" onClick={() => { setReportDateFrom(undefined); setReportDateTo(undefined); }}>All time</Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
            <Button onClick={generateMaintenanceReport} disabled={generatingPdf}>
              {generatingPdf ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              {generatingPdf ? 'Generating...' : 'Generate PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaintenanceReports;
