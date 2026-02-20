import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import {
  drawTemplateHeader,
  drawSection,
  drawMetadataRows,
  drawNotesBox,
  drawTemplateFooters,
  checkOverflow,
  generateDocumentId,
  type DocTypeCode,
  DOC_TYPE_LABELS,
} from './pdfTemplate';
import { storeRideDocument, getRideCode } from './rideDocumentService';

/**
 * Maps compliance event category + event_type to a document_type
 * used in the documents table, so it lands in the correct folder
 * on the ride's Documents page.
 */
export function mapEventToDocumentType(category: string, eventType?: string): string {
  const et = (eventType || '').toLowerCase();
  if (category === 'ndt' || et.includes('ndt')) return 'ndt_report';
  if (category === 'maintenance') return 'maintenance_report';
  if (category === 'doc_expiry') {
    if (et.includes('insur')) return 'insurance';
    return 'other';
  }
  if (category === 'inspection') {
    if (et.includes('electrical')) return 'electrical_inspection';
    if (et.includes('in-service') || et.includes('inservice')) return 'inservice_inspection';
    return 'declaration_of_compliance';
  }
  return 'other';
}

/**
 * Maps category to doc type code for document ID generation.
 */
export function categoryToDocTypeCode(category: string, eventType?: string): DocTypeCode {
  const et = (eventType || '').toLowerCase();
  if (category === 'ndt' || et.includes('ndt')) return 'NDT';
  if (category === 'maintenance') return 'MR';
  if (category === 'inspection') return 'IR';
  return 'CR';
}

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
  completedByName?: string;
  completedByRole?: string;
  notes?: string;
  evidenceUrls: string[];
  inspectorCompany?: string;
  certificateReference?: string;
  fullDocumentId?: string;
}

interface CreateComplianceDocumentResult {
  documentId: string;
  documentName: string;
}

export async function createComplianceDocument(
  params: CreateComplianceDocumentParams,
): Promise<CreateComplianceDocumentResult> {
  const {
    eventId, eventName, eventCategory, eventType, rideId, rideName,
    dueDate, completionDate, completedByUserId, completedByName, completedByRole,
    notes, evidenceUrls, inspectorCompany, certificateReference, fullDocumentId,
  } = params;

  const dateStr = format(completionDate, 'dd MMM yyyy');
  const label = friendlyCategory(eventCategory, eventType);
  const documentName = fullDocumentId
    ? `${fullDocumentId} – ${label} – ${dateStr}`
    : `${label} – Completed ${dateStr}`;
  const documentType = mapEventToDocumentType(eventCategory, eventType);

  const hasPdf = evidenceUrls.some((u) => u.toLowerCase().endsWith('.pdf'));
  let filePath: string;

  if (hasPdf) {
    filePath = evidenceUrls.find((u) => u.toLowerCase().endsWith('.pdf'))!;
  } else {
    filePath = await generateCompletionPdf({
      eventName, label, rideName, dueDate, completionDate, notes,
      evidenceUrls, completedByUserId, inspectorCompany,
      certificateReference, fullDocumentId,
      eventCategory, eventType, completedByName, completedByRole,
    });
  }

  const noteParts = [
    inspectorCompany ? `Inspector: ${inspectorCompany}` : null,
    certificateReference ? `Ref: ${certificateReference}` : null,
    notes,
    `Compliance event: ${eventName}`,
    `Due date: ${format(new Date(dueDate), 'dd MMM yyyy')}`,
    `Event ID: ${eventId}`,
    evidenceUrls.length > 0 ? `Evidence files: ${evidenceUrls.length}` : null,
  ].filter(Boolean).join('\n');

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

  // Register in ride_documents for versioned tracking
  if (rideId) {
    const rideCode = await getRideCode(rideId);
    const docTypeCode = categoryToDocTypeCode(eventCategory, eventType);
    const registerId = fullDocumentId || await generateDocumentId(rideId, docTypeCode);
    await storeRideDocument({
      rideId,
      rideCode,
      documentType: 'CR',
      documentId: registerId,
      fileUrl: filePath,
      title: documentName,
      relatedEventId: eventId,
      metadata: { inspectorCompany, certificateReference, category: eventCategory },
    });
  }

  return { documentId: data.id, documentName };
}

/* ------------------------------------------------------------------ */
/*  PDF Generation using unified template                              */
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
  fullDocumentId?: string;
  eventCategory?: string;
  eventType?: string;
  completedByName?: string;
  completedByRole?: string;
}

async function generateCompletionPdf(params: PdfParams): Promise<string> {
  const {
    eventName, label, rideName, dueDate, completionDate, notes,
    evidenceUrls, completedByUserId, inspectorCompany, certificateReference,
    fullDocumentId, eventCategory, eventType, completedByName, completedByRole,
  } = params;

  const docTypeCode = categoryToDocTypeCode(eventCategory || 'compliance', eventType);
  const docTitle = DOC_TYPE_LABELS[docTypeCode] || 'COMPLIANCE COMPLETION RECORD';
  const docId = fullDocumentId || `RRD-CMP-${format(completionDate, 'yyyyMMdd')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const mL = 15;

  const templateOpts = { doc, title: docTitle, documentId: docId, docType: docTypeCode };

  // ── Header ──
  let y = drawTemplateHeader(templateOpts);

  // ── Event title ──
  doc.setTextColor(30, 58, 95);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(eventName, mL, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(rideName, mL, y);
  y += 6;

  // ── Event Details ──
  y = drawSection(doc, 'Event Details', y);
  y = drawMetadataRows(doc, [
    { label: 'Event Type', value: label },
    { label: 'Event Name', value: eventName },
    { label: 'Equipment / Ride', value: rideName },
    { label: 'Scheduled Due Date', value: format(new Date(dueDate), 'dd MMM yyyy') },
  ], y);

  // ── Completion Details ──
  y = drawSection(doc, 'Completion Details', y);
  const completedByDisplay = completedByName
    ? `${completedByName}${completedByRole ? ` (${completedByRole})` : ''}`
    : undefined;
  y = drawMetadataRows(doc, [
    { label: 'Date Completed', value: format(completionDate, 'dd MMM yyyy') },
    { label: 'Completed By', value: completedByDisplay },
    { label: 'Inspector / Company', value: inspectorCompany },
    { label: 'Certificate / Report Ref', value: certificateReference },
    { label: 'Evidence Attached', value: evidenceUrls.length > 0 ? `${evidenceUrls.length} file(s)` : null },
  ], y);

  // ── Notes ──
  if (notes) {
    y = drawSection(doc, 'Notes', y);
    y = drawNotesBox(doc, notes, y);
  }

  // ── Footer ──
  drawTemplateFooters(templateOpts);

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
