/**
 * RideReadyDocs — Unified PDF Document Template
 * ================================================
 * Single reusable template for ALL system-generated PDFs.
 * Every document uses the same navy header, body sections, and footer.
 */

import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { PDF_COLORS, blobToDataUrl } from './pdfUtils';

// ─── Doc type codes ──────────────────────────────────────────────────────────
export type DocTypeCode = 'CR' | 'IR' | 'NDT' | 'MR' | 'DR' | 'TL' | 'CH' | 'IC' | 'RA' | 'WL';

export const DOC_TYPE_LABELS: Record<DocTypeCode, string> = {
  CR: 'COMPLIANCE COMPLETION RECORD',
  IR: 'INSPECTION RECORD',
  NDT: 'NDT RECORD',
  MR: 'MAINTENANCE REPORT',
  DR: 'DOCUMENT RECORD',
  TL: 'EQUIPMENT TIMELINE REPORT',
  CH: 'CHECK RECORDS REPORT',
  IC: 'INSPECTION CHECKLIST',
  RA: 'RISK ASSESSMENT',
  WL: 'WIND SPEED REGISTER',
};

export const DOC_TYPE_DISCLAIMERS: Record<DocTypeCode, string> = {
  CR: 'System-generated compliance record. Not a substitute for an official inspection certificate where required.',
  IR: 'System-generated inspection record. Not a substitute for an official inspection certificate where required.',
  NDT: 'System-generated NDT record. Not a substitute for an official inspection certificate where required.',
  MR: 'System-generated maintenance record.',
  DR: 'Stored copy of uploaded document.',
  TL: 'System-generated equipment timeline report for audit and compliance purposes.',
  CH: 'System-generated check records report for operational monitoring and compliance purposes.',
  IC: 'System-generated inspection checklist record.',
  RA: 'System-generated risk assessment record. Professional judgement must always be applied.',
  WL: 'System-generated wind speed record for operational monitoring and compliance purposes.',
};

// ─── Generate document ID via Supabase RPC ───────────────────────────────────
export async function generateDocumentId(
  rideId: string,
  docType: DocTypeCode,
  year?: number,
): Promise<string> {
  const completionYear = year || new Date().getFullYear();
  const { data, error } = await supabase.rpc('generate_compliance_record_number', {
    p_ride_id: rideId,
    p_completion_year: completionYear,
    p_doc_type: docType,
  });
  if (error || !data) {
    // Fallback — should not happen in normal operation
    const fallback = `RRD-${docType}-${completionYear}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    console.warn('Doc ID generation failed, using fallback:', fallback, error);
    return fallback;
  }
  return data as string;
}

// ─── Template options ────────────────────────────────────────────────────────
export interface PdfTemplateOptions {
  /** The jsPDF instance to draw on */
  doc: jsPDF;
  /** Document title displayed centre of the navy header */
  title: string;
  /** The ride-specific document ID (e.g. TC-CR-2026-0004) */
  documentId: string;
  /** Doc type code for disclaimer selection */
  docType: DocTypeCode;
  /** Custom disclaimer override (optional) */
  disclaimer?: string;
}

// ─── Metadata row type ───────────────────────────────────────────────────────
export interface MetadataField {
  label: string;
  value: string | null | undefined;
}

// ─── Draw the unified navy header bar ────────────────────────────────────────
/**
 * Full-width navy header:
 *   Left:   "RIDEREADY DOCS" brand + subtitle
 *   Centre: Document title (e.g. "MAINTENANCE RECORD")
 *   Right:  Document ID (16pt bold) + generated date/time beneath
 *
 * Returns Y position below the header.
 */
export function drawTemplateHeader(opts: PdfTemplateOptions): number {
  const { doc, title, documentId } = opts;
  const pageW = doc.internal.pageSize.getWidth();
  const mL = 15;
  const mR = 15;
  const hdrH = 22;
  const generatedAt = format(new Date(), "dd MMM yyyy 'at' HH:mm");

  // Navy bar
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageW, hdrH, 'F');
  doc.setTextColor(255, 255, 255);

  // Left: brand
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('RIDEREADY DOCS', mL, 9);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Compliance Management', mL, 14);

  // Centre: document title
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), pageW / 2, 11, { align: 'center' });

  // Right: Document ID prominent
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(documentId, pageW - mR, 10, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(generatedAt, pageW - mR, 16, { align: 'right' });

  doc.setTextColor(0);
  return hdrH + 6;
}

// ─── Draw a section header ──────────────────────────────────────────────────
export function drawSection(doc: jsPDF, title: string, y: number, mL = 15): number {
  const pageW = doc.internal.pageSize.getWidth();
  const mR = 15;
  doc.setFillColor(240, 242, 245);
  doc.rect(mL, y - 1, pageW - mL - mR, 6, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text(title.toUpperCase(), mL + 2, y + 3);
  doc.setTextColor(0);
  return y + 8;
}

// ─── Draw metadata rows (2-column label/value) ──────────────────────────────
export function drawMetadataRows(
  doc: jsPDF,
  fields: MetadataField[],
  y: number,
  mL = 15,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const mR = 15;
  const valueX = pageW - mR - 2;

  for (const field of fields) {
    if (!field.value) continue;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 110);
    doc.setFontSize(8);
    doc.text(field.label, mL + 3, y);
    doc.setTextColor(25, 25, 25);
    doc.setFont('helvetica', 'normal');
    // Truncate long values
    const maxW = valueX - (mL + 3) - 5;
    const truncated = doc.splitTextToSize(String(field.value), maxW)[0] || String(field.value);
    doc.text(truncated, valueX, y, { align: 'right' });
    y += 5;
  }
  return y + 2;
}

// ─── Draw a notes box ───────────────────────────────────────────────────────
export function drawNotesBox(doc: jsPDF, notes: string, y: number, mL = 15): number {
  const pageW = doc.internal.pageSize.getWidth();
  const mR = 15;
  const contentW = pageW - mL - mR;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(8);
  const lines = doc.splitTextToSize(notes, contentW - 8);
  const boxH = lines.length * 4 + 6;

  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(mL, y, contentW, boxH, 1.5, 1.5, 'FD');
  doc.text(lines, mL + 4, y + 4);
  doc.setTextColor(0);
  return y + boxH + 3;
}

// ─── Draw the unified footer on ALL pages ───────────────────────────────────
export function drawTemplateFooters(opts: PdfTemplateOptions): void {
  const { doc, documentId, docType, disclaimer } = opts;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  const disclaimerText = disclaimer || DOC_TYPE_DISCLAIMERS[docType];

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Light grey footer background
    doc.setFillColor(248, 249, 250);
    doc.rect(0, pageH - 18, pageW, 18, 'F');

    // Top divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(15, pageH - 18, pageW - 15, pageH - 18);

    // Disclaimer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(140, 140, 140);
    doc.text(disclaimerText, pageW / 2, pageH - 13, { align: 'center', maxWidth: pageW - 30 });

    // Left: system label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('RideReadyDocs – System-generated record', 15, pageH - 6);

    // Right: page number + doc ID
    doc.text(
      `Page ${i} of ${totalPages}  ·  ${documentId}`,
      pageW - 15,
      pageH - 6,
      { align: 'right' },
    );

    doc.setTextColor(0);
  }
}

// ─── Page overflow helper ───────────────────────────────────────────────────
export function checkOverflow(doc: jsPDF, y: number, needed: number, topMargin = 28): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 22) {
    doc.addPage();
    return topMargin;
  }
  return y;
}

// ─── Audit Trail types ──────────────────────────────────────────────────────
export interface AuditTrailEntry {
  version: number;
  status: 'active' | 'superseded';
  created_at: string;
  created_by_name?: string | null;
  created_by_role?: string | null;
  updated_at?: string | null;
  updated_by_name?: string | null;
  updated_by_role?: string | null;
  edit_reason?: string | null;
}

// ─── Draw Audit Trail section ───────────────────────────────────────────────
export function drawAuditTrail(doc: jsPDF, entries: AuditTrailEntry[], y: number): number {
  const mL = 15;
  const pageW = doc.internal.pageSize.getWidth();
  const mR = 15;
  const contentW = pageW - mL - mR;

  y = checkOverflow(doc, y, 20);
  y = drawSection(doc, 'Audit Trail', y);

  // Column headers
  const cols = [mL + 2, mL + 18, mL + 50, mL + 100, mL + 138];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139); // #64748B
  doc.text('VERSION', cols[0], y);
  doc.text('STATUS', cols[1], y);
  doc.text('CREATED', cols[2], y);
  doc.text('SUPERSEDED', cols[3], y);
  doc.text('REASON', cols[4], y);
  y += 2;

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(mL, y, pageW - mR, y);
  y += 3;

  for (const entry of entries) {
    y = checkOverflow(doc, y, 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(30, 58, 95);
    doc.text(`v${entry.version}`, cols[0], y);

    // Status badge
    if (entry.status === 'active') {
      doc.setFillColor(220, 252, 231); // green-100
      doc.roundedRect(cols[1], y - 2.5, 14, 3.5, 0.8, 0.8, 'F');
      doc.setTextColor(22, 101, 52); // green-800
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text('ACTIVE', cols[1] + 1, y);
    } else {
      doc.setFillColor(241, 245, 249); // slate-100
      doc.roundedRect(cols[1], y - 2.5, 22, 3.5, 0.8, 0.8, 'F');
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.text('SUPERSEDED', cols[1] + 1, y);
    }

    // Created info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(25, 25, 25);
    const createdDate = entry.created_at ? format(new Date(entry.created_at), 'dd MMM yyyy HH:mm') : '—';
    doc.text(createdDate, cols[2], y);

    // Created by on next line
    if (entry.created_by_name) {
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      const byText = entry.created_by_name + (entry.created_by_role ? ` (${entry.created_by_role})` : '');
      doc.text(byText, cols[2], y + 3.5);
    }

    // Superseded date
    if (entry.status === 'superseded' && entry.updated_at) {
      doc.setFontSize(6.5);
      doc.setTextColor(25, 25, 25);
      doc.text(format(new Date(entry.updated_at), 'dd MMM yyyy HH:mm'), cols[3], y);
      if (entry.updated_by_name) {
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        const supByText = entry.updated_by_name + (entry.updated_by_role ? ` (${entry.updated_by_role})` : '');
        doc.text(supByText, cols[3], y + 3.5);
      }
    } else {
      doc.setFontSize(6.5);
      doc.setTextColor(150, 150, 150);
      doc.text('—', cols[3], y);
    }

    // Edit reason
    if (entry.edit_reason) {
      doc.setFontSize(6.5);
      doc.setTextColor(25, 25, 25);
      const maxReasonW = contentW - (cols[4] - mL) - 2;
      const truncReason = doc.splitTextToSize(entry.edit_reason, maxReasonW)[0] || entry.edit_reason;
      doc.text(truncReason, cols[4], y);
    } else {
      doc.setFontSize(6.5);
      doc.setTextColor(150, 150, 150);
      doc.text('—', cols[4], y);
    }

    y += 8;
  }

  doc.setTextColor(0);
  return y + 2;
}

// ─── Fetch company logo as data URL ─────────────────────────────────────────
export async function fetchLogoDataUrl(userId: string): Promise<string | null> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_logo_path')
      .eq('user_id', userId)
      .single();
    if (!profile?.company_logo_path) return null;
    const { data: blob } = await supabase.storage
      .from('ride-documents')
      .download(profile.company_logo_path);
    if (!blob) return null;
    return blobToDataUrl(blob);
  } catch {
    return null;
  }
}
