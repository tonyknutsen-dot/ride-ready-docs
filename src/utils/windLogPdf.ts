/**
 * Wind Log / Wind Speed Register PDF
 * ====================================
 * Uses the shared pdfTemplate system (drawTemplateHeader, drawSection,
 * drawMetadataRows, drawTemplateFooters) so the output is visually identical
 * to checks, maintenance, timeline, and risk assessment reports.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import {
  drawTemplateHeader,
  drawSection,
  drawMetadataRows,
  drawTemplateFooters,
  checkOverflow,
  type PdfTemplateOptions,
  type MetadataField,
} from './pdfTemplate';
import {
  PDF_COLORS,
  drawSummaryBox,
  generateDocId,
  buildFileName,
  PDF_TABLE_HEAD_STYLES,
  PDF_TABLE_BODY_STYLES,
  PDF_TABLE_ALT_ROW,
} from './pdfUtils';
import { fetchEquipmentPhoto, drawEquipmentPhotoInHeader } from './pdfEquipmentPhoto';
import { fetchLogoDataUrl } from './pdfTemplate';

// ─── High-wind threshold (matches UI) ─────────────────────────────────────────
const HIGH_WIND_MPH = 24;
function toMph(speed: number, unit: string): number {
  if (unit === 'mph') return speed;
  if (unit === 'km/h') return speed * 0.621371;
  if (unit === 'm/s') return speed * 2.23694;
  return speed;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface WindLogPdfEntry {
  log_date: string;
  log_time: string;
  wind_speed: number;
  wind_unit: string;
  location: string | null;
  recorded_by: string;
  action_taken: string | null;
  notes: string | null;
  linked_rides?: string[];
  anemometer_make?: string | null;
  anemometer_model?: string | null;
  anemometer_serial?: string | null;
}

export interface WindLogPdfOptions {
  entries: WindLogPdfEntry[];
  title: string;
  dateRange?: { from?: string; to?: string };
  location?: string;
  inflatableName?: string;
  companyName?: string;
  controllerName?: string;
  logoDataUrl?: string | null;
  userId?: string;
  singleRideId?: string;
}

// ─── Main generator ──────────────────────────────────────────────────────────
export async function generateWindLogPdf(options: WindLogPdfOptions) {
  const {
    entries,
    dateRange,
    location,
    inflatableName,
    companyName,
    controllerName,
  } = options;

  const isSingleAsset = !!inflatableName && !!options.singleRideId;

  // Equipment photo — only for single-inflatable reports
  let equipmentPhoto: { dataUrl: string; naturalW: number; naturalH: number } | null = null;
  if (isSingleAsset && options.singleRideId) {
    equipmentPhoto = await fetchEquipmentPhoto(options.singleRideId);
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const docId = generateDocId('WIND');
  const mL = 15;

  // Period string
  let period = '';
  if (dateRange?.from && dateRange?.to) {
    period = `${dateRange.from} – ${dateRange.to}`;
  } else if (dateRange?.from) {
    period = `From ${dateRange.from}`;
  } else if (dateRange?.to) {
    period = `To ${dateRange.to}`;
  }

  // Report title
  const headerTitle = isSingleAsset ? 'WIND LOG' : 'WIND SPEED REGISTER';

  // ─── 1. Navy header bar (matches all other reports) ────────────────────────
  const templateOpts: PdfTemplateOptions = {
    doc,
    title: headerTitle,
    documentId: docId,
    docType: 'WL',
  };
  let y = drawTemplateHeader(templateOpts);

  // ─── 2. Report details section ────────────────────────────────────────────
  y = drawSection(doc, 'Report Details', y, mL);

  const detailFields: MetadataField[] = [];
  if (companyName) detailFields.push({ label: 'Company', value: companyName });
  if (controllerName) detailFields.push({ label: 'Controller / Duty Holder', value: controllerName });

  if (isSingleAsset && inflatableName) {
    detailFields.push({ label: 'Report Scope', value: 'Single Inflatable' });
    detailFields.push({ label: 'Inflatable', value: inflatableName });
  } else {
    detailFields.push({ label: 'Report Scope', value: 'Shared Register' });
    const allRides = new Set<string>();
    entries.forEach(e => (e.linked_rides || []).forEach(r => allRides.add(r)));
    if (allRides.size > 0) {
      detailFields.push({ label: 'Inflatables Covered', value: [...allRides].join(', ') });
    }
  }

  if (location) detailFields.push({ label: 'Location / Site', value: location });
  if (period) detailFields.push({ label: 'Period', value: period });

  // Recorded by
  const recorders = [...new Set(entries.map(e => e.recorded_by))];
  detailFields.push({
    label: 'Recorded By',
    value: recorders.length <= 5 ? recorders.join(', ') : `${recorders.length} staff members`,
  });

  // Anemometer used
  const anemEntries = entries.filter(e => e.anemometer_make || e.anemometer_model);
  if (anemEntries.length > 0) {
    const uniqueAnems = [...new Set(anemEntries.map(e => {
      const parts = [e.anemometer_make, e.anemometer_model, e.anemometer_serial ? `S/N: ${e.anemometer_serial}` : null].filter(Boolean);
      return parts.join(' · ');
    }))];
    detailFields.push({ label: 'Anemometer', value: uniqueAnems.slice(0, 3).join(' | ') });
  }
  const missingAnem = entries.length - anemEntries.length;
  if (missingAnem > 0) {
    detailFields.push({ label: 'Incomplete Readings', value: `${missingAnem} without anemometer data` });
  }

  detailFields.push({ label: 'Generated', value: format(new Date(), 'd MMM yyyy HH:mm') });
  detailFields.push({ label: 'Document ID', value: docId });
  detailFields.push({ label: 'Total Readings', value: String(entries.length) });

  y = drawMetadataRows(doc, detailFields, y, mL);

  // ─── 3. Equipment photo (single-asset only) ───────────────────────────────
  if (isSingleAsset && equipmentPhoto) {
    const photoX = pageWidth - mL - 30;
    // Draw above summary box, right-aligned alongside metadata
    drawEquipmentPhotoInHeader(doc, equipmentPhoto, photoX, 32, 28, 20);
  }

  // ─── 4. Summary box ───────────────────────────────────────────────────────
  const speeds = entries.map(e => e.wind_speed);
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;
  const avgSpeed = speeds.length ? (speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;
  const ceasedCount = entries.filter(e => e.action_taken?.toLowerCase().includes('ceased')).length;
  const highWindCount = entries.filter(e => toMph(e.wind_speed, e.wind_unit) >= HIGH_WIND_MPH).length;
  const unit = entries[0]?.wind_unit || 'mph';

  y = drawSummaryBox(doc, [
    { label: 'Total Readings', value: String(entries.length), accent: true },
    { label: `Max (${unit})`, value: maxSpeed.toFixed(1) },
    { label: `Avg (${unit})`, value: avgSpeed.toFixed(1) },
    { label: 'Ceased Ops', value: String(ceasedCount) },
    ...(highWindCount > 0 ? [{ label: `≥${HIGH_WIND_MPH} mph`, value: String(highWindCount) }] : []),
  ], y, mL);

  // ─── 5. Readings table ────────────────────────────────────────────────────
  y = drawSection(doc, 'Wind Speed Readings', y, mL);

  const showAppliesTo = !isSingleAsset;
  const showAnem = entries.some(e => e.anemometer_make || e.anemometer_model || e.anemometer_serial);

  const head = [[
    'Date',
    'Time',
    `Speed`,
    'Location',
    'Recorded By',
    ...(showAppliesTo ? ['Applies To'] : []),
    'Action Taken',
    'Notes',
    ...(showAnem ? ['Anemometer'] : []),
  ]];

  const body = entries.map(e => {
    const anemParts: string[] = [];
    if (e.anemometer_make) anemParts.push(e.anemometer_make);
    if (e.anemometer_model) anemParts.push(e.anemometer_model);
    if (e.anemometer_serial) anemParts.push(`S/N: ${e.anemometer_serial}`);

    const speedStr = `${e.wind_speed} ${e.wind_unit}`;

    return [
      e.log_date,
      e.log_time.slice(0, 5),
      speedStr,
      e.location || '—',
      e.recorded_by,
      ...(showAppliesTo ? [(e.linked_rides || []).join(', ') || '—'] : []),
      e.action_taken || '—',
      e.notes || '—',
      ...(showAnem ? [anemParts.join(' / ') || '—'] : []),
    ];
  });

  // Column widths — prevent heading breaks
  const colStyles: Record<number, { cellWidth?: number; minCellWidth?: number }> = {
    0: { cellWidth: 22 },   // Date
    1: { cellWidth: 14 },   // Time
    2: { cellWidth: 20 },   // Speed (merged with unit)
  };

  // High-wind row indices for highlighting
  const highWindRows = new Set(
    entries.map((e, i) => toMph(e.wind_speed, e.wind_unit) >= HIGH_WIND_MPH ? i : -1).filter(i => i >= 0)
  );

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    styles: {
      ...PDF_TABLE_BODY_STYLES,
      fontSize: 7.5,
      cellPadding: 2.5,
      overflow: 'linebreak',
    },
    headStyles: {
      ...PDF_TABLE_HEAD_STYLES,
      fontSize: 7.5,
      cellPadding: 2.5,
    },
    alternateRowStyles: { ...PDF_TABLE_ALT_ROW },
    columnStyles: colStyles,
    margin: { left: mL, right: mL },
    showHead: 'everyPage',
    didParseCell: (data) => {
      // Highlight high-wind rows
      if (data.section === 'body' && highWindRows.has(data.row.index)) {
        data.cell.styles.fillColor = [254, 226, 226]; // red-100
        data.cell.styles.textColor = [153, 27, 27];   // red-800
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // ─── 6. Footer on all pages ───────────────────────────────────────────────
  drawTemplateFooters(templateOpts);

  // ─── Save ─────────────────────────────────────────────────────────────────
  const filename = inflatableName
    ? buildFileName(['wind-log', inflatableName, format(new Date(), 'yyyy-MM-dd')])
    : buildFileName(['wind-speed-register', format(new Date(), 'yyyy-MM-dd')]);

  doc.save(filename);
}
