import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar, FileDown, FileText } from 'lucide-react';
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

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Helper function to add footer to each page
      const addFooter = () => {
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(128);
          doc.text('ridereadydocs.com', pageWidth / 2, pageHeight - 10, { align: 'center' });
          doc.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
          doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, pageHeight - 10, { align: 'left' });
          doc.setTextColor(0);
        }
      };

      // === HEADER SECTION ===
      let yPos = 20;
      
      // Logo on left, company info on right - smaller logo
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, 'AUTO', 20, yPos - 5, 18, 18);
        } catch (e) {
          console.log('Could not add logo to PDF');
        }
      }
      
      // Company name - always centered on page
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      const companyName = profile?.company_name || profile?.showmen_name || 'Maintenance Report';
      doc.text(companyName, pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;

      // Controller name below company
      if (profile?.controller_name) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(`Controller: ${profile.controller_name}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;
      }
      
      yPos += 8;

      // Report title with underline
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('MAINTENANCE REPORT', pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;

      // Date range
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80);
      const dateRangeText = `Period: ${reportDateFrom ? format(reportDateFrom, 'dd/MM/yyyy') : 'All'} to ${reportDateTo ? format(reportDateTo, 'dd/MM/yyyy') : 'Present'}`;
      doc.text(dateRangeText, pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;

      // Divider line
      doc.setDrawColor(180);
      doc.line(20, yPos, pageWidth - 20, yPos);
      yPos += 10;

      // === EQUIPMENT DETAILS SECTION WITH IMAGE ===
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Equipment Details', 20, yPos);
      yPos += 8;

      // Calculate layout - if image exists, put it on the right (smaller image)
      const hasImage = !!imageDataUrl;
      const detailsWidth = hasImage ? 120 : pageWidth - 40;
      const imageX = pageWidth - 45;
      const imageY = yPos;
      const imageW = 30;
      const imageH = 22;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);

      // Equipment info - left aligned, respecting image space
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
      if (ride.year_manufactured) {
        doc.setFont('helvetica', 'bold');
        doc.text('Year:', leftCol, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(ride.year_manufactured.toString(), leftCol + labelWidth, yPos);
        yPos += 6;
      }
      if (ride.owner_name) {
        doc.setFont('helvetica', 'bold');
        doc.text('Owner:', leftCol, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(ride.owner_name, leftCol + labelWidth, yPos);
        yPos += 6;
      }

      // Add ride image on the right side if available
      if (imageDataUrl) {
        try {
          doc.addImage(imageDataUrl, 'JPEG', imageX, imageY, imageW, imageH);
          yPos = Math.max(yPos, imageY + imageH + 5);
        } catch (e) {
          console.log('Could not add image to PDF');
        }
      }
      
      yPos += 5;

      // === SUMMARY SECTION ===
      doc.setDrawColor(200);
      doc.line(20, yPos, pageWidth - 20, yPos);
      yPos += 8;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Summary', 20, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);

      const totalCost = filteredRecords.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);

      doc.text(`Total Records: ${filteredRecords.length}`, leftCol, yPos);
      doc.text(`Total Cost: £${totalCost.toFixed(2)}`, pageWidth / 2, yPos);
      yPos += 10;

      // === MAINTENANCE RECORDS TABLE ===
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Maintenance Records', 20, yPos);
      yPos += 5;

      // Truncate description for table view
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
        headStyles: { 
          fillColor: [70, 70, 70],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
        },
        styles: { 
          fontSize: 8, 
          cellPadding: 3,
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 22 },
          2: { cellWidth: 30 },
          3: { cellWidth: 55 },
          4: { cellWidth: 28 },
          5: { cellWidth: 20, halign: 'right' },
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
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

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Detailed Maintenance Records', 20, yPos);
      yPos += 10;
      
      for (let i = 0; i < filteredRecords.length; i++) {
        const record = filteredRecords[i];
        
        // Check if we need a new page
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }

        // Record header with number
        doc.setFillColor(240, 240, 240);
        doc.rect(15, yPos - 5, pageWidth - 30, 8, 'F');
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text(`${i + 1}. ${format(parseISO(record.maintenance_date), 'dd MMMM yyyy')} - ${getMaintenanceTypeLabel(record.maintenance_type)}`, 20, yPos);
        yPos += 10;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        
        // Description
        doc.setFont('helvetica', 'bold');
        doc.text('Description:', 25, yPos);
        doc.setFont('helvetica', 'normal');
        const descLines = doc.splitTextToSize(record.description, pageWidth - 55);
        doc.text(descLines, 55, yPos);
        yPos += Math.max(descLines.length * 4, 5) + 2;
        
        // Performed by
        doc.setFont('helvetica', 'bold');
        doc.text('Performed by:', 25, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(record.performed_by || '-', 55, yPos);
        yPos += 5;
        
        // Cost
        if (record.cost) {
          doc.setFont('helvetica', 'bold');
          doc.text('Cost:', 25, yPos);
          doc.setFont('helvetica', 'normal');
          doc.text(`£${Number(record.cost).toFixed(2)}`, 55, yPos);
          yPos += 5;
        }
        
        // Parts replaced
        if (record.parts_replaced) {
          doc.setFont('helvetica', 'bold');
          doc.text('Parts replaced:', 25, yPos);
          doc.setFont('helvetica', 'normal');
          const partsLines = doc.splitTextToSize(record.parts_replaced, pageWidth - 55);
          doc.text(partsLines, 55, yPos);
          yPos += Math.max(partsLines.length * 4, 5) + 2;
        }
        
        // Notes
        if (record.notes) {
          doc.setFont('helvetica', 'bold');
          doc.text('Notes:', 25, yPos);
          doc.setFont('helvetica', 'normal');
          const notesLines = doc.splitTextToSize(record.notes, pageWidth - 55);
          doc.text(notesLines, 55, yPos);
          yPos += Math.max(notesLines.length * 4, 5) + 2;
        }
        
        // Attachments - fetch and list document names
        if (record.document_ids && record.document_ids.length > 0) {
          // Fetch document names for this record
          const { data: attachedDocs } = await supabase
            .from('documents')
            .select('id, document_name, mime_type, file_path')
            .in('id', record.document_ids);
          
          if (attachedDocs && attachedDocs.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.text('Attachments:', 25, yPos);
            yPos += 5;
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            for (const attachment of attachedDocs) {
              doc.text(`• ${attachment.document_name}`, 30, yPos);
              yPos += 4;
              
              // Check for page overflow
              if (yPos > 270) {
                doc.addPage();
                yPos = 20;
              }
            }
            doc.setFontSize(9);
            yPos += 2;
            
            // Store attachments for appendix
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
        doc.setTextColor(128);
        const timestampText = `Record created: ${format(parseISO(record.created_at), 'dd/MM/yyyy HH:mm')}${record.updated_at !== record.created_at ? ` | Last edited: ${format(parseISO(record.updated_at), 'dd/MM/yyyy HH:mm')}` : ''}`;
        doc.text(timestampText, 25, yPos);
        doc.setTextColor(0);
        yPos += 12;
      }
      
      // === ATTACHMENTS APPENDIX ===
      if (attachmentsForAppendix.length > 0) {
        doc.addPage();
        yPos = 20;
        
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text('Appendix: Maintenance Attachments', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80);
        doc.text('Supporting documents, receipts, and photographs for maintenance records.', 20, yPos);
        yPos += 10;
        
        for (const attachment of attachmentsForAppendix) {
          // Section header for each record's attachments
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.setFillColor(245, 245, 245);
          doc.rect(15, yPos - 4, pageWidth - 30, 7, 'F');
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(50, 50, 50);
          doc.text(`Record ${attachment.recordIndex}: ${attachment.recordDate} - ${attachment.recordType}`, 20, yPos);
          yPos += 10;
          
          // Display images inline
          for (const docItem of attachment.docs) {
            const isImage = docItem.mime_type?.startsWith('image/');
            
            if (isImage) {
              try {
                const { data: imageBlob } = await supabase.storage
                  .from('ride-documents')
                  .download(docItem.file_path);
                
                if (imageBlob) {
                  const imageDataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(imageBlob);
                  });
                  
                  // Check for page overflow before adding image
                  if (yPos > 200) {
                    doc.addPage();
                    yPos = 20;
                  }
                  
                  // Add image with label
                  doc.setFontSize(8);
                  doc.setFont('helvetica', 'normal');
                  doc.setTextColor(80);
                  doc.text(docItem.document_name, 25, yPos);
                  yPos += 4;
                  
                  try {
                    doc.addImage(imageDataUrl, 'AUTO', 25, yPos, 60, 45);
                    yPos += 50;
                  } catch (e) {
                    doc.text('[Image could not be embedded]', 25, yPos);
                    yPos += 6;
                  }
                }
              } catch (e) {
                doc.setFontSize(8);
                doc.text(`• ${docItem.document_name} (file not available)`, 25, yPos);
                yPos += 5;
              }
            } else {
              // Non-image file - just list it
              doc.setFontSize(8);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(0);
              doc.text(`📎 ${docItem.document_name}`, 25, yPos);
              yPos += 5;
            }
          }
          
          yPos += 5;
        }
      }

      // Add footers to all pages
      addFooter();
      
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Maintenance Report
          </CardTitle>
          <CardDescription>
            Create a professional PDF report of maintenance activities for {ride.ride_name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {records.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No maintenance records to report</p>
              <p className="text-sm text-muted-foreground">Log some maintenance activities first to generate a report</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">{records.length}</p>
                  <p className="text-sm text-muted-foreground">Total Records</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">
                    £{records.reduce((sum, r) => sum + (Number(r.cost) || 0), 0).toFixed(0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">
                    {records.length > 0 ? format(parseISO(records[0].maintenance_date), 'MMM yyyy') : '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">Latest Record</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">
                    {records.length > 0 ? format(parseISO(records[records.length - 1].maintenance_date), 'MMM yyyy') : '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">Earliest Record</p>
                </div>
              </div>

              {/* Generate button */}
              <Button 
                onClick={() => setReportDialogOpen(true)} 
                className="w-full md:w-auto"
                size="lg"
              >
                <FileDown className="h-4 w-4 mr-2" />
                Generate PDF Report
              </Button>

              {/* What's included */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="font-medium mb-2">Report includes:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Your company/showman details with logo</li>
                  <li>• Equipment details and photo (if available)</li>
                  <li>• Summary table of all maintenance records</li>
                  <li>• Detailed breakdown with work descriptions</li>
                  <li>• Costs, parts replaced, and timestamps</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
            {/* Date Range */}
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

            {/* Quick date range options */}
            <div className="space-y-2">
              <Label>Quick Select</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReportDateFrom(subMonths(new Date(), 3));
                    setReportDateTo(new Date());
                  }}
                >
                  Last 3 months
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReportDateFrom(subMonths(new Date(), 6));
                    setReportDateTo(new Date());
                  }}
                >
                  Last 6 months
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReportDateFrom(subMonths(new Date(), 12));
                    setReportDateTo(new Date());
                  }}
                >
                  Last 12 months
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReportDateFrom(undefined);
                    setReportDateTo(undefined);
                  }}
                >
                  All time
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={generateMaintenanceReport} disabled={generatingPdf}>
              {generatingPdf ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
