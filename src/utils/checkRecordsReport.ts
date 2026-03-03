/**
 * Check Records Report — PDF & CSV Generator
 * ============================================
 * Produces a formal, defensible Check Records report for sharing with
 * insurers, regulators, clients, and internal review.
 *
 * Uses the unified PDF template system (pdfUtils + pdfTemplate).
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { InspectionRecord, FetchRecordsFilters } from './inspectionRecordService';
import { fetchInspectionRecords } from './inspectionRecordService';
import {
  PDF_COLORS,
  buildFileName,
  blobToDataUrl,
  drawPDFHeader,
  drawSectionTitle,
  drawEquipmentDetails,
  drawSummaryBox,
  drawAllPageFooters,
  drawComplianceStatement,
  PDF_TABLE_HEAD_STYLES,
  PDF_TABLE_BODY_STYLES,
  PDF_TABLE_ALT_ROW,
  getImageDimensions,
  fitImage,
} from './pdfUtils';
import {
  drawTemplateHeader,
  drawTemplateFooters,
  drawSection,
  drawMetadataRows,
  generateDocumentId,
  checkOverflow,
  type DocTypeCode,
} from './pdfTemplate';
import { storeRideDocument, getRideCode } from './rideDocumentService';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CheckRecordsReportOptions {
  rideId: string;
  rideName: string;
  userId: string;
  effectiveUserId: string;
  /** Applied filters for metadata display */
  filters: FetchRecordsFilters;
  /** Pre-fetched records (avoids double-fetch) */
  records: InspectionRecord[];
  /** Period label for display */
  periodLabel?: string;
}

interface ReportStats {
  total: number;
  passed: number;
  failed: number;
  partial: number;
  withDefects: number;
  passRate: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeStats(records: InspectionRecord[]): ReportStats {
  const total = records.length;
  const passed = records.filter(r => r.overall_result === 'passed' || r.overall_result === 'completed').length;
  const failed = records.filter(r => r.overall_result === 'failed').length;
  const partial = total - passed - failed;
  const withDefects = records.filter(r => (r.defect_ids?.length || 0) > 0).length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  return { total, passed, failed, partial, withDefects, passRate };
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

function buildFiltersSummary(filters: FetchRecordsFilters): string[] {
  const parts: string[] = [];
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom || '—';
    const to = filters.dateTo || '—';
    parts.push(`Date range: ${from} to ${to}`);
  }
  if (filters.result && filters.result !== 'all') {
    parts.push(`Result: ${filters.result}`);
  }
  if (filters.hasDefects === true) parts.push('Defects: With defects only');
  if (filters.hasDefects === false) parts.push('Defects: No defects only');
  if (filters.inspectorName) parts.push(`Checked by: ${filters.inspectorName}`);
  if (filters.searchQuery) parts.push(`Search: "${filters.searchQuery}"`);
  return parts;
}

// ─── PDF Generator ───────────────────────────────────────────────────────────

export async function generateCheckRecordsPdf(opts: CheckRecordsReportOptions): Promise<{ blob: Blob; fileName: string; storagePath: string | null }> {
  const { rideId, rideName, userId, effectiveUserId, filters, records } = opts;
  const doc = new jsPDF();
  const docId = await generateDocumentId(rideId, 'CH');
  const stats = computeStats(records);
  const generatedAt = format(new Date(), "dd MMM yyyy 'at' HH:mm");

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_name, showmen_name, controller_name, company_logo_path')
    .eq('user_id', userId)
    .single();

  const companyName = profile?.company_name || profile?.showmen_name || '';
  const controllerName = profile?.controller_name || null;

  // Fetch logo
  let logoDataUrl: string | null = null;
  if (profile?.company_logo_path) {
    try {
      const { data: blob } = await supabase.storage.from('ride-documents').download(profile.company_logo_path);
      if (blob) logoDataUrl = await blobToDataUrl(blob);
    } catch (_) { /* skip */ }
  }

  // Fetch equipment photo
  const { data: rideImageDoc } = await supabase
    .from('documents')
    .select('file_path')
    .eq('ride_id', rideId)
    .like('mime_type', 'image/%')
    .limit(1)
    .maybeSingle();

  let rideImageDataUrl: string | null = null;
  if (rideImageDoc) {
    try {
      const { data: blob } = await supabase.storage.from('ride-documents').download(rideImageDoc.file_path);
      if (blob) rideImageDataUrl = await blobToDataUrl(blob);
    } catch (_) { /* skip */ }
  }

  // Period label
  const periodLabel = opts.periodLabel ||
    (filters.dateFrom && filters.dateTo
      ? `${filters.dateFrom} – ${filters.dateTo}`
      : filters.dateFrom
        ? `From ${filters.dateFrom}`
        : filters.dateTo
          ? `To ${filters.dateTo}`
          : 'All records');

  // ── Page 1: Header ──
  let y = drawPDFHeader({
    doc,
    logoDataUrl,
    companyName,
    controllerName,
    reportTitle: 'CHECK RECORDS',
    period: periodLabel,
    generatedDate: generatedAt,
    docId,
  });

  // ── Equipment details ──
  y = drawSectionTitle(doc, 'Equipment Details', y);
  y = await drawEquipmentDetails({
    doc,
    y,
    fields: [
      { label: 'Equipment', value: rideName },
      { label: 'Report Period', value: periodLabel },
      { label: 'Total Records', value: String(stats.total) },
      { label: 'Generated', value: generatedAt },
    ],
    imageDataUrl: rideImageDataUrl,
  });

  // ── Summary metrics ──
  y = drawSummaryBox(doc, [
    { label: 'Total Checks', value: String(stats.total) },
    { label: 'Passed', value: String(stats.passed), accent: true },
    { label: 'Failed', value: String(stats.failed) },
    { label: 'Pass Rate', value: `${stats.passRate}%`, accent: true },
  ], y);

  // Extended summary row
  y = drawSummaryBox(doc, [
    { label: 'Partial', value: String(stats.partial) },
    { label: 'With Defects', value: String(stats.withDefects) },
    { label: 'No Defects', value: String(stats.total - stats.withDefects), accent: true },
  ], y);

  // ── Filters applied ──
  const filterLines = buildFiltersSummary(filters);
  if (filterLines.length > 0) {
    y = drawSectionTitle(doc, 'Filters Applied', y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.body);
    for (const line of filterLines) {
      y = checkOverflow(doc, y, 5);
      doc.text(`• ${line}`, 16, y);
      y += 4.5;
    }
    y += 3;
  }

  // ── Records table ──
  y = checkOverflow(doc, y, 30);
  y = drawSectionTitle(doc, 'Check Records', y);

  const tableBody = records.map(record => {
    const defectCount = record.defect_ids?.length || 0;
    const dateStr = format(parseISO(record.check_date), 'dd MMM yyyy');
    const timeStr = format(parseISO(record.completed_at), 'HH:mm');
    const freq = formatFrequency(record.check_frequency);
    const result = record.overall_result === 'completed' ? 'Passed' : record.overall_result.charAt(0).toUpperCase() + record.overall_result.slice(1);
    const hasNotes = record.notes ? '✓' : '';
    const hasPhotos = (record.photo_paths?.length || 0) > 0 ? '✓' : '';

    return [
      dateStr,
      timeStr,
      `${freq}${record.template_name ? `\n${record.template_name}` : ''}`,
      result,
      record.inspector_name,
      defectCount > 0 ? String(defectCount) : '—',
      [hasNotes && 'Notes', hasPhotos && 'Photos'].filter(Boolean).join(', ') || '—',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Time', 'Check / Template', 'Result', 'Checked By', 'Defects', 'Attachments']],
    body: tableBody,
    headStyles: PDF_TABLE_HEAD_STYLES,
    styles: { ...PDF_TABLE_BODY_STYLES, fontSize: 7.5 },
    alternateRowStyles: PDF_TABLE_ALT_ROW,
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 14 },
      2: { cellWidth: 38 },
      3: { cellWidth: 18 },
      4: { cellWidth: 30 },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 26 },
    },
    margin: { left: 13, right: 13 },
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

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Compliance statement ──
  y = checkOverflow(doc, y, 30);
  y = drawComplianceStatement(doc, y);

  // ── Footers on all pages ──
  drawAllPageFooters(doc, docId);

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
    'Date',
    'Time',
    'Frequency',
    'Template',
    'Result',
    'Checked By',
    'Defects',
    'Notes',
    'Weather',
    'Location',
    'Version',
    'Record ID',
  ];

  const rows = records.map(record => [
    format(parseISO(record.check_date), 'yyyy-MM-dd'),
    format(parseISO(record.completed_at), 'HH:mm'),
    formatFrequency(record.check_frequency),
    record.template_name || '',
    record.overall_result === 'completed' ? 'Passed' : record.overall_result,
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
