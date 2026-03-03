/**
 * Wind Log PDF — Professional Operational Record
 * Uses the shared pdfUtils template system for consistent branding.
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
  subtitle?: string;
  dateRange?: { from?: string; to?: string };
  location?: string;
  inflatableName?: string;
  companyName?: string;
  controllerName?: string;
  logoDataUrl?: string | null;
  userId?: string;
  /** When filtering for a single ride, pass the ID to include equipment photo */
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

  // Fetch equipment photo for single-asset reports only
  let equipmentPhotoDataUrl: string | null = null;
  if (options.singleRideId) {
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

  const isSingleAsset = !!inflatableName;

  // ─── Header ───
  let y = drawPDFHeader({
    doc,
    logoDataUrl,
    companyName: companyName || 'Wind Speed Log',
    controllerName,
    reportTitle: isSingleAsset ? 'EQUIPMENT WIND LOG' : 'SITE WIND LOG',
    subTitle: title,
    docId,
    period: period || undefined,
    generatedDate: format(new Date(), "dd MMM yyyy 'at' HH:mm"),
  });

  // ─── Report Details with optional equipment photo ───
  y = drawSectionTitle(doc, 'Report Details', y);

  const detailFields: Array<{ label: string; value: string | null | undefined }> = [];
  if (companyName) detailFields.push({ label: 'Company', value: companyName });
  if (controllerName) detailFields.push({ label: 'Controller', value: controllerName });
  if (inflatableName) detailFields.push({ label: 'Equipment', value: inflatableName });
  if (location) detailFields.push({ label: 'Location / Site', value: location });
  if (period) detailFields.push({ label: 'Period', value: period });

  // Unique recorded-by names
  const recorders = [...new Set(entries.map(e => e.recorded_by))];
  if (recorders.length <= 3) {
    detailFields.push({ label: 'Recorded By', value: recorders.join(', ') });
  }

  // Anemometer info (if consistent across entries)
  const anemometers = entries.filter(e => e.anemometer_make || e.anemometer_model);
  if (anemometers.length > 0) {
    const first = anemometers[0];
    const parts = [first.anemometer_make, first.anemometer_model, first.anemometer_serial ? `S/N: ${first.anemometer_serial}` : null].filter(Boolean);
    if (parts.length > 0) detailFields.push({ label: 'Anemometer', value: parts.join(' · ') });
  }

  detailFields.push({ label: 'Generated', value: format(new Date(), 'd MMM yyyy HH:mm') });
  detailFields.push({ label: 'Total Readings', value: String(entries.length) });

  // If single-asset with photo, use equipment details block
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
    // Simple label/value list
    const labelX = mL + 3;
    const valueX = mL + 40;
    doc.setFontSize(8.5);
    for (const field of detailFields) {
      if (!field.value) continue;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(`${field.label}:`, labelX, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PDF_COLORS.title);
      doc.text(field.value, valueX, y);
      y += 5;
    }
    y += 3;
  }

  // Multi-asset: list all unique inflatables covered
  if (!isSingleAsset) {
    const allRides = new Set<string>();
    entries.forEach(e => (e.linked_rides || []).forEach(r => allRides.add(r)));
    if (allRides.size > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text('Inflatables Covered:', mL + 3, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PDF_COLORS.title);
      const rideList = [...allRides].join(', ');
      const lines = doc.splitTextToSize(rideList, pageWidth - mL * 2 - 45);
      doc.text(lines, mL + 43, y);
      y += lines.length * 4 + 3;
    }
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
    : buildFileName(['wind-log-report', format(new Date(), 'yyyy-MM-dd')]);

  doc.save(filename);
}
