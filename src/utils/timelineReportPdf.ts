/**
 * Timeline Report PDF Generator
 * Generates a formal chronological report of all activities across one or all rides.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import {
  drawTemplateHeader,
  drawTemplateFooters,
  generateDocumentId,
  drawSection,
  drawMetadataRows,
  checkOverflow,
  type DocTypeCode,
} from './pdfTemplate';
import {
  PDF_COLORS,
  buildFileName,
  PDF_TABLE_HEAD_STYLES,
  PDF_TABLE_BODY_STYLES,
  PDF_TABLE_ALT_ROW,
} from './pdfUtils';
import { storeRideDocument, getRideCode } from './rideDocumentService';
import { supabase } from '@/integrations/supabase/client';

export interface TimelineEvent {
  event_datetime: string;
  ride_id: string | null;
  ride_name: string;
  ride_code: string;
  event_type: string;
  title: string;
  description: string;
  reference_id: string;
  created_by_name: string | null;
  status: string;
  pdf_url: string | null;
  user_id: string;
}

interface TimelineReportOptions {
  events: TimelineEvent[];
  startDate: Date;
  endDate: Date;
  scope: 'single' | 'all';
  rideName?: string;
  rideId?: string;
  rideCode?: string;
  filters: {
    checks: boolean;
    defects: boolean;
    maintenance: boolean;
    compliance: boolean;
    amendments: boolean;
  };
  userId: string;
}

const EVENT_TYPE_COLORS: Record<string, [number, number, number]> = {
  CHECK: [22, 163, 74],       // green
  DEFECT: [185, 28, 28],      // red
  MAINTENANCE: [217, 119, 6], // amber
  COMPLIANCE: [30, 58, 95],   // navy
  AMENDMENT: [100, 116, 139], // slate
};

export async function generateTimelineReportPdf(opts: TimelineReportOptions): Promise<{
  blob: Blob;
  documentId: string;
  fileName: string;
}> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const docType: DocTypeCode = 'TL';

  // Generate document ID
  let documentId: string;
  if (opts.rideId) {
    documentId = await generateDocumentId(opts.rideId, docType);
  } else {
    // For all-rides, use a fallback
    const year = new Date().getFullYear();
    documentId = `RRD-TL-${year}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }

  // Header
  const templateOpts = { doc, title: 'TIMELINE REPORT', documentId, docType };
  let y = drawTemplateHeader(templateOpts);

  // Metadata
  y = drawSection(doc, 'Report Details', y);
  const dateRange = `${format(opts.startDate, 'dd MMM yyyy')} — ${format(opts.endDate, 'dd MMM yyyy')}`;
  const scopeLabel = opts.scope === 'single' ? (opts.rideName || 'Single Ride') : 'All Rides';
  const activeFilters = Object.entries(opts.filters)
    .filter(([, v]) => v)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))
    .join(', ');

  y = drawMetadataRows(doc, [
    { label: 'Date Range', value: dateRange },
    { label: 'Scope', value: scopeLabel },
    { label: 'Included Categories', value: activeFilters },
    { label: 'Total Events', value: String(opts.events.length) },
    { label: 'Generated', value: format(new Date(), "dd MMM yyyy 'at' HH:mm") },
  ], y);

  // Summary counts
  y = drawSection(doc, 'Summary', y);
  const counts: Record<string, number> = {};
  opts.events.forEach(e => { counts[e.event_type] = (counts[e.event_type] || 0) + 1; });
  const summaryFields = Object.entries(counts).map(([type, count]) => ({
    label: type.charAt(0) + type.slice(1).toLowerCase() + 's',
    value: String(count),
  }));
  y = drawMetadataRows(doc, summaryFields, y);

  // Main table
  y = checkOverflow(doc, y, 20);
  y = drawSection(doc, 'Timeline Events', y);

  const tableData = opts.events.map(e => [
    e.event_datetime ? format(new Date(e.event_datetime), 'dd/MM/yy HH:mm') : '—',
    opts.scope === 'all' ? (e.ride_name || 'Global') : '',
    e.event_type,
    e.title.length > 50 ? e.title.substring(0, 50) + '…' : e.title,
    e.reference_id ? e.reference_id.substring(0, 8) + '…' : '—',
    e.status || '—',
  ].filter((_, i) => opts.scope === 'all' || i !== 1));

  const columns = opts.scope === 'all'
    ? ['Date/Time', 'Ride', 'Type', 'Summary', 'Reference', 'Status']
    : ['Date/Time', 'Type', 'Summary', 'Reference', 'Status'];

  autoTable(doc, {
    startY: y,
    head: [columns],
    body: tableData,
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: PDF_COLORS.body,
      lineColor: PDF_COLORS.border,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: PDF_COLORS.navy,
      textColor: PDF_COLORS.white,
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 15, right: 15 },
    didParseCell: (data) => {
      // Color the Type column
      const typeColIdx = opts.scope === 'all' ? 2 : 1;
      if (data.section === 'body' && data.column.index === typeColIdx) {
        const eventType = String(data.cell.raw);
        const color = EVENT_TYPE_COLORS[eventType];
        if (color) {
          data.cell.styles.textColor = color;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Defects appendix
  if (opts.filters.defects) {
    const defectEvents = opts.events.filter(e => e.event_type === 'DEFECT');
    if (defectEvents.length > 0) {
      doc.addPage();
      let ay = 28;
      ay = drawSection(doc, 'Appendix: Defects Detail', ay);

      const defectData = defectEvents.map(e => [
        e.event_datetime ? format(new Date(e.event_datetime), 'dd/MM/yy') : '—',
        e.ride_name || '—',
        e.title.replace('Defect: ', ''),
        e.description,
        e.status || '—',
      ]);

      autoTable(doc, {
        startY: ay,
        head: [['Date', 'Ride', 'Description', 'Severity', 'Status']],
        body: defectData,
        styles: { fontSize: 7, cellPadding: 2, textColor: PDF_COLORS.body, lineColor: PDF_COLORS.border, lineWidth: 0.2 },
        headStyles: { fillColor: PDF_COLORS.red, textColor: PDF_COLORS.white, fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        margin: { left: 15, right: 15 },
      });
    }
  }

  // Footers
  drawTemplateFooters(templateOpts);

  const blob = doc.output('blob');
  const parts = ['Timeline_Report'];
  if (opts.rideName) parts.push(opts.rideName);
  parts.push(format(opts.startDate, 'yyyyMMdd'), format(opts.endDate, 'yyyyMMdd'));
  const fileName = buildFileName(parts);

  return { blob, documentId, fileName };
}

/** Store the generated PDF in Supabase storage and document register */
export async function storeTimelineReportPdf(
  blob: Blob,
  fileName: string,
  documentId: string,
  opts: {
    rideId?: string;
    rideName?: string;
    userId: string;
    startDate: Date;
    endDate: Date;
    scope: 'single' | 'all';
  }
): Promise<string | null> {
  try {
    const filePath = `${opts.userId}/reports/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('ride-documents')
      .upload(filePath, blob, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      console.error('Failed to upload timeline PDF:', uploadError);
      return null;
    }

    // Store in documents table
    const docName = `Timeline Report — ${format(opts.startDate, 'dd MMM yyyy')} to ${format(opts.endDate, 'dd MMM yyyy')}`;
    const { error: docError } = await supabase.from('documents').insert({
      user_id: opts.userId,
      ride_id: opts.rideId || null,
      document_name: docName,
      document_type: 'timeline_report',
      file_path: filePath,
      is_global: !opts.rideId,
      notes: `Generated ${format(new Date(), "dd MMM yyyy 'at' HH:mm")} · Doc ID: ${documentId}`,
    });

    if (docError) {
      console.error('Failed to register timeline document:', docError);
    }

    // If ride-specific, also store in ride document register
    let rideDocId: string | null = null;
    if (opts.rideId) {
      const rideCode = await getRideCode(opts.rideId);
      rideDocId = await storeRideDocument({
        rideId: opts.rideId,
        rideCode: rideCode || '—',
        documentType: 'TL',
        documentId,
        fileUrl: filePath,
        title: docName,
        metadata: {
          start_date: format(opts.startDate, 'yyyy-MM-dd'),
          end_date: format(opts.endDate, 'yyyy-MM-dd'),
          scope: opts.scope,
        },
      });
    }

    return rideDocId || filePath;
  } catch (err) {
    console.error('Error storing timeline PDF:', err);
    return null;
  }
}
