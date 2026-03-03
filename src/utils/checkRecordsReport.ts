/**
 * Check Records Report — PDF & CSV Generator
 * ============================================
 * Produces a formal, defensible Check Records report for sharing with
 * insurers, regulators, clients, and internal review.
 *
 * Uses the unified PDF template system (pdfTemplate) — same header,
 * section, footer, and typography as all other app reports.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { InspectionRecord, FetchRecordsFilters, ItemResultSnapshot } from './inspectionRecordService';
import {
  PDF_COLORS,
  buildFileName,
  blobToDataUrl,
  drawEquipmentDetails,
  drawSummaryBox,
  PDF_TABLE_HEAD_STYLES,
  PDF_TABLE_BODY_STYLES,
  PDF_TABLE_ALT_ROW,
} from './pdfUtils';
import {
  generateDocumentId,
  checkOverflow,
  drawTemplateHeader,
  drawTemplateFooters,
  drawSection,
  drawMetadataRows,
  type DocTypeCode,
  type PdfTemplateOptions,
} from './pdfTemplate';
import { storeRideDocument, getRideCode } from './rideDocumentService';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CheckRecordsReportOptions {
  rideId: string;
  rideName: string;
  userId: string;
  effectiveUserId: string;
  filters: FetchRecordsFilters;
  records: InspectionRecord[];
  periodLabel?: string;
}

interface ReportStats {
  total: number;
  passed: number;
  failed: number;
  partial: number;
  withDefects: number;
  withNotes: number;
  withPhotos: number;
  passRate: number;
  templateNames: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeStats(records: InspectionRecord[]): ReportStats {
  const total = records.length;
  const passed = records.filter(r => deriveOverallResult(r) === 'passed').length;
  const failed = records.filter(r => deriveOverallResult(r) === 'failed').length;
  const partial = total - passed - failed;
  const withDefects = records.filter(r => (r.defect_ids?.length || 0) > 0).length;
  const withNotes = records.filter(r => !!r.notes).length;
  const withPhotos = records.filter(r => (r.photo_paths?.length || 0) > 0).length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  const templateSet = new Set<string>();
  records.forEach(r => {
    if (r.template_name) templateSet.add(neutraliseTemplateName(r.template_name));
  });

  return { total, passed, failed, partial, withDefects, withNotes, withPhotos, passRate, templateNames: Array.from(templateSet) };
}

/** Neutralise legacy "Safety Check" naming in template names */
function neutraliseTemplateName(name: string): string {
  return name
    .replace(/\bSafety\s+Check\b/gi, 'Check')
    .replace(/\bDaily\s+Safety\s+Check\b/gi, 'Daily Check')
    .replace(/\bPre-?opening\s+Safety\s+Check\b/gi, 'Pre-Opening Check')
    .replace(/\bWeekly\s+Safety\s+Check\b/gi, 'Weekly Check')
    .replace(/\bMonthly\s+Safety\s+Check\b/gi, 'Monthly Check')
    .replace(/\bYearly\s+Safety\s+Check\b/gi, 'Yearly Check');
}

function formatFrequency(freq: string): string {
  switch (freq) {
    case 'daily': return 'Daily';
    case 'preopening': return 'Pre-Opening';
    case 'weekly': return 'Weekly';
    case 'monthly': return 'Monthly';
    case 'yearly': return 'Yearly';
    default: return freq.charAt(0).toUpperCase() + freq.slice(1);
  }
}

function formatResult(result: string): string {
  if (result === 'completed') return 'Passed';
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Derive the true overall result from item-level results.
 * If item_results exist, recalculate; otherwise fall back to stored result.
 */
function deriveOverallResult(record: InspectionRecord): string {
  const items = (record.item_results || []) as ItemResultSnapshot[];
  if (items.length === 0) return record.overall_result;

  const applicable = items.filter(i => i.result !== 'na');
  if (applicable.length === 0) return record.overall_result; // all N/A — use stored

  const hasFail = applicable.some(i => i.result === 'fail');
  const allPass = applicable.every(i => i.result === 'pass');

  if (hasFail) return 'failed';
  if (allPass) return 'passed';
  return 'partial';
}

function buildFiltersSummary(filters: FetchRecordsFilters): string[] {
  const parts: string[] = [];
  if (filters.result && filters.result !== 'all') {
    parts.push(`Result: ${filters.result.charAt(0).toUpperCase() + filters.result.slice(1)}`);
  }
  if (filters.hasDefects === true) parts.push('Defects: With defects only');
  if (filters.hasDefects === false) parts.push('Defects: No defects only');
  if (filters.inspectorName) parts.push(`Recorded by: ${filters.inspectorName}`);
  if (filters.searchQuery) parts.push(`Search: "${filters.searchQuery}"`);
  return parts;
}

function itemResultLabel(result: string): string {
  switch (result) {
    case 'pass': return 'Pass';
    case 'fail': return 'Fail';
    case 'na': return 'N/A';
    default: return result;
  }
}

// ─── PDF Generator ───────────────────────────────────────────────────────────

export async function generateCheckRecordsPdf(opts: CheckRecordsReportOptions): Promise<{ blob: Blob; fileName: string; storagePath: string | null }> {
  const { rideId, rideName, userId, effectiveUserId, filters, records } = opts;
  const doc = new jsPDF();
  const docId = await generateDocumentId(rideId, 'CH');
  const stats = computeStats(records);
  const generatedAt = format(new Date(), "dd MMM yyyy 'at' HH:mm");
  const docType: DocTypeCode = 'CH';

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name, showmen_name, controller_name, company_logo_path')
    .eq('user_id', userId)
    .single();

  const companyName = profile?.company_name || profile?.showmen_name || '';
  const controllerName = profile?.controller_name || null;

  // Period label
  const periodLabel = opts.periodLabel ||
    (filters.dateFrom && filters.dateTo
      ? `${filters.dateFrom} – ${filters.dateTo}`
      : filters.dateFrom
        ? `From ${filters.dateFrom}`
        : filters.dateTo
          ? `To ${filters.dateTo}`
          : 'All records');

  // ── Template options (shared for header + footer) ──
  const templateOpts: PdfTemplateOptions = {
    doc,
    title: 'CHECK RECORDS',
    documentId: docId,
    docType,
  };

  // ── Page 1: Unified header (same as all other reports) ──
  let y = drawTemplateHeader(templateOpts);

  // ── Metadata section ──
  y = drawSection(doc, 'Report Details', y);
  y = drawMetadataRows(doc, [
    { label: 'Company', value: companyName },
    { label: 'Controller / Duty Holder', value: controllerName },
    { label: 'Equipment', value: rideName },
    { label: 'Report Period', value: periodLabel },
    { label: 'Generated', value: generatedAt },
    { label: 'Document ID', value: docId },
  ], y);

  // ── Summary metrics ──
  y = drawSection(doc, 'Summary', y);

  y = drawSummaryBox(doc, [
    { label: 'Total Records', value: String(stats.total) },
    { label: 'Passed', value: String(stats.passed), accent: true },
    { label: 'Failed', value: String(stats.failed) },
    { label: 'Partial', value: String(stats.partial) },
  ], y, 15);

  y = drawSummaryBox(doc, [
    { label: 'With Defects', value: String(stats.withDefects) },
    { label: 'With Notes', value: String(stats.withNotes) },
    { label: 'With Attachments', value: String(stats.withPhotos) },
    { label: 'Pass Rate', value: `${stats.passRate}%`, accent: true },
  ], y, 15);

  // Templates used — as metadata row
  if (stats.templateNames.length > 0) {
    y = drawMetadataRows(doc, [
      { label: 'Templates Used', value: stats.templateNames.join(', ') },
    ], y);
  }

  // ── Filters applied (only if non-default filters) ──
  const filterLines = buildFiltersSummary(filters);
  if (filterLines.length > 0) {
    y = drawSection(doc, 'Filters Applied', y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.body);
    for (const line of filterLines) {
      y = checkOverflow(doc, y, 5);
      doc.text(`• ${line}`, 17, y);
      y += 4.5;
    }
    y += 2;
  }

  // ── Records overview table ──
  y = checkOverflow(doc, y, 30);
  y = drawSection(doc, 'Records Overview', y);

  const tableBody = records.map(record => {
    const defectCount = record.defect_ids?.length || 0;
    const dateStr = format(parseISO(record.check_date), 'dd/MM/yy');
    const timeStr = format(parseISO(record.completed_at), 'HH:mm');
    const freq = formatFrequency(record.check_frequency);
    const result = formatResult(deriveOverallResult(record));
    const template = record.template_name ? neutraliseTemplateName(record.template_name) : '—';
    const location = record.location || '—';

    return [dateStr, timeStr, freq, result, record.inspector_name, location, defectCount > 0 ? String(defectCount) : '—'];
  });

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Time', 'Type', 'Result', 'Recorded By', 'Location', 'Def.']],
    body: tableBody,
    headStyles: { ...PDF_TABLE_HEAD_STYLES, fontSize: 7 },
    styles: { ...PDF_TABLE_BODY_STYLES, fontSize: 6.5 },
    alternateRowStyles: PDF_TABLE_ALT_ROW,
    columnStyles: {
      0: { cellWidth: 17 },
      1: { cellWidth: 12 },
      2: { cellWidth: 22 },
      3: { cellWidth: 15 },
      4: { cellWidth: 34 },
      5: { cellWidth: 50 },
      6: { cellWidth: 14, halign: 'center' as const },
    },
    margin: { left: 15, right: 15 },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 3) {
        const val = data.cell.text?.[0]?.toLowerCase();
        if (val === 'passed') {
          data.cell.styles.textColor = PDF_COLORS.green;
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'failed') {
          data.cell.styles.textColor = PDF_COLORS.red;
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'partial') {
          data.cell.styles.textColor = PDF_COLORS.amber;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Detailed Check Records ──
  // This is the key defensible section — shows every checklist item for each record
  y = checkOverflow(doc, y, 30);
  y = drawSection(doc, 'Detailed Check Records', y);

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const defectCount = record.defect_ids?.length || 0;
    const dateStr = format(parseISO(record.check_date), 'dd/MM/yyyy');
    const timeStr = format(parseISO(record.completed_at), 'HH:mm');
    const result = formatResult(deriveOverallResult(record));
    const template = record.template_name ? neutraliseTemplateName(record.template_name) : '—';
    const freq = formatFrequency(record.check_frequency);
    const location = record.location || '';

    // Need at least ~50pt for the record header + a few item rows
    y = checkOverflow(doc, y, 50);

    // Record header bar — styled panel
    const pageW = doc.internal.pageSize.getWidth();
    const mL = 15;
    const mR = 15;
    const barW = pageW - mL - mR;

    doc.setFillColor(240, 242, 245);
    doc.rect(mL, y - 1, barW, 18, 'F');
    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.3);
    doc.rect(mL, y - 1, barW, 18, 'S');

    // Record number
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 95);
    doc.text(`Record ${i + 1} of ${records.length}`, mL + 3, y + 4);

    // Result badge
    if (result === 'Passed') doc.setTextColor(...PDF_COLORS.green);
    else if (result === 'Failed') doc.setTextColor(...PDF_COLORS.red);
    else doc.setTextColor(...PDF_COLORS.amber);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(result.toUpperCase(), pageW - mR - 3, y + 4, { align: 'right' });

    // Date/time/details row
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.body);
    doc.text(`${dateStr}  ${timeStr}  ·  ${freq}  ·  ${template}  ·  Recorded by: ${record.inspector_name}`, mL + 3, y + 10);

    // Location row
    if (location) {
      doc.text(`Location: ${location}`, mL + 3, y + 14.5);
    }

    y += 21;

    // Defects indicator
    if (defectCount > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...PDF_COLORS.red);
      doc.text(`⚠ ${defectCount} defect${defectCount !== 1 ? 's' : ''} raised`, mL + 3, y);
      y += 5;
    }

    // Notes
    if (record.notes) {
      y = checkOverflow(doc, y, 8);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(...PDF_COLORS.muted);
      const noteLines = doc.splitTextToSize(`Notes: ${record.notes}`, barW - 6);
      doc.text(noteLines, mL + 3, y);
      y += noteLines.length * 3.5 + 2;
    }

    // Attachments indicator
    const photoCount = record.photo_paths?.length || 0;
    if (photoCount > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(`📎 ${photoCount} attachment${photoCount !== 1 ? 's' : ''}`, mL + 3, y);
      y += 4;
    }

    // ── Check items table — the core defensible evidence ──
    const items = (record.item_results || []) as ItemResultSnapshot[];
    if (items.length > 0) {
      y = checkOverflow(doc, y, 15);

      const itemRows = items.map(item => [
        item.check_item_text || '',
        itemResultLabel(item.result),
        item.notes || '',
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Check Item', 'Result', 'Notes']],
        body: itemRows,
        headStyles: {
          ...PDF_TABLE_HEAD_STYLES,
          fontSize: 7,
          cellPadding: 2,
        },
        styles: {
          ...PDF_TABLE_BODY_STYLES,
          fontSize: 7,
          cellPadding: 2,
        },
        alternateRowStyles: PDF_TABLE_ALT_ROW,
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: 18, halign: 'center' as const },
          2: { cellWidth: 62 },
        },
        margin: { left: mL, right: mR },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 1) {
            const val = data.cell.text?.[0];
            if (val === 'Pass') {
              data.cell.styles.textColor = PDF_COLORS.green;
              data.cell.styles.fontStyle = 'bold';
            } else if (val === 'Fail') {
              data.cell.styles.textColor = PDF_COLORS.red;
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = PDF_COLORS.muted;
            }
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 6;
    } else {
      // No items recorded
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text('No individual check items recorded for this check.', mL + 3, y);
      y += 6;
    }

    // Separator between records (except last)
    if (i < records.length - 1) {
      y = checkOverflow(doc, y, 8);
      doc.setDrawColor(...PDF_COLORS.border);
      doc.setLineWidth(0.3);
      doc.line(mL, y, pageW - mR, y);
      y += 5;
    }
  }

  // ── Unified footer on all pages (same as all other reports) ──
  drawTemplateFooters(templateOpts);

  // ── Save to storage ──
  const pdfBlob = doc.output('blob');
  const fileName = buildFileName([rideName, 'Check_Records', format(new Date(), 'yyyyMMdd')]);
  const storagePath = `${effectiveUserId}/check-records-reports/${rideId}/${Date.now()}-${fileName}`;

  let savedPath: string | null = null;
  try {
    const { error: uploadError } = await supabase.storage
      .from('ride-documents')
      .upload(storagePath, pdfBlob, { contentType: 'application/pdf', upsert: true });

    if (!uploadError) {
      savedPath = storagePath;
      const rideCode = await getRideCode(rideId);
      await storeRideDocument({
        rideId,
        rideCode,
        documentType: 'CH',
        documentId: docId,
        fileUrl: storagePath,
        title: `Check Records – ${rideName} – ${format(new Date(), 'dd MMM yyyy')}`,
        metadata: { checkCount: stats.total, passRate: stats.passRate, period: periodLabel },
      });
    }
  } catch (_) { /* non-fatal */ }

  return { blob: pdfBlob, fileName, storagePath: savedPath };
}

// ─── CSV Generator ───────────────────────────────────────────────────────────

export function generateCheckRecordsCsv(records: InspectionRecord[], rideName: string): { blob: Blob; fileName: string } {
  const headers = [
    'Date', 'Time', 'Check Type', 'Template', 'Result',
    'Recorded By', 'Defects', 'Notes', 'Weather', 'Location',
    'Version', 'Record ID',
  ];

  const rows = records.map(record => [
    format(parseISO(record.check_date), 'dd/MM/yyyy'),
    format(parseISO(record.completed_at), 'HH:mm'),
    formatFrequency(record.check_frequency),
    record.template_name ? neutraliseTemplateName(record.template_name) : '',
    formatResult(deriveOverallResult(record)),
    record.inspector_name,
    String(record.defect_ids?.length || 0),
    record.notes || '',
    record.weather_conditions || '',
    record.location || '',
    `v${record.version}`,
    record.id,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const fileName = `Check-Records-${rideName.replace(/[^a-zA-Z0-9]/g, '_')}-${format(new Date(), 'yyyy-MM-dd')}.csv`;

  return { blob, fileName };
}
