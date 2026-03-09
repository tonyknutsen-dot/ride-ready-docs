/**
 * Wind Log / Wind Speed Register PDF
 * ====================================
 * Uses the shared pdfTemplate system so the output is visually identical
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
  anemometer_type?: string | null;
  anemometer_calibration_date?: string | null;
  anemometer_notes?: string | null;
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

  // ─── 1. Header bar ────────────────────────────────────────────────────────
  const templateOpts: PdfTemplateOptions = {
    doc,
    title: headerTitle,
    documentId: docId,
    docType: 'WL',
  };
  let y = drawTemplateHeader(templateOpts);

  // ─── 2. Equipment photo (single-asset, right-aligned beside metadata) ────
  if (isSingleAsset && equipmentPhoto) {
    drawEquipmentPhotoInHeader(doc, equipmentPhoto, pageWidth - mL - 30, y, 28, 20);
  }

  // ─── 3. Report details ────────────────────────────────────────────────────
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

  // Recorder logic
  const recorders = [...new Set(entries.map(e => e.recorded_by))];
  if (recorders.length === 1) {
    detailFields.push({ label: 'Recorded By', value: recorders[0] });
  } else if (recorders.length <= 3) {
    detailFields.push({ label: 'Recorders', value: `${recorders.length} (${recorders.join(', ')})` });
  } else {
    detailFields.push({ label: 'Recorders', value: `Multiple (${recorders.length} staff)` });
  }

  // Anemometer logic
  const anemEntries = entries.filter(e => e.anemometer_make || e.anemometer_model);
  const missingAnem = entries.length - anemEntries.length;
  if (anemEntries.length === 0) {
    detailFields.push({ label: 'Anemometer Records', value: 'Missing — no anemometer data recorded' });
  } else {
    const uniqueAnems = [...new Set(anemEntries.map(e => {
      const parts = [e.anemometer_make, e.anemometer_model, e.anemometer_serial ? `S/N: ${e.anemometer_serial}` : null].filter(Boolean);
      return parts.join(' · ');
    }))];
    if (uniqueAnems.length === 1 && missingAnem === 0) {
      detailFields.push({ label: 'Anemometer', value: uniqueAnems[0] });
      // Show type & calibration for single-instrument reports
      const ref = anemEntries[0];
      if (ref.anemometer_type) detailFields.push({ label: 'Anemometer Type', value: ref.anemometer_type });
      if (ref.anemometer_calibration_date) detailFields.push({ label: 'Last Calibration', value: ref.anemometer_calibration_date });
      if (ref.anemometer_notes) detailFields.push({ label: 'Instrument Notes', value: ref.anemometer_notes });
    } else if (missingAnem === 0) {
      detailFields.push({ label: 'Anemometer Records', value: `Complete — ${uniqueAnems.length} instruments used` });
    } else {
      detailFields.push({
        label: 'Anemometer Records',
        value: `Partial — ${missingAnem} of ${entries.length} reading${entries.length !== 1 ? 's' : ''} without data`,
      });
    }
  }

  detailFields.push({ label: 'Generated', value: format(new Date(), 'd MMM yyyy HH:mm') });
  detailFields.push({ label: 'Document ID', value: docId });

  y = drawMetadataRows(doc, detailFields, y, mL);

  // ─── 4. Summary box ───────────────────────────────────────────────────────
  const speeds = entries.map(e => e.wind_speed);
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;
  const avgSpeed = speeds.length ? (speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;
  const ceasedCount = entries.filter(e => e.action_taken?.toLowerCase().includes('ceased')).length;
  const highWindCount = entries.filter(e => toMph(e.wind_speed, e.wind_unit) >= HIGH_WIND_MPH).length;
  const unit = entries[0]?.wind_unit || 'mph';

  y = drawSummaryBox(doc, [
    { label: 'Readings', value: String(entries.length), accent: true },
    { label: `Max (${unit})`, value: maxSpeed.toFixed(1) },
    { label: `Avg (${unit})`, value: avgSpeed.toFixed(1) },
    { label: 'Ceased Ops', value: String(ceasedCount) },
    ...(highWindCount > 0 ? [{ label: `≥${HIGH_WIND_MPH} mph`, value: String(highWindCount) }] : []),
  ], y, mL);

  // ─── 5. Readings register ─────────────────────────────────────────────────
  y = drawSection(doc, 'Readings Register', y, mL);

  const showAppliesTo = !isSingleAsset;

  const head = [[
    'Date',
    'Time',
    'Speed',
    'Location',
    'Recorded By',
    ...(showAppliesTo ? ['Applies To'] : []),
    'Action Taken',
    'Anemometer',
    'Notes',
  ]];

  const body = entries.map(e => {
    const anemParts: string[] = [];
    if (e.anemometer_make) anemParts.push(e.anemometer_make);
    if (e.anemometer_model) anemParts.push(e.anemometer_model);
    if (e.anemometer_serial) anemParts.push(`S/N: ${e.anemometer_serial}`);
    const anemText = anemParts.length > 0 ? anemParts.join(' / ') : '⚠ Missing';

    return [
      e.log_date,
      e.log_time.slice(0, 5),
      `${e.wind_speed} ${e.wind_unit}`,
      e.location || '—',
      e.recorded_by,
      ...(showAppliesTo ? [(e.linked_rides || []).join(', ') || '—'] : []),
      e.action_taken || '—',
      anemText,
      e.notes || '—',
    ];
  });

  // Fixed column widths for the first few to prevent drift
  const colStyles: Record<number, { cellWidth?: number; minCellWidth?: number }> = {
    0: { cellWidth: 22 },   // Date
    1: { cellWidth: 14 },   // Time
    2: { cellWidth: 22 },   // Speed
  };

  // Pre-compute row flags
  const highWindRows = new Set<number>();
  const missingAnemRows = new Set<number>();
  // Anemometer column index depends on whether "Applies To" is shown
  const anemColIdx = showAppliesTo ? 7 : 6;

  entries.forEach((e, i) => {
    if (toMph(e.wind_speed, e.wind_unit) >= HIGH_WIND_MPH) highWindRows.add(i);
    if (!e.anemometer_make && !e.anemometer_model) missingAnemRows.add(i);
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    styles: {
      ...PDF_TABLE_BODY_STYLES,
      fontSize: 7,
      cellPadding: 2,
      overflow: 'linebreak',
    },
    headStyles: {
      ...PDF_TABLE_HEAD_STYLES,
      fontSize: 7,
      cellPadding: 2,
    },
    alternateRowStyles: { ...PDF_TABLE_ALT_ROW },
    columnStyles: colStyles,
    margin: { left: mL, right: mL },
    showHead: 'everyPage',
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      // High-wind: entire row red
      if (highWindRows.has(data.row.index)) {
        data.cell.styles.fillColor = [254, 226, 226];
        data.cell.styles.textColor = [153, 27, 27];
        data.cell.styles.fontStyle = 'bold';
      }
      // Missing anemometer: flag just the anemometer cell
      if (missingAnemRows.has(data.row.index) && data.column.index === anemColIdx) {
        data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // ─── 6. Footer on all pages ───────────────────────────────────────────────
  drawTemplateFooters(templateOpts);

  // ─── Return blob + filename (callers handle View/Download/Save) ────────────
  const filename = inflatableName
    ? buildFileName(['wind-log', inflatableName, format(new Date(), 'yyyy-MM-dd')])
    : buildFileName(['wind-speed-register', format(new Date(), 'yyyy-MM-dd')]);

  return { blob: doc.output('blob') as Blob, fileName: filename };
}
