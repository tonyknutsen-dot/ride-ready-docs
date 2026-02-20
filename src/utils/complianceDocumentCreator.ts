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

  // ── Full-width navy header ──
  const hdrH = 16;
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageW, hdrH, 'F');
  doc.setTextColor(255, 255, 255);

  // Left: brand
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('RIDEREADY DOCS', mL, 7);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('Compliance Management', mL, 11.5);

  // Centre: document title
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPLIANCE COMPLETION RECORD', pageW / 2, 9, { align: 'center' });

  // Right: doc ID + generated timestamp
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text(docId, pageW - mR, 7, { align: 'right' });
  doc.text(generatedAt, pageW - mR, 11.5, { align: 'right' });

  // ── Event title block ──
  y = hdrH + 6;
  doc.setTextColor(30, 58, 95);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(eventName, mL, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(rideName, mL, y);

  // Status badge (green pill) — right-aligned on same line
  const badgeText = 'COMPLETED';
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  const badgeW = doc.getTextWidth(badgeText) + 7;
  const badgeH = 4.5;
  const badgeX = pageW - mR - badgeW;
  const badgeY = y - 3.5;
  doc.setFillColor(22, 120, 55);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(badgeText, badgeX + 3.5, badgeY + 3.2);

  y += 4;
  doc.setDrawColor(190, 190, 190);
  doc.setLineWidth(0.3);
  doc.line(mL, y, pageW - mR, y);
  doc.setLineWidth(0.2);
  y += 4;

  // ── Helpers ──
  const sectionHeader = (title: string) => {
    doc.setFillColor(240, 242, 245);
    doc.rect(mL, y - 1, contentW, 5.5, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text(title, mL + 2, y + 2.8);
    y += 7;
  };

  const valueX = pageW - mR - 2;
  const addRow = (rowLabel: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 110);
    doc.setFontSize(7.5);
    doc.text(rowLabel, mL + 3, y);
    doc.setTextColor(25, 25, 25);
    doc.setFont('helvetica', 'normal');
    doc.text(value, valueX, y, { align: 'right' });
    y += 4.5;
  };

  // ── SECTION: Event Details ──
  sectionHeader('EVENT DETAILS');
  addRow('Event Type', label);
  addRow('Event Name', eventName);
  addRow('Equipment / Ride', rideName);
  addRow('Scheduled Due Date', format(new Date(dueDate), 'dd MMM yyyy'));
  y += 1.5;

  // ── SECTION: Completion Details ──
  sectionHeader('COMPLETION DETAILS');
  addRow('Date Completed', format(completionDate, 'dd MMM yyyy'));
  if (inspectorCompany) addRow('Inspector / Company', inspectorCompany);
  if (certificateReference) addRow('Certificate / Report Ref', certificateReference);
  if (evidenceUrls.length > 0) addRow('Evidence Attached', `${evidenceUrls.length} file(s)`);
  y += 1.5;

  // ── SECTION: Notes ──
  if (notes) {
    sectionHeader('NOTES');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(notes, contentW - 6);
    doc.text(lines, mL + 3, y);
    y += lines.length * 3.8 + 2;
  }

  // ── Compliance statement box ──
  y += 3;
  const boxH = 10;
  doc.setDrawColor(190, 190, 190);
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(mL, y, contentW, boxH, 1.5, 1.5, 'FD');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text(
    'This document confirms completion logging within RideReady Docs.',
    pageW / 2, y + 3.8, { align: 'center' },
  );
  doc.text(
    'Not a substitute for an official inspection certificate.',
    pageW / 2, y + 7.2, { align: 'center' },
  );

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
