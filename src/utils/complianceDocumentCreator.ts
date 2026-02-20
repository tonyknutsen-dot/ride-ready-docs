import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

/**
 * Maps compliance event category + event_type to a document_type
 * used in the documents table, so it lands in the correct folder
 * on the ride's Documents page.
 */
export function mapEventToDocumentType(category: string, eventType?: string): string {
  const et = (eventType || '').toLowerCase();

  // NDT
  if (category === 'ndt' || et.includes('ndt')) return 'ndt_report';

  // Maintenance
  if (category === 'maintenance') return 'maintenance_report';

  // Document expiry – decide by event type text
  if (category === 'doc_expiry') {
    if (et.includes('insur')) return 'insurance';
    return 'other'; // "Other Document Expiry"
  }

  // Inspection – map specific sub-types
  if (category === 'inspection') {
    if (et.includes('electrical')) return 'electrical_inspection';
    if (et.includes('in-service') || et.includes('inservice')) return 'inservice_inspection';
    // All other inspections → inspection certificate
    return 'declaration_of_compliance';
  }

  return 'other';
}

/**
 * Human-readable document type label for the generated document title.
 */
function friendlyCategory(category: string, eventType?: string): string {
  const et = (eventType || '').toLowerCase();
  if (category === 'ndt') return 'NDT Inspection';
  if (category === 'maintenance') return 'Maintenance';
  if (category === 'doc_expiry') {
    if (et.includes('insur')) return 'Insurance';
    return 'Document Expiry';
  }
  if (category === 'inspection') {
    if (et.includes('electrical')) return 'Electrical Inspection';
    if (et.includes('in-service') || et.includes('inservice')) return 'In-Service Inspection';
    if (et.includes('annual')) return 'Annual Inspection';
    if (et.includes('structural')) return 'Structural Inspection';
    if (et.includes('mechanical')) return 'Mechanical Inspection';
    if (et.includes('hydraulic')) return 'Hydraulic Inspection';
    if (et.includes('safety')) return 'Safety Inspection';
    return 'Inspection';
  }
  return 'Compliance';
}

interface CreateComplianceDocumentParams {
  eventId: string;
  eventName: string;
  eventCategory: string;
  eventType?: string;
  rideId: string | null;
  rideName: string;
  dueDate: string;
  completionDate: Date;
  completedByUserId: string;
  notes?: string;
  /** Storage paths of evidence files already uploaded */
  evidenceUrls: string[];
  inspectorCompany?: string;
  certificateReference?: string;
}

interface CreateComplianceDocumentResult {
  documentId: string;
  documentName: string;
}

/**
 * Auto-creates a document record in the `documents` table when a compliance
 * event is marked complete. If no PDF file was attached, it generates a simple
 * completion certificate PDF and uploads it.
 */
export async function createComplianceDocument(
  params: CreateComplianceDocumentParams,
): Promise<CreateComplianceDocumentResult> {
  const {
    eventId,
    eventName,
    eventCategory,
    eventType,
    rideId,
    rideName,
    dueDate,
    completionDate,
    completedByUserId,
    notes,
    evidenceUrls,
    inspectorCompany,
    certificateReference,
  } = params;

  const dateStr = format(completionDate, 'dd MMM yyyy');
  const label = friendlyCategory(eventCategory, eventType);
  const documentName = `${label} – Completed ${dateStr}`;
  const documentType = mapEventToDocumentType(eventCategory, eventType);

  // Check if any evidence file is a PDF
  const hasPdf = evidenceUrls.some((u) => u.toLowerCase().endsWith('.pdf'));

  let filePath: string;

  if (hasPdf) {
    // Use the first PDF as the primary document file
    filePath = evidenceUrls.find((u) => u.toLowerCase().endsWith('.pdf'))!;
  } else {
    // Generate a completion certificate PDF
    filePath = await generateCompletionPdf({
      eventName,
      label,
      rideName,
      dueDate,
      completionDate,
      notes,
      evidenceUrls,
      completedByUserId,
      inspectorCompany,
      certificateReference,
    });
  }

  // Build structured notes with inspector/reference for document card display
  const noteParts = [
    inspectorCompany ? `Inspector: ${inspectorCompany}` : null,
    certificateReference ? `Ref: ${certificateReference}` : null,
    notes,
    `Compliance event: ${eventName}`,
    `Due date: ${format(new Date(dueDate), 'dd MMM yyyy')}`,
    `Event ID: ${eventId}`,
    evidenceUrls.length > 0
      ? `Evidence files: ${evidenceUrls.length}`
      : null,
  ].filter(Boolean).join('\n');

  // Create the document record
  const { data, error } = await supabase
    .from('documents')
    .insert({
      document_name: documentName,
      document_type: documentType,
      file_path: filePath,
      ride_id: rideId,
      user_id: completedByUserId,
      notes: noteParts,
      mime_type: 'application/pdf',
    })
    .select('id')
    .single();

  if (error) throw error;

  return { documentId: data.id, documentName };
}

/* ------------------------------------------------------------------ */
/*  PDF Generation                                                     */
/* ------------------------------------------------------------------ */

interface PdfParams {
  eventName: string;
  label: string;
  rideName: string;
  dueDate: string;
  completionDate: Date;
  notes?: string;
  evidenceUrls: string[];
  completedByUserId: string;
  inspectorCompany?: string;
  certificateReference?: string;
}

async function generateCompletionPdf(params: PdfParams): Promise<string> {
  const {
    eventName,
    label,
    rideName,
    dueDate,
    completionDate,
    notes,
    evidenceUrls,
    completedByUserId,
    inspectorCompany,
    certificateReference,
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header bar
  doc.setFillColor(30, 58, 95); // navy
  doc.rect(0, 0, pageW, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPLIANCE COMPLETION RECORD', pageW / 2, 9, { align: 'center' });

  // Title
  y = 24;
  doc.setTextColor(30, 58, 95);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(label, 15, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(eventName, 15, y);
  y += 10;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(15, y, pageW - 15, y);
  y += 8;

  // Details grid
  const addRow = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text(label.toUpperCase(), 15, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.text(value, 65, y);
    y += 7;
  };

  addRow('Equipment', rideName);
  addRow('Due Date', format(new Date(dueDate), 'dd MMM yyyy'));
  addRow('Completed', format(completionDate, 'dd MMM yyyy'));
  addRow('Status', 'COMPLETED');
  if (inspectorCompany) addRow('Inspector / Company', inspectorCompany);
  if (certificateReference) addRow('Reference', certificateReference);

  if (evidenceUrls.length > 0) {
    addRow('Evidence', `${evidenceUrls.length} file(s) attached`);
  }

  y += 4;

  // Notes
  if (notes) {
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y, pageW - 15, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text('NOTES', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(notes, pageW - 30);
    doc.text(lines, 15, y);
    y += lines.length * 5 + 4;
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text(
    `Generated by RideReady Docs · ${format(new Date(), "dd MMM yyyy 'at' HH:mm")}`,
    pageW / 2,
    footerY,
    { align: 'center' },
  );

  // Upload PDF
  const pdfBlob = doc.output('blob');
  const safeName = rideName.replace(/[^a-z0-9]/gi, '_');
  const safeLabel = label.replace(/[^a-z0-9]/gi, '_');
  const path = `${completedByUserId}/compliance/${safeLabel}_${safeName}_${format(completionDate, 'yyyyMMdd')}.pdf`;

  const { error } = await supabase.storage
    .from('ride-documents')
    .upload(path, pdfBlob, { contentType: 'application/pdf', upsert: true });

  if (error) throw error;

  return path;
}
