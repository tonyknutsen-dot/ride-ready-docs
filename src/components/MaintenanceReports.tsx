import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
          // Footer divider line
          doc.setDrawColor(220, 220, 220);
          doc.setLineWidth(0.5);
          doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);
          // Legal disclaimer line
          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(150);
          doc.text('This document forms part of the equipment maintenance history and should be retained for inspection and regulatory review.', pageWidth / 2, pageHeight - 15, { align: 'center', maxWidth: pageWidth - 30 });
          // Meta line
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(120);
          doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy – HH:mm')}`, 15, pageHeight - 9, { align: 'left' });
          doc.text('ridereadydocs.com', pageWidth / 2, pageHeight - 9, { align: 'center' });
          doc.text(`Page ${i} of ${totalPages}`, pageWidth - 15, pageHeight - 9, { align: 'right' });
          doc.setTextColor(0);
        }
      };

      // === HEADER SECTION ===
      let yPos = 15;
      const navyR = 30, navyG = 58, navyB = 95; // #1E3A5F brand navy

      // Logo top-left
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, 'AUTO', 15, yPos - 2, 20, 20);
        } catch (e) {
          console.log('Could not add logo to PDF');
        }
      }

      // Company name — centered
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42); // #0F172A
      const companyName = profile?.company_name || profile?.showmen_name || 'Maintenance Report';
      doc.text(companyName, pageWidth / 2, yPos + 4, { align: 'center' });
      yPos += 7;

      // Controller name
      if (profile?.controller_name) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(`Controller: ${profile.controller_name}`, pageWidth / 2, yPos + 2, { align: 'center' });
        yPos += 6;
      }

      yPos += 6;

      // Report title
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('MAINTENANCE REPORT', pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;

      // Date range
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      const dateRangeText = `Period: ${reportDateFrom ? format(reportDateFrom, 'dd/MM/yyyy') : 'All'} to ${reportDateTo ? format(reportDateTo, 'dd/MM/yyyy') : 'Present'}`;
      doc.text(dateRangeText, pageWidth / 2, yPos, { align: 'center' });
      yPos += 7;

      // Brand navy divider — 2px authority line
      doc.setDrawColor(navyR, navyG, navyB);
      doc.setLineWidth(1.2);
      doc.line(15, yPos, pageWidth - 15, yPos);
      doc.setLineWidth(0.5);
      yPos += 10;

      // === EQUIPMENT DETAILS SECTION WITH IMAGE ===
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(navyR, navyG, navyB);
      doc.setCharSpace(0.5);
      doc.text('EQUIPMENT DETAILS', 15, yPos);
      doc.setCharSpace(0);
      doc.setTextColor(0);
      yPos += 5;
      // Thin navy underline for section title
      doc.setDrawColor(navyR, navyG, navyB);
      doc.setLineWidth(0.4);
      doc.line(15, yPos, pageWidth - 15, yPos);
      doc.setDrawColor(200);
      yPos += 6;

      // Calculate layout - if image exists, put it on the right with proper aspect ratio
      const hasImage = !!imageDataUrl;
      const maxImageW = 40;
      const maxImageH = 30;
      let imageW = maxImageW;
      let imageH = maxImageH;
      
      // Calculate aspect-ratio-preserving dimensions if we have an image
      if (imageDataUrl) {
        try {
          const img = new Image();
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = imageDataUrl;
          });
          
          if (img.naturalWidth && img.naturalHeight) {
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            
            if (aspectRatio > maxImageW / maxImageH) {
              imageW = maxImageW;
              imageH = maxImageW / aspectRatio;
            } else {
              imageH = maxImageH;
              imageW = maxImageH * aspectRatio;
            }
          }
        } catch (e) {
          console.log('Could not calculate image dimensions');
        }
      }
      
      const imageX = pageWidth - 20 - imageW;
      const imageY = yPos;

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

      // Add ride image on the right side if available - with proper aspect ratio and border
      if (imageDataUrl) {
        try {
          doc.setDrawColor(200);
          doc.setLineWidth(0.5);
          doc.rect(imageX - 1, imageY - 1, imageW + 2, imageH + 2);
          doc.addImage(imageDataUrl, 'JPEG', imageX, imageY, imageW, imageH);
          yPos = Math.max(yPos, imageY + imageH + 5);
        } catch (e) {
          console.log('Could not add image to PDF');
        }
      }
      
      yPos += 5;

      // === SUMMARY SECTION ===
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(15, yPos, pageWidth - 15, yPos);
      yPos += 7;

      // Summary section title
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(navyR, navyG, navyB);
      doc.setCharSpace(0.5);
      doc.text('SUMMARY', 15, yPos);
      doc.setCharSpace(0);
      yPos += 4;
      doc.setDrawColor(navyR, navyG, navyB);
      doc.setLineWidth(0.4);
      doc.line(15, yPos, pageWidth - 15, yPos);
      doc.setLineWidth(0.5);
      yPos += 5;

      const totalCost = filteredRecords.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);

      // Summary box — light grey background
      const summaryBoxY = yPos;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, summaryBoxY, pageWidth - 30, 18, 2, 2, 'FD');

      // Left: Records count
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text('Total Records', 22, summaryBoxY + 6);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${filteredRecords.length}`, 22, summaryBoxY + 14);

      // Right: Total cost — accented
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text('Total Cost', pageWidth - 55, summaryBoxY + 6);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(navyR, navyG, navyB);
      doc.text(`£${totalCost.toFixed(2)}`, pageWidth - 55, summaryBoxY + 14);
      doc.setTextColor(0);

      yPos += 26;

      // === MAINTENANCE RECORDS TABLE ===
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(navyR, navyG, navyB);
      doc.setCharSpace(0.5);
      doc.text('MAINTENANCE RECORDS', 15, yPos);
      doc.setCharSpace(0);
      yPos += 4;
      doc.setDrawColor(navyR, navyG, navyB);
      doc.setLineWidth(0.4);
      doc.line(15, yPos, pageWidth - 15, yPos);
      doc.setLineWidth(0.5);
      yPos += 4;

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
          fillColor: [navyR, navyG, navyB],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
        },
        styles: { 
          fontSize: 8.5, 
          cellPadding: 3.5,
          textColor: [15, 23, 42],
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 24, halign: 'center' },
          2: { cellWidth: 32 },
          3: { cellWidth: 52 },
          4: { cellWidth: 28 },
          5: { cellWidth: 22, halign: 'right' },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        bodyStyles: { lineColor: [226, 232, 240], lineWidth: 0.3 },
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

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(navyR, navyG, navyB);
      doc.setCharSpace(0.5);
      doc.text('DETAILED MAINTENANCE RECORDS', 15, yPos);
      doc.setCharSpace(0);
      yPos += 4;
      doc.setDrawColor(navyR, navyG, navyB);
      doc.setLineWidth(0.4);
      doc.line(15, yPos, pageWidth - 15, yPos);
      doc.setLineWidth(0.5);
      yPos += 8;

      // Compliance note
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120);
      doc.text('This report has been generated from digitally recorded maintenance records stored within the RideReadyDocs system.', 15, yPos, { maxWidth: pageWidth - 30 });
      yPos += 10;
      
      for (let i = 0; i < filteredRecords.length; i++) {
        const record = filteredRecords[i];
        
        // Check if we need a new page
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }

        // Record header — navy strip
        doc.setFillColor(navyR, navyG, navyB);
        doc.rect(15, yPos - 5, pageWidth - 30, 9, 'F');
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(`${i + 1}.  ${format(parseISO(record.maintenance_date), 'dd MMMM yyyy')}  —  ${getMaintenanceTypeLabel(record.maintenance_type)}`, 19, yPos);
        doc.setTextColor(0);
        yPos += 11;
        
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
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(navyR, navyG, navyB);
        doc.setCharSpace(0.5);
        doc.text('APPENDIX: MAINTENANCE ATTACHMENTS', 15, yPos);
        doc.setCharSpace(0);
        yPos += 4;
        doc.setDrawColor(navyR, navyG, navyB);
        doc.setLineWidth(0.4);
        doc.line(15, yPos, pageWidth - 15, yPos);
        doc.setLineWidth(0.5);
        yPos += 6;
        
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text('Supporting documents, receipts, and photographs for maintenance records.', 15, yPos);
        yPos += 10;
        
        for (const attachment of attachmentsForAppendix) {
          // Section header for each record's attachments
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.setFillColor(navyR, navyG, navyB);
          doc.rect(15, yPos - 4, pageWidth - 30, 8, 'F');
          doc.setFontSize(9.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.text(`Record ${attachment.recordIndex}: ${attachment.recordDate}  —  ${attachment.recordType}`, 19, yPos);
          doc.setTextColor(0);
          yPos += 10;
          
          // Display images inline with auto-context labels
          let photoCounter = 0;
          for (const docItem of attachment.docs) {
            const isImage = docItem.mime_type?.startsWith('image/');
            
            if (isImage) {
              photoCounter++;
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
                  
                  // Add image with auto-context label: "Photo 1 - Preventive Maintenance - 15 Jan 2024"
                  doc.setFontSize(9);
                  doc.setFont('helvetica', 'bold');
                  doc.setTextColor(50, 50, 50);
                  const photoLabel = `Photo ${photoCounter} - ${attachment.recordType} - ${attachment.recordDate}`;
                  doc.text(photoLabel, 25, yPos);
                  yPos += 5;
                  
                  try {
                    doc.addImage(imageDataUrl, 'AUTO', 25, yPos, 60, 45);
                    yPos += 52;
                  } catch (e) {
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(128);
                    doc.text('[Image could not be embedded]', 25, yPos);
                    yPos += 6;
                  }
                }
              } catch (e) {
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(128);
                doc.text(`• Photo ${photoCounter} - ${attachment.recordType} - ${attachment.recordDate} (file not available)`, 25, yPos);
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
      {/* Main report card — elevated with top stripe */}
      <div className="rounded-[18px] border border-border bg-card shadow-[0_6px_20px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* Brand top stripe */}
        <div className="h-1 w-full bg-primary" />

        <div className="p-5 space-y-5">
          {/* Title */}
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-primary" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground leading-tight">Generate Maintenance Report</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Create a professional PDF report of maintenance activities for {ride.ride_name}
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
              {/* Report Summary label */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Report Summary</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/40 rounded-[14px] border border-border p-4 text-center">
                  <p className="text-[22px] font-bold text-foreground leading-tight">{records.length}</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">Total Records</p>
                </div>
                {/* Total cost — subtle brand tint */}
                <div className="bg-primary/5 rounded-[14px] border border-primary/15 p-4 text-center">
                  <p className="text-[22px] font-bold text-foreground leading-tight">
                    £{records.reduce((sum, r) => sum + (Number(r.cost) || 0), 0).toFixed(0)}
                  </p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">Total Cost</p>
                </div>
                <div className="bg-muted/40 rounded-[14px] border border-border p-4 text-center">
                  <p className="text-[22px] font-bold text-foreground leading-tight">
                    {records.length > 0 ? format(parseISO(records[0].maintenance_date), 'MMM yyyy') : '-'}
                  </p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">Latest Record</p>
                </div>
                <div className="bg-muted/40 rounded-[14px] border border-border p-4 text-center">
                  <p className="text-[22px] font-bold text-foreground leading-tight">
                    {records.length > 0 ? format(parseISO(records[records.length - 1].maintenance_date), 'MMM yyyy') : '-'}
                  </p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">Earliest Record</p>
                </div>
              </div>

              {/* Generate button — dominant primary action */}
              <Button
                onClick={() => setReportDialogOpen(true)}
                className="w-full h-13 rounded-[14px] shadow-[0_4px_12px_rgba(30,58,95,0.25)] text-base font-semibold"
                size="lg"
              >
                <FileDown className="h-5 w-5 mr-2" />
                Generate PDF Report
              </Button>

              {/* Report includes — supportive info container */}
              <div className="rounded-[14px] border border-border bg-muted/30 p-4">
                <p className="text-sm font-semibold text-foreground mb-3">Report includes:</p>
                <ul className="space-y-1.5">
                  {[
                    'Your company/showman details with logo',
                    'Equipment details and photo (if available)',
                    'Summary table of all maintenance records',
                    'Detailed breakdown with work descriptions',
                    'Costs, parts replaced, and timestamps',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-0.5 shrink-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

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
