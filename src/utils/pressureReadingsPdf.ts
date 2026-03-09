/**
 * Pressure Readings Report PDF
 * Uses the shared pdfTemplate system for consistent output.
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

interface PressureSessionPdfEntry {
  session_date: string;
  session_time: string;
  session_type: string;
  taken_by: string;
  site_name: string;
  site_address: string;
  notes: string | null;
  is_complete: boolean;
  reader_type: string | null;
  reader_make: string | null;
  reader_model: string | null;
  reader_serial: string | null;
  reader_unit: string;
  reader_calibration_date: string | null;
  reader_notes: string | null;
  lines: Array<{
    section_number: number;
    section_name: string;
    reading_taken_at: string | null;
    pressure_value: number | null;
    pressure_unit: string;
    reading_point: string | null;
    notes: string | null;
  }>;
}

export interface PressureReadingsPdfOptions {
  sessions: PressureSessionPdfEntry[];
  inflatableName: string;
  rideId: string;
  companyName?: string;
  controllerName?: string;
  dateRange?: { from?: string; to?: string };
}

export async function generatePressureReadingsPdf(options: PressureReadingsPdfOptions) {
  const { sessions, inflatableName, rideId, companyName, controllerName, dateRange } = options;

  // Equipment photo
  let equipmentPhoto: { dataUrl: string; naturalW: number; naturalH: number } | null = null;
  equipmentPhoto = await fetchEquipmentPhoto(rideId);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const docId = generateDocId('CHECK');
  const mL = 15;

  // Period
  let period = '';
  if (dateRange?.from && dateRange?.to) period = `${dateRange.from} – ${dateRange.to}`;
  else if (dateRange?.from) period = `From ${dateRange.from}`;
  else if (dateRange?.to) period = `To ${dateRange.to}`;

  // Header
  const templateOpts: PdfTemplateOptions = {
    doc,
    title: 'PRESSURE READINGS REGISTER',
    documentId: docId,
    docType: 'CR',
    disclaimer: 'System-generated pressure reading record for operational monitoring and compliance purposes.',
  };
  let y = drawTemplateHeader(templateOpts);

  // Equipment photo
  if (equipmentPhoto) {
    drawEquipmentPhotoInHeader(doc, equipmentPhoto, pageWidth - mL - 30, y, 28, 20);
  }

  // Report details
  y = drawSection(doc, 'Report Details', y, mL);

  const detailFields: MetadataField[] = [];
  if (companyName) detailFields.push({ label: 'Company', value: companyName });
  if (controllerName) detailFields.push({ label: 'Controller / Duty Holder', value: controllerName });
  detailFields.push({ label: 'Inflatable', value: inflatableName });
  if (period) detailFields.push({ label: 'Period', value: period });

  // Instrument summary
  const instruments = sessions.filter(s => s.reader_make || s.reader_model);
  if (instruments.length > 0) {
    const uniqueInstruments = [...new Set(instruments.map(s => {
      const parts = [s.reader_make, s.reader_model, s.reader_serial ? `S/N: ${s.reader_serial}` : null].filter(Boolean);
      return parts.join(' · ');
    }))];
    if (uniqueInstruments.length === 1) {
      detailFields.push({ label: 'Pressure Reader', value: uniqueInstruments[0] });
    } else {
      detailFields.push({ label: 'Pressure Readers', value: `${uniqueInstruments.length} instruments used` });
    }
  }

  detailFields.push({ label: 'Generated', value: format(new Date(), 'd MMM yyyy HH:mm') });
  detailFields.push({ label: 'Document ID', value: docId });

  y = drawMetadataRows(doc, detailFields, y, mL);

  // Summary box
  const totalSessions = sessions.length;
  const completeSessions = sessions.filter(s => s.is_complete).length;
  const totalReadings = sessions.reduce((acc, s) => acc + s.lines.filter(l => l.pressure_value != null).length, 0);

  y = drawSummaryBox(doc, [
    { label: 'Sessions', value: String(totalSessions), accent: true },
    { label: 'Complete', value: String(completeSessions) },
    { label: 'Readings', value: String(totalReadings) },
  ], y, mL);

  // Sessions register
  y = drawSection(doc, 'Pressure Sessions', y, mL);

  const head = [['Date', 'Time', 'Type', 'Site / Location', 'Taken By', 'Sections', 'Status', 'Instrument', 'Notes']];

  const SESSION_TYPE_LABELS: Record<string, string> = {
    'pre-opening': 'Pre-opening',
    'during-operation': 'During operation',
    'after-adjustment': 'After adjustment',
    'in-service': 'During operation',
    'recheck': 'After adjustment',
    'other': 'Other',
  };

  const body = sessions.map(s => {
    const instrumentParts: string[] = [];
    if (s.reader_make) instrumentParts.push(s.reader_make);
    if (s.reader_model) instrumentParts.push(s.reader_model);
    if (s.reader_serial) instrumentParts.push(`S/N: ${s.reader_serial}`);
    const instrumentText = instrumentParts.length > 0 ? instrumentParts.join(' / ') : '—';

    const completedLines = s.lines.filter(l => l.pressure_value != null).length;

    return [
      s.session_date,
      s.session_time.slice(0, 5),
      SESSION_TYPE_LABELS[s.session_type] || s.session_type,
      `${s.site_name}${s.site_address ? `, ${s.site_address}` : ''}`,
      s.taken_by,
      `${completedLines}/${s.lines.length}`,
      s.is_complete ? 'Complete' : 'Incomplete',
      instrumentText,
      s.notes || '—',
    ];
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    styles: { ...PDF_TABLE_BODY_STYLES, fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { ...PDF_TABLE_HEAD_STYLES, fontSize: 7, cellPadding: 2 },
    alternateRowStyles: { ...PDF_TABLE_ALT_ROW },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 14 } },
    margin: { left: mL, right: mL },
    showHead: 'everyPage',
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      // Incomplete sessions highlighted
      if (data.column.index === 6 && data.cell.raw === 'Incomplete') {
        data.cell.styles.textColor = [217, 119, 6];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Detailed readings section
  y = (doc as any).lastAutoTable?.finalY + 8 || y + 20;

  for (const session of sessions) {
    if (session.lines.length === 0) continue;

    // Check if we need a new page
    const pageH = doc.internal.pageSize.getHeight();
    if (y + 30 > pageH - 22) {
      doc.addPage();
      y = 28;
    }

    y = drawSection(doc, `Session: ${session.session_date} ${session.session_time.slice(0, 5)} — ${SESSION_TYPE_LABELS[session.session_type] || session.session_type}`, y, mL);

    const readingsHead = [['Section', 'Reading Point', 'Time', 'Value', 'Unit', 'Notes']];
    const readingsBody = session.lines.map(l => [
      `${l.section_number}. ${l.section_name}`,
      l.reading_point || '—',
      l.reading_taken_at ? l.reading_taken_at.slice(0, 5) : '—',
      l.pressure_value != null ? String(l.pressure_value) : '—',
      l.pressure_unit,
      l.notes || '—',
    ]);

    autoTable(doc, {
      startY: y,
      head: readingsHead,
      body: readingsBody,
      theme: 'grid',
      styles: { ...PDF_TABLE_BODY_STYLES, fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { ...PDF_TABLE_HEAD_STYLES, fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { ...PDF_TABLE_ALT_ROW },
      margin: { left: mL, right: mL },
      showHead: 'everyPage',
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3 && data.cell.raw === '—') {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    y = (doc as any).lastAutoTable?.finalY + 5 || y + 20;
  }

  // Footers
  drawTemplateFooters(templateOpts);

  const filename = buildFileName(['pressure-readings', inflatableName, format(new Date(), 'yyyy-MM-dd')]);

  return { blob: doc.output('blob') as Blob, fileName: filename };
}
