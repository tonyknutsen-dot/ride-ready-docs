import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar, Edit, Trash2, FileText, Camera, Download, Eye, Filter, Save, Clock, Upload, X, FolderOpen, FileDown } from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfMonth, subMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { compressImage } from '@/utils/imageCompression';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

type MaintenanceRecord = Tables<'maintenance_records'>;
type Document = Tables<'documents'>;

interface MaintenanceHistoryProps {
  ride: Ride;
  refreshTrigger?: number;
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

const MaintenanceHistory = ({ ride, refreshTrigger }: MaintenanceHistoryProps) => {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [documents, setDocuments] = useState<Record<string, Document[]>>({});
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [editFormData, setEditFormData] = useState({
    maintenance_date: new Date(),
    maintenance_type: '',
    description: '',
    performed_by: '',
    parts_replaced: '',
    cost: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState<Date | undefined>(subMonths(new Date(), 12));
  const [reportDateTo, setReportDateTo] = useState<Date | undefined>(new Date());
  const [reportFromCalendarOpen, setReportFromCalendarOpen] = useState(false);
  const [reportToCalendarOpen, setReportToCalendarOpen] = useState(false);
  const { toast } = useToast();

  // Allowed MIME types for maintenance documents
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ];

  useEffect(() => {
    loadMaintenanceRecords();
  }, [ride.id, refreshTrigger]);

  const loadMaintenanceRecords = async () => {
    try {
      const { data: recordsData, error: recordsError } = await supabase
        .from('maintenance_records')
        .select('*')
        .eq('ride_id', ride.id)
        .order('maintenance_date', { ascending: false });

      if (recordsError) throw recordsError;

      setRecords(recordsData || []);

      // Load associated documents
      const recordsWithDocs = recordsData?.filter(record => record.document_ids && record.document_ids.length > 0) || [];
      
      if (recordsWithDocs.length > 0) {
        const allDocumentIds = recordsWithDocs.flatMap(record => record.document_ids || []);
        
        const { data: documentsData, error: documentsError } = await supabase
          .from('documents')
          .select('*')
          .in('id', allDocumentIds);

        if (documentsError) throw documentsError;

        // Group documents by maintenance record
        const docsByRecord: Record<string, Document[]> = {};
        recordsWithDocs.forEach(record => {
          docsByRecord[record.id] = (documentsData || []).filter(doc => 
            record.document_ids?.includes(doc.id)
          );
        });

        setDocuments(docsByRecord);

        // Load signed URLs for image documents
        const imageDocuments = (documentsData || []).filter(doc => doc.mime_type?.startsWith('image/'));
        const urls: Record<string, string> = {};
        for (const doc of imageDocuments) {
          try {
            const { data } = await supabase.storage
              .from('ride-documents')
              .createSignedUrl(doc.file_path, 3600); // 1 hour expiry
            if (data?.signedUrl) {
              urls[doc.id] = data.signedUrl;
            }
          } catch (e) {
            console.log('Could not get signed URL for', doc.id);
          }
        }
        setDocumentUrls(urls);
      }

    } catch (error) {
      console.error('Error loading maintenance records:', error);
      toast({
        title: "Error",
        description: "Failed to load maintenance records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from('maintenance_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Maintenance record deleted successfully",
      });

      loadMaintenanceRecords();
    } catch (error) {
      console.error('Error deleting maintenance record:', error);
      toast({
        title: "Error",
        description: "Failed to delete maintenance record",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setEditFormData({
      maintenance_date: parseISO(record.maintenance_date),
      maintenance_type: record.maintenance_type,
      description: record.description,
      performed_by: record.performed_by || '',
      parts_replaced: record.parts_replaced || '',
      cost: record.cost?.toString() || '',
      notes: record.notes || '',
    });
    setNewFiles([]);
    setEditDialogOpen(true);
  };

  const handleEditFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const processedFiles: File[] = [];
    
    for (const file of files) {
      const isValidType = ALLOWED_TYPES.includes(file.type) || file.type.startsWith('image/');
      const isValidSize = file.size <= 10 * 1024 * 1024;
      
      if (!isValidType) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not supported.`,
          variant: "destructive",
        });
        continue;
      }
      
      if (!isValidSize) {
        toast({
          title: "File Too Large",
          description: `${file.name} is too large. Max 10MB.`,
          variant: "destructive",
        });
        continue;
      }
      
      if (file.type.startsWith('image/') && file.size > 500000) {
        try {
          const compressed = await compressImage(file);
          processedFiles.push(compressed);
        } catch (error) {
          processedFiles.push(file);
        }
      } else {
        processedFiles.push(file);
      }
    }

    setNewFiles(prev => [...prev, ...processedFiles]);
  };

  const removeNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFilesToStorage = async (files: File[]): Promise<string[]> => {
    const uploadedPaths: string[] = [];

    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `maintenance/${ride.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('ride-documents')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        throw new Error(`Failed to upload ${file.name}`);
      }

      uploadedPaths.push(filePath);
    }

    return uploadedPaths;
  };

  const saveDocuments = async (filePaths: string[], recordDescription: string): Promise<string[]> => {
    const documentIds: string[] = [];

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const originalFile = newFiles[i];
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('documents')
        .insert([{
          user_id: user.id,
          ride_id: ride.id,
          document_name: originalFile.name,
          document_type: 'maintenance',
          file_path: filePath,
          mime_type: originalFile.type,
          file_size: originalFile.size,
          notes: `Maintenance record: ${recordDescription}`,
        }])
        .select('id')
        .single();

      if (error) throw error;
      if (data) documentIds.push(data.id);
    }

    return documentIds;
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    
    if (!editFormData.maintenance_type || !editFormData.description || !editFormData.performed_by) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Upload new files if any
      let newDocumentIds: string[] = [];
      if (newFiles.length > 0) {
        const filePaths = await uploadFilesToStorage(newFiles);
        newDocumentIds = await saveDocuments(filePaths, editFormData.description);
      }

      // Merge with existing document IDs
      const existingDocIds = editingRecord.document_ids || [];
      const allDocumentIds = [...existingDocIds, ...newDocumentIds];

      const { error } = await supabase
        .from('maintenance_records')
        .update({
          maintenance_date: editFormData.maintenance_date.toISOString().split('T')[0],
          maintenance_type: editFormData.maintenance_type,
          description: editFormData.description,
          performed_by: editFormData.performed_by,
          parts_replaced: editFormData.parts_replaced || null,
          cost: editFormData.cost ? parseFloat(editFormData.cost) : null,
          notes: editFormData.notes || null,
          document_ids: allDocumentIds.length > 0 ? allDocumentIds : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingRecord.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Maintenance record updated successfully",
      });

      setEditDialogOpen(false);
      setEditingRecord(null);
      setNewFiles([]);
      loadMaintenanceRecords();
    } catch (error) {
      console.error('Error updating maintenance record:', error);
      toast({
        title: "Error",
        description: "Failed to update maintenance record",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const generateMaintenanceReport = async () => {
    setGeneratingPdf(true);
    try {
      // Fetch user profile for company details
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
      let yPos = 15;
      
      // Company name (large, bold)
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175); // Blue color
      const companyName = profile?.company_name || profile?.showmen_name || 'Maintenance Record';
      doc.text(companyName, pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;

      // Company address
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      if (profile?.address) {
        doc.text(profile.address, pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;
      }
      if (profile?.controller_name) {
        doc.text(`Controller: ${profile.controller_name}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;
      }
      
      yPos += 3;

      // Report title
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text('MAINTENANCE REPORT', pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;

      // Date range
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const dateRangeText = `Period: ${reportDateFrom ? format(reportDateFrom, 'dd/MM/yyyy') : 'All'} to ${reportDateTo ? format(reportDateTo, 'dd/MM/yyyy') : 'Present'}`;
      doc.text(dateRangeText, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;

      // Divider line
      doc.setDrawColor(200);
      doc.line(20, yPos, pageWidth - 20, yPos);
      yPos += 8;

      // === EQUIPMENT DETAILS SECTION ===
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('Equipment Details', 20, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);

      // Equipment info in two columns
      const leftCol = 20;
      const rightCol = pageWidth / 2 + 10;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Name:', leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(ride.ride_name, leftCol + 25, yPos);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Category:', rightCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(ride.ride_categories?.name || '-', rightCol + 25, yPos);
      yPos += 6;

      if (ride.manufacturer) {
        doc.setFont('helvetica', 'bold');
        doc.text('Manufacturer:', leftCol, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(ride.manufacturer, leftCol + 32, yPos);
      }
      if (ride.serial_number) {
        doc.setFont('helvetica', 'bold');
        doc.text('Serial No:', rightCol, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(ride.serial_number, rightCol + 25, yPos);
      }
      yPos += 6;

      if (ride.year_manufactured) {
        doc.setFont('helvetica', 'bold');
        doc.text('Year:', leftCol, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(ride.year_manufactured.toString(), leftCol + 25, yPos);
      }
      if (ride.owner_name) {
        doc.setFont('helvetica', 'bold');
        doc.text('Owner:', rightCol, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(ride.owner_name, rightCol + 25, yPos);
      }
      yPos += 10;

      // Add ride image if available
      if (imageDataUrl) {
        try {
          doc.addImage(imageDataUrl, 'JPEG', pageWidth - 60, 55, 45, 35);
        } catch (e) {
          console.log('Could not add image to PDF');
        }
      }

      // === SUMMARY SECTION ===
      doc.setDrawColor(200);
      doc.line(20, yPos, pageWidth - 20, yPos);
      yPos += 8;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('Summary', 20, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);

      const totalCost = filteredRecords.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
      const maintenanceTypeCounts = filteredRecords.reduce((acc, r) => {
        acc[r.maintenance_type] = (acc[r.maintenance_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      doc.text(`Total Records: ${filteredRecords.length}`, leftCol, yPos);
      doc.text(`Total Cost: £${totalCost.toFixed(2)}`, rightCol, yPos);
      yPos += 10;

      // === MAINTENANCE RECORDS TABLE ===
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('Maintenance Records', 20, yPos);
      yPos += 5;

      const tableData = filteredRecords.map((record, index) => [
        (index + 1).toString(),
        format(parseISO(record.maintenance_date), 'dd/MM/yyyy'),
        getMaintenanceTypeLabel(record.maintenance_type),
        record.performed_by || '-',
        record.cost ? `£${Number(record.cost).toFixed(2)}` : '-',
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Date', 'Type', 'Performed By', 'Cost']],
        body: tableData,
        headStyles: { 
          fillColor: [30, 64, 175], 
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
          1: { cellWidth: 25 },
          2: { cellWidth: 45 },
          3: { cellWidth: 40 },
          4: { cellWidth: 25, halign: 'right' },
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;

      // === DETAILED RECORDS ===
      doc.addPage();
      yPos = 20;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
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
        doc.setFillColor(245, 247, 250);
        doc.rect(15, yPos - 5, pageWidth - 30, 8, 'F');
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 64, 175);
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
        
        // Attachments info
        const recordDocs = documents[record.id] || [];
        if (recordDocs.length > 0) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text('Attachments:', 25, yPos);
          doc.setFont('helvetica', 'normal');
          const imageCount = recordDocs.filter(d => d.mime_type?.startsWith('image/')).length;
          const docCount = recordDocs.length - imageCount;
          let attachmentText = '';
          if (imageCount > 0 && docCount > 0) {
            attachmentText = `${imageCount} photo${imageCount > 1 ? 's' : ''}, ${docCount} document${docCount > 1 ? 's' : ''}`;
          } else if (imageCount > 0) {
            attachmentText = `${imageCount} photo${imageCount > 1 ? 's' : ''}`;
          } else {
            attachmentText = `${docCount} document${docCount > 1 ? 's' : ''}`;
          }
          doc.text(attachmentText, 55, yPos);
          yPos += 5;
        }
        
        // Record timestamp
        doc.setFontSize(7);
        doc.setTextColor(128);
        const timestampText = `Record created: ${format(parseISO(record.created_at), 'dd/MM/yyyy HH:mm')}${record.updated_at !== record.created_at ? ` | Last edited: ${format(parseISO(record.updated_at), 'dd/MM/yyyy HH:mm')}` : ''}`;
        doc.text(timestampText, 25, yPos);
        doc.setTextColor(0);
        yPos += 12;
      }

      // Add footers to all pages
      addFooter();
      
      // Save
      const fileName = `maintenance-report-${ride.ride_name.replace(/[^a-zA-Z0-9]/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);
      
      setReportDialogOpen(false);
      toast({
        title: "Success",
        description: "Maintenance report downloaded",
      });
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

  const downloadFile = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('ride-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.document_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "File downloaded successfully",
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const getMaintenanceTypeLabel = (type: string) => {
    return MAINTENANCE_TYPES.find(t => t.value === type)?.label || type;
  };

  const getMaintenanceTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'preventive': 'default',
      'corrective': 'secondary',
      'emergency': 'destructive',
      'inspection': 'outline',
    };
    
    return (
      <Badge variant={variants[type] || 'outline'}>
        {getMaintenanceTypeLabel(type)}
      </Badge>
    );
  };

  const filteredRecords = records.filter(record => 
    filterType === 'all' || record.maintenance_type === filterType
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading maintenance history...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Maintenance History</h3>
          <p className="text-sm text-muted-foreground">
            View and manage maintenance records for {ride.ride_name}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setReportDialogOpen(true)}
            disabled={records.length === 0}
          >
            <FileDown className="h-4 w-4 mr-2" />
            Download Report
          </Button>
          <Filter className="h-4 w-4" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {MAINTENANCE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No maintenance records found"
          description="Start logging maintenance activities to build your record history"
          variant="compact"
        />
      ) : (
        <div className="grid gap-4">
          {filteredRecords.map((record) => (
            <Card key={record.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold">{record.description}</h4>
                      {getMaintenanceTypeBadge(record.maintenance_type)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div><span className="font-medium">Date:</span> {format(parseISO(record.maintenance_date), 'PPP')}</div>
                      <div><span className="font-medium">Performed by:</span> {record.performed_by}</div>
                      {record.cost && (
                        <div><span className="font-medium">Cost:</span> £{record.cost}</div>
                      )}
                      {record.parts_replaced && (
                        <div><span className="font-medium">Parts:</span> {record.parts_replaced}</div>
                      )}
                    </div>

                    {/* Timestamps */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Created: {format(parseISO(record.created_at), 'dd/MM/yyyy HH:mm')}</span>
                      </div>
                      {record.updated_at !== record.created_at && (
                        <div className="flex items-center gap-1">
                          <Edit className="h-3 w-3" />
                          <span>Edited: {format(parseISO(record.updated_at), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                      )}
                    </div>

                    {record.notes && (
                      <div className="text-sm">
                        <span className="font-medium">Notes:</span> {record.notes}
                      </div>
                    )}

                    {/* Documents */}
                    {documents[record.id] && documents[record.id].length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Attachments ({documents[record.id].length})</div>
                        <div className="flex flex-wrap gap-2">
                          {documents[record.id].map((doc) => (
                            <div 
                              key={doc.id} 
                              className="relative group border rounded-md overflow-hidden bg-background cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                              onClick={() => downloadFile(doc)}
                            >
                              {doc.mime_type?.startsWith('image/') && documentUrls[doc.id] ? (
                                <div className="w-20 h-20 relative">
                                  <img
                                    src={documentUrls[doc.id]}
                                    alt={doc.document_name}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <Download className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-20 h-20 flex flex-col items-center justify-center p-2 gap-1">
                                  <FileText className="h-6 w-6 text-muted-foreground" />
                                  <span className="text-[9px] text-center text-muted-foreground line-clamp-2 leading-tight">{doc.document_name}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    {/* Edit Button */}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openEditDialog(record)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedRecord(record)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Maintenance Record Details</DialogTitle>
                          <DialogDescription>
                            Complete details for maintenance performed on {format(parseISO(record.maintenance_date), 'PPP')}
                          </DialogDescription>
                        </DialogHeader>
                        {selectedRecord && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <strong>Type:</strong> {getMaintenanceTypeLabel(selectedRecord.maintenance_type)}
                              </div>
                              <div>
                                <strong>Date:</strong> {format(parseISO(selectedRecord.maintenance_date), 'PPP')}
                              </div>
                              <div>
                                <strong>Performed by:</strong> {selectedRecord.performed_by}
                              </div>
                              {selectedRecord.cost && (
                                <div>
                                  <strong>Cost:</strong> £{selectedRecord.cost}
                                </div>
                              )}
                            </div>
                            
                            <div>
                              <strong>Description:</strong>
                              <p className="mt-1 text-sm">{selectedRecord.description}</p>
                            </div>

                            {selectedRecord.parts_replaced && (
                              <div>
                                <strong>Parts Replaced:</strong>
                                <p className="mt-1 text-sm">{selectedRecord.parts_replaced}</p>
                              </div>
                            )}

                            {selectedRecord.notes && (
                              <div>
                                <strong>Additional Notes:</strong>
                                <p className="mt-1 text-sm">{selectedRecord.notes}</p>
                              </div>
                            )}

                            {documents[selectedRecord.id] && documents[selectedRecord.id].length > 0 && (
                              <div>
                                <strong>Attachments:</strong>
                                <div className="mt-2 space-y-2">
                                  {documents[selectedRecord.id].map((doc) => (
                                    <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                                      <div className="flex items-center space-x-2">
                                        {doc.mime_type?.startsWith('image/') ? (
                                          <Camera className="h-4 w-4 text-blue-500" />
                                        ) : (
                                          <FileText className="h-4 w-4 text-green-500" />
                                        )}
                                        <span className="text-sm">{doc.document_name}</span>
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => downloadFile(doc)}
                                      >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Maintenance Record</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this maintenance record? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(record.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Maintenance Record</DialogTitle>
            <DialogDescription>
              Update the maintenance record details. Changes will be timestamped.
            </DialogDescription>
          </DialogHeader>
          
          {editingRecord && (
            <div className="space-y-4">
              {/* Original timestamp info */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground p-3 bg-muted rounded-md">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Originally created: {format(parseISO(editingRecord.created_at), 'dd/MM/yyyy HH:mm')}</span>
                </div>
                {editingRecord.updated_at !== editingRecord.created_at && (
                  <div className="flex items-center gap-1">
                    <Edit className="h-3 w-3" />
                    <span>Last edited: {format(parseISO(editingRecord.updated_at), 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Maintenance Date */}
                <div className="space-y-2">
                  <Label>Maintenance Date *</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !editFormData.maintenance_date && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {editFormData.maintenance_date ? format(editFormData.maintenance_date, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={editFormData.maintenance_date}
                        onSelect={(date) => {
                          setEditFormData({ ...editFormData, maintenance_date: date || new Date() });
                          setCalendarOpen(false);
                        }}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Maintenance Type */}
                <div className="space-y-2">
                  <Label>Maintenance Type *</Label>
                  <Select
                    value={editFormData.maintenance_type}
                    onValueChange={(value) => setEditFormData({ ...editFormData, maintenance_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select maintenance type" />
                    </SelectTrigger>
                    <SelectContent>
                      {MAINTENANCE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Performed By */}
                <div className="space-y-2">
                  <Label htmlFor="edit_performed_by">Performed By *</Label>
                  <Input
                    id="edit_performed_by"
                    value={editFormData.performed_by}
                    onChange={(e) => setEditFormData({ ...editFormData, performed_by: e.target.value })}
                    placeholder="Name of person who performed maintenance"
                  />
                </div>

                {/* Cost */}
                <div className="space-y-2">
                  <Label htmlFor="edit_cost">Cost (£)</Label>
                  <Input
                    id="edit_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.cost}
                    onChange={(e) => setEditFormData({ ...editFormData, cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="edit_description">Work Description *</Label>
                <Textarea
                  id="edit_description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Describe the maintenance work performed..."
                  rows={3}
                />
              </div>

              {/* Parts Replaced */}
              <div className="space-y-2">
                <Label htmlFor="edit_parts_replaced">Parts Replaced</Label>
                <Textarea
                  id="edit_parts_replaced"
                  value={editFormData.parts_replaced}
                  onChange={(e) => setEditFormData({ ...editFormData, parts_replaced: e.target.value })}
                  placeholder="List any parts that were replaced..."
                  rows={2}
                />
              </div>

              {/* Additional Notes */}
              <div className="space-y-2">
                <Label htmlFor="edit_notes">Additional Notes</Label>
                <Textarea
                  id="edit_notes"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder="Any additional notes or observations..."
                  rows={2}
                />
              </div>

              {/* Existing Documents */}
              {editingRecord && documents[editingRecord.id] && documents[editingRecord.id].length > 0 && (
                <div className="space-y-2">
                  <Label>Existing Attachments ({documents[editingRecord.id].length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {documents[editingRecord.id].map((doc) => (
                      <div key={doc.id} className="flex items-center space-x-2 p-2 border rounded-md bg-background">
                        {doc.mime_type?.startsWith('image/') ? (
                          <Camera className="h-4 w-4 text-blue-500" />
                        ) : (
                          <FileText className="h-4 w-4 text-green-500" />
                        )}
                        <span className="text-xs truncate max-w-32">{doc.document_name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(doc)}
                          className="h-6 w-6 p-0"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Files */}
              <div className="space-y-2">
                <Label>Add New Files</Label>
                
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
                  onChange={handleEditFileUpload}
                  className="hidden"
                  id="edit-file-upload"
                />
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  capture="environment"
                  onChange={handleEditFileUpload}
                  className="hidden"
                  id="edit-camera-upload"
                />

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-16 flex flex-col items-center justify-center gap-1 border-2 border-dashed hover:border-primary/50"
                    onClick={() => document.getElementById('edit-camera-upload')?.click()}
                  >
                    <Camera className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs font-medium">Take Photo</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-16 flex flex-col items-center justify-center gap-1 border-2 border-dashed hover:border-primary/50"
                    onClick={() => document.getElementById('edit-file-upload')?.click()}
                  >
                    <FolderOpen className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs font-medium">Choose File</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Max 10MB per file. Supports: Images, PDF, Word, Excel, Text files
                </p>
              </div>

              {/* New Files Preview */}
              {newFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>New Files to Upload ({newFiles.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {newFiles.map((file, index) => (
                      <div key={index} className="relative group border rounded-md overflow-hidden bg-muted/30 w-16 h-16">
                        {file.type.startsWith('image/') ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-1">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <span className="text-[8px] text-center text-muted-foreground line-clamp-1 mt-0.5">{file.name.split('.').pop()}</span>
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-0.5 right-0.5 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeNewFile(index)}
                        >
                          <X className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Options Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Maintenance Report</DialogTitle>
            <DialogDescription>
              Select a date range for your maintenance report. The report will include your company details, equipment information, and all maintenance records within the selected period.
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

            {/* Preview info */}
            <div className="p-3 bg-muted rounded-md text-sm">
              <p className="font-medium mb-1">Report will include:</p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>• Your company/showman details</li>
                <li>• Equipment details and photo (if available)</li>
                <li>• Summary table of all maintenance records</li>
                <li>• Detailed breakdown of each record</li>
                <li>• Creation and edit timestamps</li>
              </ul>
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

export default MaintenanceHistory;