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
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 15;
  const mR = 15;
  const contentW = pageW - mL - mR;
  let y = 0;

  // Auto-generated document ID
  const docId = `RRD-CMP-${format(completionDate, 'yyyyMMdd')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const generatedAt = format(new Date(), "dd MMM yyyy 'at' HH:mm");

  // ── Header bar ──
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageW, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('RIDEREADY DOCS', mL, 8);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Compliance Management', mL, 13);

  // Right side: doc ID + timestamp
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(docId, pageW - mR, 8, { align: 'right' });
  doc.text(generatedAt, pageW - mR, 13, { align: 'right' });

  y = 24;

  // ── Document title ──
  doc.setTextColor(30, 58, 95);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPLIANCE COMPLETION RECORD', mL, y);
  y += 5;

  // Status badge (green pill)
  const badgeText = 'COMPLETED';
  doc.setFontSize(7);
  const badgeW = doc.getTextWidth(badgeText) + 8;
  const badgeH = 5;
  doc.setFillColor(34, 139, 34);
  doc.roundedRect(mL, y, badgeW, badgeH, 2.5, 2.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(badgeText, mL + 4, y + 3.5);
  y += 10;

  // ── Helper: section header ──
  const sectionHeader = (title: string) => {
    doc.setDrawColor(200, 200, 200);
    doc.line(mL, y, pageW - mR, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text(title, mL, y);
    y += 4;
  };

  // ── Helper: 2-column row ──
  const valueX = pageW - mR;
  const addRow = (rowLabel: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text(rowLabel, mL + 2, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(value, valueX, y, { align: 'right' });
    y += 5;
  };

  // ── SECTION: Event Details ──
  sectionHeader('EVENT DETAILS');
  addRow('Event Type', label);
  addRow('Event Name', eventName);
  addRow('Equipment / Ride', rideName);
  addRow('Scheduled Due Date', format(new Date(dueDate), 'dd MMM yyyy'));
  y += 2;

  // ── SECTION: Completion Details ──
  sectionHeader('COMPLETION DETAILS');
  addRow('Date Completed', format(completionDate, 'dd MMM yyyy'));
  if (inspectorCompany) addRow('Inspector / Company', inspectorCompany);
  if (certificateReference) addRow('Certificate / Report Ref', certificateReference);
  if (evidenceUrls.length > 0) addRow('Evidence Attached', `${evidenceUrls.length} file(s)`);
  y += 2;

  // ── SECTION: Notes ──
  if (notes) {
    sectionHeader('NOTES');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(notes, contentW - 4);
    doc.text(lines, mL + 2, y);
    y += lines.length * 4 + 2;
  }

  // ── Closing divider ──
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(mL, y, pageW - mR, y);

  // ── Footer ──
  doc.setFontSize(6.5);
  doc.setTextColor(140, 140, 140);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'System-generated compliance record. Not a substitute for an official inspection certificate.',
    pageW / 2,
    pageH - 14,
    { align: 'center' },
  );
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${docId}  ·  RideReady Docs  ·  Page 1 of 1`,
    pageW / 2,
    pageH - 9,
    { align: 'center' },
  );

  // ── Upload PDF ──
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
