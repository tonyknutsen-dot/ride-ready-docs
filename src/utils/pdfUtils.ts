/**
 * RideReadyDocs — Shared PDF Utility
 * ====================================
 * Centralised styling constants and helper functions used by all PDF generators.
 * Every document produced by the system must use these building blocks to ensure
 * a consistent, regulator-ready, court-defensible appearance.
 */

import jsPDF from 'jspdf';
import { format } from 'date-fns';

// ─── Brand colour palette ─────────────────────────────────────────────────────
export const PDF_COLORS = {
  navy:        [30, 58, 95]   as [number, number, number], // #1E3A5F — headers, dividers
  title:       [15, 23, 42]   as [number, number, number], // #0F172A — page titles
  body:        [51, 65, 85]   as [number, number, number], // #334155 — body text
  muted:       [100, 116, 139] as [number, number, number],// #64748B — labels
  border:      [226, 232, 240] as [number, number, number],// #E2E8F0 — borders
  panelBg:     [248, 250, 252] as [number, number, number],// #F8FAFC — panel bg
  white:       [255, 255, 255] as [number, number, number],
  green:       [22, 163, 74]  as [number, number, number], // pass
  amber:       [217, 119, 6]  as [number, number, number], // warning
  red:         [185, 28, 28]  as [number, number, number], // fail / high risk
};

// ─── Document-ID prefix map ───────────────────────────────────────────────────
export type DocIdPrefix = 'MAINT' | 'RISK' | 'CHECK' | 'DEFECT' | 'INSPECT' | 'TIMELINE' | 'WIND';

let _docIdCounter = 0;
export function generateDocId(prefix: DocIdPrefix): string {
  _docIdCounter = (Math.floor(Math.random() * 900000) + 100000);
  return `RRD-${prefix}-${String(_docIdCounter).padStart(6, '0')}`;
}

// ─── Standard file-name formatter ────────────────────────────────────────────
export function buildFileName(parts: string[]): string {
  return parts
    .map(p => p.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''))
    .filter(Boolean)
    .join('_') + '.pdf';
}

// ─── Logo / image loader ──────────────────────────────────────────────────────
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

/** Returns { w, h } capped inside maxW × maxH while preserving aspect ratio */
export function fitImage(
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  const ar = naturalW / naturalH;
  if (ar > maxW / maxH) {
    return { w: maxW, h: maxW / ar };
  }
  return { h: maxH, w: maxH * ar };
}

/** Resolves natural dimensions of a data-URL image */
export async function getImageDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

// ─── Header ──────────────────────────────────────────────────────────────────
/**
 * Draws the standard 3-column header (logo | company info | doc meta)
 * and the 2 px brand-navy authority divider.
 *
 * Returns the Y position immediately below the divider.
 */
export interface HeaderOptions {
  doc: jsPDF;
  logoDataUrl?: string | null;
  companyName: string;
  controllerName?: string | null;
  reportTitle: string;
  subTitle?: string;
  docId?: string;
  period?: string;
  generatedDate?: string;
}

export function drawPDFHeader(opts: HeaderOptions): number {
  const { doc, logoDataUrl, companyName, controllerName, reportTitle, subTitle, docId, period, generatedDate } = opts;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 14;

  // ── Logo (left) ──
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'AUTO', 13, y - 2, 18, 18);
    } catch (_) { /* silently skip */ }
  }

  // ── Company block (center) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...PDF_COLORS.title);
  doc.text(companyName, pageWidth / 2, y + 4, { align: 'center' });

  if (controllerName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(`Controller / Duty Holder: ${controllerName}`, pageWidth / 2, y + 10, { align: 'center' });
  }

  // ── Right-side meta block ──
  const metaX = pageWidth - 13;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.navy);
  doc.text(reportTitle, metaX, y + 2, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_COLORS.muted);

  let metaY = y + 7;
  if (period) {
    doc.text(period, metaX, metaY, { align: 'right' });
    metaY += 4;
  }
  if (generatedDate) {
    doc.text(`Generated: ${generatedDate}`, metaX, metaY, { align: 'right' });
    metaY += 4;
  }
  if (docId) {
    doc.text(`Doc ID: ${docId}`, metaX, metaY, { align: 'right' });
  }

  // ── 2 px navy authority divider ──
  y += 22;
  doc.setDrawColor(...PDF_COLORS.navy);
  doc.setLineWidth(1.2);
  doc.line(13, y, pageWidth - 13, y);
  doc.setLineWidth(0.4);
  doc.setDrawColor(...PDF_COLORS.border);

  return y + 7; // return start-y for content below header
}

// ─── Section title ────────────────────────────────────────────────────────────
/**
 * Draws an uppercase navy section title with a thin underline.
 * Returns Y after the underline.
 */
export function drawSectionTitle(doc: jsPDF, title: string, y: number, margin = 13): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.navy);
  // character spacing trick — we approximate with letter spacing via text
  doc.text(title.toUpperCase(), margin, y);

  y += 3;
  doc.setDrawColor(...PDF_COLORS.navy);
  doc.setLineWidth(0.4);
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineWidth(0.3);
  doc.setDrawColor(...PDF_COLORS.border);

  return y + 5;
}

// ─── Equipment details block (left info + optional right image) ───────────────
export interface EquipmentDetailsOptions {
  doc: jsPDF;
  y: number;
  margin?: number;
  fields: Array<{ label: string; value: string | null | undefined }>;
  imageDataUrl?: string | null;
  maxImageW?: number;
  maxImageH?: number;
}

/** Draws the equipment detail grid. Returns the new Y position. */
export async function drawEquipmentDetails(opts: EquipmentDetailsOptions): Promise<number> {
  const { doc, margin = 13, fields, imageDataUrl, maxImageW = 40, maxImageH = 30 } = opts;
  let { y } = opts;
  const pageWidth = doc.internal.pageSize.getWidth();
  const labelWidth = 34;
  const leftCol = margin + 3;

  // Resolve image dimensions
  let imgW = maxImageW;
  let imgH = maxImageH;
  const imageX = pageWidth - margin - maxImageW - 2;
  const imageStartY = y;

  if (imageDataUrl) {
    try {
      const dims = await getImageDimensions(imageDataUrl);
      const fit = fitImage(dims.w, dims.h, maxImageW, maxImageH);
      imgW = fit.w;
      imgH = fit.h;
    } catch (_) { /* ignore */ }
  }

  // Equipment fields
  for (const field of fields) {
    if (!field.value) continue;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(`${field.label}:`, leftCol, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.title);
    doc.text(String(field.value), leftCol + labelWidth, y);
    y += 6;
  }

  // Image on the right with subtle border
  if (imageDataUrl) {
    try {
      const imgXActual = pageWidth - margin - imgW - 2;
      doc.setDrawColor(...PDF_COLORS.border);
      doc.setLineWidth(0.4);
      doc.rect(imgXActual - 1, imageStartY - 1, imgW + 2, imgH + 2);
      doc.addImage(imageDataUrl, 'JPEG', imgXActual, imageStartY, imgW, imgH);
      y = Math.max(y, imageStartY + imgH + 4);
    } catch (_) { /* ignore */ }
  }

  return y + 4;
}

// ─── Summary metrics box ──────────────────────────────────────────────────────
export interface SummaryMetric {
  label: string;
  value: string;
  accent?: boolean; // draws the metric in navy instead of black
}

/**
 * Draws a light grey rounded summary box with N metrics.
 * Returns Y below the box.
 */
export function drawSummaryBox(
  doc: jsPDF,
  metrics: SummaryMetric[],
  y: number,
  margin = 13,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxW = pageWidth - margin * 2;
  const boxH = 20;
  const colW = boxW / metrics.length;

  // Box background
  doc.setFillColor(...PDF_COLORS.panelBg);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, boxW, boxH, 2, 2, 'FD');

  metrics.forEach((metric, i) => {
    const mx = margin + colW * i + colW / 2;

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(metric.label, mx, y + 6, { align: 'center' });

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...(metric.accent ? PDF_COLORS.navy : PDF_COLORS.title));
    doc.text(metric.value, mx, y + 15, { align: 'center' });
  });

  doc.setTextColor(...PDF_COLORS.body);
  return y + boxH + 7;
}

// ─── Standard autoTable head styles ──────────────────────────────────────────
export const PDF_TABLE_HEAD_STYLES = {
  fillColor: PDF_COLORS.navy,
  textColor: [255, 255, 255] as [number, number, number],
  fontStyle: 'bold' as const,
  fontSize: 8.5,
  cellPadding: 3,
};

export const PDF_TABLE_BODY_STYLES = {
  fontSize: 8,
  cellPadding: 3,
  textColor: PDF_COLORS.title,
  lineColor: PDF_COLORS.border,
  lineWidth: 0.25,
};

export const PDF_TABLE_ALT_ROW = { fillColor: PDF_COLORS.panelBg };

// ─── Footer (all pages) ───────────────────────────────────────────────────────
/**
 * Stamps every page with the standard footer:
 *   left: Generated timestamp | center: ridereadydocs.com | right: Page N of T
 * Must be called AFTER all content has been added (so page count is final).
 */
export function drawAllPageFooters(doc: jsPDF, docId?: string): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  const generatedStr = format(new Date(), "dd MMM yyyy '–' HH:mm");

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Divider
    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.4);
    doc.line(13, pageHeight - 18, pageWidth - 13, pageHeight - 18);

    // Legal disclaimer line
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(
      'This document has been generated from digitally recorded records stored within the RideReadyDocs compliance system. Records are time-stamped and form part of the equipment\'s statutory maintenance and safety history.',
      pageWidth / 2,
      pageHeight - 13,
      { align: 'center', maxWidth: pageWidth - 26 },
    );

    // Meta row
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${generatedStr}`, 13, pageHeight - 7);
    doc.text('ridereadydocs.com', pageWidth / 2, pageHeight - 7, { align: 'center' });
    doc.text(
      `Page ${i} of ${totalPages}${docId ? `  ·  ${docId}` : ''}`,
      pageWidth - 13,
      pageHeight - 7,
      { align: 'right' },
    );

    doc.setTextColor(0);
  }
}

// ─── Compliance statement block ───────────────────────────────────────────────
/**
 * Draws the standard compliance/legal statement paragraph.
 * Returns Y after the block.
 */
export function drawComplianceStatement(doc: jsPDF, y: number, margin = 13): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const text =
    'This document has been generated from digitally recorded maintenance records stored within the RideReadyDocs compliance system. ' +
    'Records are time-stamped and form part of the equipment\'s statutory maintenance and safety history and should be retained for inspection and regulatory review.';

  doc.setFillColor(...PDF_COLORS.panelBg);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.4);

  const lines = doc.splitTextToSize(text, pageWidth - margin * 2 - 8);
  const boxH = lines.length * 4 + 10;
  doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(lines, margin + 4, y + 7);

  doc.setTextColor(0);
  return y + boxH + 6;
}

// ─── Page overflow guard ──────────────────────────────────────────────────────
/** Returns a helper that adds a new page when remaining space is insufficient */
export function makePageOverflowGuard(doc: jsPDF, topMargin = 20) {
  return (neededSpace: number): number => {
    const pageHeight = doc.internal.pageSize.getHeight();
    const currentY = (doc as any).lastAutoTable?.finalY ?? topMargin;
    if (currentY + neededSpace > pageHeight - 28) {
      doc.addPage();
      return topMargin;
    }
    return currentY;
  };
}
