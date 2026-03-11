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
  drawSummaryBox,
  generateDocId,
  buildFileName,
  PDF_TABLE_HEAD_STYLES,
  PDF_TABLE_BODY_STYLES,
  PDF_TABLE_ALT_ROW,
} from './pdfUtils';
import { fetchEquipmentPhoto, drawEquipmentPhotoInHeader } from './pdfEquipmentPhoto';
import {
  getPressureStatus, getSessionOverallStatus, findSectionLimits,
  type SectionLimits,
} from './pressureValidation';

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
  defaultUnit?: string;
  sectionConfig?: SectionLimits[];
  dateRange?: { from?: string; to?: string };
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  'pre-opening': 'Pre-opening',
  'during-operation': 'During operation',
  'end-of-day': 'End of day',
  'after-adjustment': 'End of day',
  'in-service': 'During operation',
  'recheck': 'End of day',
  'other': 'Other',
};

export async function generatePressureReadingsPdf(options: PressureReadingsPdfOptions) {
  const { sessions, inflatableName, rideId, companyName, controllerName, defaultUnit, sectionConfig, dateRange } = options;

  let equipmentPhoto: { dataUrl: string; naturalW: number; naturalH: number } | null = null;
  equipmentPhoto = await fetchEquipmentPhoto(rideId);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const docId = generateDocId('CHECK');
  const mL = 15;

  let period = '';
  if (dateRange?.from && dateRange?.to) period = `${dateRange.from} – ${dateRange.to}`;
  else if (dateRange?.from) period = `From ${dateRange.from}`;
  else if (dateRange?.to) period = `To ${dateRange.to}`;

  const templateOpts: PdfTemplateOptions = {
    doc,
    title: 'PRESSURE READINGS REGISTER',
    documentId: docId,
    docType: 'CR',
    disclaimer: 'System-generated pressure reading record for operational monitoring and compliance purposes.',
  };
  let y = drawTemplateHeader(templateOpts);

  if (equipmentPhoto) {
    drawEquipmentPhotoInHeader(doc, equipmentPhoto, pageWidth - mL - 30, y, 28, 20);
  }

  y = drawSection(doc, 'Report Details', y, mL);

  const detailFields: MetadataField[] = [];
  if (companyName) detailFields.push({ label: 'Company', value: companyName });
  if (controllerName) detailFields.push({ label: 'Controller / Duty Holder', value: controllerName });
  detailFields.push({ label: 'Inflatable', value: inflatableName });
  if (defaultUnit) detailFields.push({ label: 'Pressure Unit', value: defaultUnit.toUpperCase() });
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

  // Section limits summary (if configured)
  const hasLimits = sectionConfig && sectionConfig.some(sc => sc.min_pressure != null || sc.max_pressure != null);
  if (hasLimits && sectionConfig) {
    y = drawSection(doc, 'Configured Pressure Limits', y, mL);
    const limitsHead = [['Section', 'Target', 'Minimum', 'Maximum', 'Unit']];
    const limitsBody = sectionConfig.map((sc, i) => [
      `Section ${i + 1}`,
      sc.target_pressure != null ? String(sc.target_pressure) : '—',
      sc.min_pressure != null ? String(sc.min_pressure) : '—',
      sc.max_pressure != null ? String(sc.max_pressure) : '—',
      defaultUnit?.toUpperCase() || 'PSI',
    ]);
    autoTable(doc, {
      startY: y,
      head: limitsHead,
      body: limitsBody,
      theme: 'grid',
      styles: { ...PDF_TABLE_BODY_STYLES, fontSize: 7, cellPadding: 2 },
      headStyles: { ...PDF_TABLE_HEAD_STYLES, fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { ...PDF_TABLE_ALT_ROW },
      margin: { left: mL, right: mL },
    });
    y = (doc as any).lastAutoTable?.finalY + 5 || y + 15;
  }

  // Summary box
  const totalSessions = sessions.length;
  const completeSessions = sessions.filter(s => s.is_complete).length;
  const totalReadings = sessions.reduce((acc, s) => acc + s.lines.filter(l => l.pressure_value != null).length, 0);

  // Count out-of-range readings
  let outOfRangeCount = 0;
  if (sectionConfig) {
    for (const s of sessions) {
      for (const l of s.lines) {
        const limits = findSectionLimits(sectionConfig, l.section_number - 1);
        const status = getPressureStatus(l.pressure_value, limits);
        if (status.status === 'below_minimum' || status.status === 'above_maximum') outOfRangeCount++;
      }
    }
  }

  const summaryItems = [
    { label: 'Sessions', value: String(totalSessions), accent: true },
    { label: 'Complete', value: String(completeSessions) },
    { label: 'Readings', value: String(totalReadings) },
  ];
  if (hasLimits) {
    summaryItems.push({ label: 'Out of range', value: String(outOfRangeCount), accent: outOfRangeCount > 0 });
  }

  y = drawSummaryBox(doc, summaryItems, y, mL);

  // Sessions register table
  y = drawSection(doc, 'Pressure Sessions', y, mL);

  const head = [['Date', 'Time', 'Type', 'Site / Location', 'Taken By', 'Sections', 'Result', 'Instrument', 'Notes']];

  const body = sessions.map(s => {
    const instrumentParts: string[] = [];
    if (s.reader_make) instrumentParts.push(s.reader_make);
    if (s.reader_model) instrumentParts.push(s.reader_model);
    if (s.reader_serial) instrumentParts.push(`S/N: ${s.reader_serial}`);
    const instrumentText = instrumentParts.length > 0 ? instrumentParts.join(' / ') : '—';

    const completedLines = s.lines.filter(l => l.pressure_value != null).length;

    // Compute overall session status
    let sessionResult = s.is_complete ? 'PASS' : 'INCOMPLETE';
    if (sectionConfig && sectionConfig.length > 0) {
      const lineStatuses = s.lines.map((l, idx) => {
        const limits = findSectionLimits(sectionConfig, idx);
        return getPressureStatus(l.pressure_value, limits);
      });
      const overall = getSessionOverallStatus(lineStatuses, s.is_complete);
      sessionResult = overall.resultLabel;
    }

    return [
      s.session_date,
      s.session_time.slice(0, 5),
      SESSION_TYPE_LABELS[s.session_type] || s.session_type,
      `${s.site_name}${s.site_address ? `, ${s.site_address}` : ''}`,
      s.taken_by,
      `${completedLines}/${s.lines.length}`,
      sessionResult,
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
      if (data.column.index === 6) {
        const raw = String(data.cell.raw);
        if (raw === 'INCOMPLETE' || raw === 'FAILED') {
          data.cell.styles.textColor = raw === 'FAILED' ? [220, 38, 38] : [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else if (raw === 'PASS') {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Detailed readings section
  y = (doc as any).lastAutoTable?.finalY + 8 || y + 20;

  for (const session of sessions) {
    if (session.lines.length === 0) continue;

    const pageH = doc.internal.pageSize.getHeight();
    if (y + 30 > pageH - 22) {
      doc.addPage();
      y = 28;
    }

    y = drawSection(doc, `Session: ${session.session_date} ${session.session_time.slice(0, 5)} — ${SESSION_TYPE_LABELS[session.session_type] || session.session_type}`, y, mL);

    const readingsHead = hasLimits
      ? [['Section', 'Reading Point', 'Time', 'Value', 'Target', 'Min', 'Max', 'Status', 'Notes']]
      : [['Section', 'Reading Point', 'Time', 'Value', 'Unit', 'Notes']];

    const readingsBody = session.lines.map((l, idx) => {
      const limits = sectionConfig ? findSectionLimits(sectionConfig, idx) : undefined;
      const lineStatus = getPressureStatus(l.pressure_value, limits);

      if (hasLimits) {
        return [
          `${l.section_number}. ${l.section_name}`,
          l.reading_point || '—',
          l.reading_taken_at ? l.reading_taken_at.slice(0, 5) : '—',
          l.pressure_value != null ? `${l.pressure_value} ${l.pressure_unit}` : '—',
          limits?.target_pressure != null ? String(limits.target_pressure) : '—',
          limits?.min_pressure != null ? String(limits.min_pressure) : '—',
          limits?.max_pressure != null ? String(limits.max_pressure) : '—',
          lineStatus.label,
          l.notes || '—',
        ];
      }
      return [
        `${l.section_number}. ${l.section_name}`,
        l.reading_point || '—',
        l.reading_taken_at ? l.reading_taken_at.slice(0, 5) : '—',
        l.pressure_value != null ? String(l.pressure_value) : '—',
        l.pressure_unit,
        l.notes || '—',
      ];
    });

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
        if (data.section !== 'body') return;
        const statusCol = hasLimits ? 7 : -1;
        if (data.column.index === statusCol) {
          const raw = String(data.cell.raw);
          if (raw === 'Below minimum' || raw === 'Above maximum') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (raw === 'Within range') {
            data.cell.styles.textColor = [5, 150, 105];
            data.cell.styles.fontStyle = 'bold';
          }
        }
        // Missing value highlight
        const valueCol = hasLimits ? 3 : 3;
        if (data.column.index === valueCol && data.cell.raw === '—') {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    y = (doc as any).lastAutoTable?.finalY + 5 || y + 20;
  }

  drawTemplateFooters(templateOpts);

  const filename = buildFileName(['pressure-readings', inflatableName, format(new Date(), 'yyyy-MM-dd')]);

  return { blob: doc.output('blob') as Blob, fileName: filename };
}
