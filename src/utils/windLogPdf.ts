import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

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

interface WindLogPdfOptions {
  entries: WindLogPdfEntry[];
  title: string;
  subtitle?: string;
  dateRange?: { from?: string; to?: string };
  location?: string;
  inflatableName?: string;
  companyName?: string;
}

export function generateWindLogPdf(options: WindLogPdfOptions) {
  const { entries, title, subtitle, dateRange, location, inflatableName, companyName } = options;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(22, 48, 71); // primary navy
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 10, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const metaParts: string[] = [];
  if (companyName) metaParts.push(companyName);
  if (inflatableName) metaParts.push(`Equipment: ${inflatableName}`);
  if (location) metaParts.push(`Location: ${location}`);
  if (dateRange?.from || dateRange?.to) {
    const from = dateRange.from || '—';
    const to = dateRange.to || '—';
    metaParts.push(`Period: ${from} to ${to}`);
  }
  metaParts.push(`Generated: ${format(new Date(), 'd MMM yyyy HH:mm')}`);

  doc.text(metaParts.join('  |  '), 10, 18);

  // Table
  const showAppliesTo = !inflatableName; // only show if not single-inflatable report

  const head = [
    ['Date', 'Time', 'Speed', 'Unit', 'Location', 'Recorded By', ...(showAppliesTo ? ['Applies To'] : []), 'Action Taken', 'Notes'],
  ];

  const body = entries.map(e => [
    e.log_date,
    e.log_time.slice(0, 5),
    String(e.wind_speed),
    e.wind_unit,
    e.location || '—',
    e.recorded_by,
    ...(showAppliesTo ? [(e.linked_rides || []).join(', ') || '—'] : []),
    e.action_taken || '—',
    e.notes || '—',
  ]);

  autoTable(doc, {
    startY: 28,
    head,
    body,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [22, 48, 71], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: showAppliesTo
      ? { 0: { cellWidth: 22 }, 1: { cellWidth: 14 }, 2: { cellWidth: 14 }, 3: { cellWidth: 12 }, 6: { cellWidth: 45 } }
      : { 0: { cellWidth: 22 }, 1: { cellWidth: 14 }, 2: { cellWidth: 14 }, 3: { cellWidth: 12 } },
  });

  // Summary footer
  const finalY = (doc as any).lastAutoTable?.finalY || 180;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Total readings: ${entries.length}`, 10, finalY + 8);

  // Save
  const filename = inflatableName
    ? `wind-log-${inflatableName.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`
    : `wind-log-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  doc.save(filename);
}
