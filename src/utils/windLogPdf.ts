/**
 * Wind Log / Wind Speed Register PDF
 * Uses the shared pdfUtils template system for visual consistency with all other reports.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import {
  PDF_COLORS,
  drawPDFHeader,
  drawSectionTitle,
  drawSummaryBox,
  drawAllPageFooters,
  drawComplianceStatement,
  drawEquipmentDetails,
  generateDocId,
  buildFileName,
  PDF_TABLE_HEAD_STYLES,
  PDF_TABLE_BODY_STYLES,
  PDF_TABLE_ALT_ROW,
} from './pdfUtils';
import { fetchEquipmentPhoto } from './pdfEquipmentPhoto';
import { fetchLogoDataUrl } from './pdfTemplate';

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

export async function generateWindLogPdf(options: WindLogPdfOptions) {
  const {
    entries,
    title,
    dateRange,
    location,
    inflatableName,
    companyName,
    controllerName,
  } = options;

  // Fetch logo
  let logoDataUrl = options.logoDataUrl || null;
  if (!logoDataUrl && options.userId) {
    logoDataUrl = await fetchLogoDataUrl(options.userId);
  }

  // Equipment photo — only for single-inflatable reports
  let equipmentPhotoDataUrl: string | null = null;
  const isSingleAsset = !!inflatableName && !!options.singleRideId;
  if (isSingleAsset && options.singleRideId) {
    const photo = await fetchEquipmentPhoto(options.singleRideId);
    if (photo) equipmentPhotoDataUrl = photo.dataUrl;
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const docId = generateDocId('WIND');
  const mL = 13;

  // Period string
  let period = '';
  if (dateRange?.from && dateRange?.to) {
    period = `${dateRange.from} – ${dateRange.to}`;
  } else if (dateRange?.from) {
    period = `From ${dateRange.from}`;
  } else if (dateRange?.to) {
    period = `To ${dateRange.to}`;
  }

  // Report title: single inflatable = "Wind Log – [Name]", multi = "Wind Speed Register"
  const reportTitle = isSingleAsset ? 'WIND LOG' : 'WIND SPEED REGISTER';

  // ─── Header (same shell as checks/maintenance/risk) ───
  let y = drawPDFHeader({
    doc,
    logoDataUrl,
    companyName: companyName || 'Wind Speed Register',
    controllerName,
    reportTitle,
    subTitle: title,
    docId,
    period: period || undefined,
    generatedDate: format(new Date(), "dd MMM yyyy 'at' HH:mm"),
  });

  // ─── Report Details ───
  y = drawSectionTitle(doc, 'Report Details', y);

  const detailFields: Array<{ label: string; value: string | null | undefined }> = [];
  if (companyName) detailFields.push({ label: 'Company', value: companyName });
  if (controllerName) detailFields.push({ label: 'Controller / Duty Holder', value: controllerName });

  // Report scope
  if (isSingleAsset && inflatableName) {
    detailFields.push({ label: 'Report Scope', value: 'Single Inflatable' });
    detailFields.push({ label: 'Inflatable', value: inflatableName });
  } else {
    detailFields.push({ label: 'Report Scope', value: 'Shared Register' });
    // List all unique inflatables covered
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
  if (recorders.length <= 5) {
    detailFields.push({ label: 'Recorded By', value: recorders.join(', ') });
  } else {
    detailFields.push({ label: 'Recorded By', value: `${recorders.length} staff members` });
  }

  // Anemometer used (if consistent)
  const anemometers = entries.filter(e => e.anemometer_make || e.anemometer_model);
  const missingAnemCount = entries.length - anemometers.length;
  if (anemometers.length > 0) {
    const uniqueAnems = new Set(anemometers.map(e => {
      const parts = [e.anemometer_make, e.anemometer_model, e.anemometer_serial ? `S/N: ${e.anemometer_serial}` : null].filter(Boolean);
      return parts.join(' · ');
    }));
    const anemValue = [...uniqueAnems].slice(0, 3).join(' | ');
    detailFields.push({ label: 'Anemometer Used', value: anemValue });
  }
  if (missingAnemCount > 0) {
    detailFields.push({ label: 'Incomplete Readings', value: `${missingAnemCount} reading${missingAnemCount !== 1 ? 's' : ''} without anemometer data` });
  }

  detailFields.push({ label: 'Generated', value: format(new Date(), 'd MMM yyyy HH:mm') });
  detailFields.push({ label: 'Document ID', value: docId });
  detailFields.push({ label: 'Total Readings', value: String(entries.length) });

  // Use equipment details block with photo for single-asset, plain list for multi
  if (isSingleAsset && equipmentPhotoDataUrl) {
    y = await drawEquipmentDetails({
      doc,
      y,
      fields: detailFields,
      imageDataUrl: equipmentPhotoDataUrl,
      maxImageW: 35,
      maxImageH: 25,
    });
  } else {
    const labelX = mL + 3;
    const valueX = mL + 48;
    doc.setFontSize(8.5);
    for (const field of detailFields) {
      if (!field.value) continue;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(`${field.label}:`, labelX, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PDF_COLORS.title);
      const lines = doc.splitTextToSize(field.value, pageWidth - valueX - mL);
      doc.text(lines, valueX, y);
      y += lines.length * 4 + 2;
    }
    y += 3;
  }

  // ─── Summary metrics ───
  const speeds = entries.map(e => e.wind_speed);
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;
  const avgSpeed = speeds.length ? (speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;
  const ceasedCount = entries.filter(e => e.action_taken?.toLowerCase().includes('ceased')).length;
  const unit = entries[0]?.wind_unit || 'mph';

  y = drawSummaryBox(doc, [
    { label: 'Total Readings', value: String(entries.length), accent: true },
    { label: `Max Speed (${unit})`, value: maxSpeed.toFixed(1) },
    { label: `Avg Speed (${unit})`, value: avgSpeed.toFixed(1) },
    { label: 'Ceased Operations', value: String(ceasedCount) },
  ], y);

  // ─── Readings Table ───
  y = drawSectionTitle(doc, 'Wind Speed Readings', y);

  const showAppliesTo = !isSingleAsset;
  const showAnemometer = entries.some(e => e.anemometer_make || e.anemometer_model || e.anemometer_serial);

  const head = [[
    'Date', 'Time', 'Speed', 'Unit', 'Location', 'Recorded By',
    ...(showAppliesTo ? ['Applies To'] : []),
    'Action Taken', 'Notes',
    ...(showAnemometer ? ['Anemometer'] : []),
  ]];

  const body = entries.map(e => {
    const anemometerParts: string[] = [];
    if (e.anemometer_make) anemometerParts.push(e.anemometer_make);
    if (e.anemometer_model) anemometerParts.push(e.anemometer_model);
    if (e.anemometer_serial) anemometerParts.push(`S/N: ${e.anemometer_serial}`);

    return [
      e.log_date,
      e.log_time.slice(0, 5),
      String(e.wind_speed),
      e.wind_unit,
      e.location || '—',
      e.recorded_by,
      ...(showAppliesTo ? [(e.linked_rides || []).join(', ') || '—'] : []),
      e.action_taken || '—',
      e.notes || '—',
      ...(showAnemometer ? [anemometerParts.join(' / ') || '—'] : []),
    ];
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    styles: { ...PDF_TABLE_BODY_STYLES },
    headStyles: { ...PDF_TABLE_HEAD_STYLES },
    alternateRowStyles: { ...PDF_TABLE_ALT_ROW },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 13 },
      2: { cellWidth: 13 },
      3: { cellWidth: 11 },
    },
    margin: { left: mL, right: mL },
  });

  // ─── Compliance statement ───
  const finalY = (doc as any).lastAutoTable?.finalY || y + 40;
  drawComplianceStatement(doc, finalY + 6, mL);

  // ─── Footers ───
  drawAllPageFooters(doc, docId);

  // ─── Save ───
  const filename = inflatableName
    ? buildFileName(['wind-log', inflatableName, format(new Date(), 'yyyy-MM-dd')])
    : buildFileName(['wind-speed-register', format(new Date(), 'yyyy-MM-dd')]);

  doc.save(filename);
}
