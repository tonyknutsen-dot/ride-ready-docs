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
  generateDocId,
  buildFileName,
  PDF_TABLE_HEAD_STYLES,
  PDF_TABLE_BODY_STYLES,
  PDF_TABLE_ALT_ROW,
  blobToDataUrl,
} from './pdfUtils';
import { drawEquipmentPhotoInHeader, type EquipmentPhotoResult } from './pdfEquipmentPhoto';
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
  equipmentPhoto?: EquipmentPhotoResult | null;
  userId?: string;
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
    equipmentPhoto,
  } = options;

  // Try to fetch logo if userId provided and no logo passed
  let logoDataUrl = options.logoDataUrl || null;
  if (!logoDataUrl && options.userId) {
    logoDataUrl = await fetchLogoDataUrl(options.userId);
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const docId = generateDocId('CHECK');

  // Period string
  let period = '';
  if (dateRange?.from && dateRange?.to) {
    period = `${dateRange.from} – ${dateRange.to}`;
  } else if (dateRange?.from) {
    period = `From ${dateRange.from}`;
  } else if (dateRange?.to) {
    period = `To ${dateRange.to}`;
  }

  // ─── Header ───
  let y = drawPDFHeader({
    doc,
    logoDataUrl,
    companyName: companyName || 'Wind Speed Log',
    controllerName,
    reportTitle: inflatableName ? 'EQUIPMENT WIND LOG' : 'SITE WIND LOG',
    subTitle: title,
    docId,
    period: period || undefined,
    generatedDate: format(new Date(), "dd MMM yyyy 'at' HH:mm"),
  });

  // ─── Equipment photo + report details ───
  if (equipmentPhoto) {
    const fit = drawEquipmentPhotoInHeader(doc, equipmentPhoto, pageWidth - 13 - 28, y, 28, 20);
    // Details beside photo
  }

  // ─── Report Info Section ───
  y = drawSectionTitle(doc, 'Report Details', y);

  const mL = 13;
  const labelX = mL + 3;
  const valueX = mL + 40;
  doc.setFontSize(8.5);

  const detailRows: [string, string][] = [];
  if (companyName) detailRows.push(['Company', companyName]);
  if (controllerName) detailRows.push(['Controller', controllerName]);
  if (inflatableName) detailRows.push(['Equipment', inflatableName]);
  if (location) detailRows.push(['Location / Site', location]);
  if (period) detailRows.push(['Period', period]);
  detailRows.push(['Generated', format(new Date(), 'd MMM yyyy HH:mm')]);
  detailRows.push(['Total Readings', String(entries.length)]);

  for (const [label, value] of detailRows) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(`${label}:`, labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.title);
    doc.text(value, valueX, y);
    y += 5;
  }
  y += 3;

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

  const showAppliesTo = !inflatableName;
  const showAnemometer = entries.some(e => e.anemometer_make || e.anemometer_model || e.anemometer_serial);

  const head = [
    [
      'Date', 'Time', 'Speed', 'Unit', 'Location', 'Recorded By',
      ...(showAppliesTo ? ['Applies To'] : []),
      'Action Taken', 'Notes',
      ...(showAnemometer ? ['Anemometer'] : []),
    ],
  ];

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
    columnStyles: showAppliesTo
      ? { 0: { cellWidth: 20 }, 1: { cellWidth: 13 }, 2: { cellWidth: 13 }, 3: { cellWidth: 11 } }
      : { 0: { cellWidth: 20 }, 1: { cellWidth: 13 }, 2: { cellWidth: 13 }, 3: { cellWidth: 11 } },
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
