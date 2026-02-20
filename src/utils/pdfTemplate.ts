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
export type DocTypeCode = 'CR' | 'IR' | 'NDT' | 'MR' | 'DR';

export const DOC_TYPE_LABELS: Record<DocTypeCode, string> = {
  CR: 'COMPLIANCE COMPLETION RECORD',
  IR: 'INSPECTION RECORD',
  NDT: 'NDT RECORD',
  MR: 'MAINTENANCE RECORD',
  DR: 'DOCUMENT RECORD',
};

export const DOC_TYPE_DISCLAIMERS: Record<DocTypeCode, string> = {
  CR: 'System-generated compliance record. Not a substitute for an official inspection certificate where required.',
  IR: 'System-generated inspection record. Not a substitute for an official inspection certificate where required.',
  NDT: 'System-generated NDT record. Not a substitute for an official inspection certificate where required.',
  MR: 'System-generated maintenance record.',
  DR: 'Stored copy of uploaded document.',
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
