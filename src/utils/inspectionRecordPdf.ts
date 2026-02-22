/**
 * Inspection Record PDF Generator
 * ================================
 * Generates a formal, immutable "Inspection Record" PDF using the
 * unified RideReadyDocs template. Linked from the Inspection Record page.
 *
 * Stored as doc type 'IR' in ride_documents.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  drawTemplateHeader,
  drawSection,
  drawMetadataRows,
  drawNotesBox,
  drawTemplateFooters,
  drawAuditTrail,
  checkOverflow,
  generateDocumentId,
  type AuditTrailEntry,
} from './pdfTemplate';
import { PDF_COLORS, PDF_TABLE_HEAD_STYLES, PDF_TABLE_BODY_STYLES, PDF_TABLE_ALT_ROW, blobToDataUrl } from './pdfUtils';
import { storeRideDocument, getRideCode } from './rideDocumentService';
import { updateInspectionRecordPdf, fetchRecordVersions, type InspectionRecord, type ItemResultSnapshot } from './inspectionRecordService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenerateInspectionRecordPdfParams {
  record: InspectionRecord;
  rideName: string;
  rideCategory?: string;
  rideManufacturer?: string;
  rideSerialNumber?: string;
  effectiveUserId: string;
}

interface GenerateInspectionRecordPdfResult {
  filePath: string;
  documentId: string;
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateInspectionRecordPdf(
  params: GenerateInspectionRecordPdfParams,
): Promise<GenerateInspectionRecordPdfResult | null> {
  const { record, rideName, rideCategory, rideManufacturer, rideSerialNumber, effectiveUserId } = params;

  try {
    // Generate document ID
    const docId = await generateDocumentId(record.ride_id, 'IR');
    const frequencyLabel = record.check_frequency === 'preopening'
      ? 'PRE-OPENING'
      : record.check_frequency.toUpperCase();

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const mL = 15;
    const mR = 15;
    const pageW = doc.internal.pageSize.getWidth();
    const contentW = pageW - mL - mR;

    const templateOpts = {
      doc,
      title: `${frequencyLabel} INSPECTION RECORD`,
      documentId: docId,
      docType: 'IR' as const,
    };

    // ── Header ──
    let y = drawTemplateHeader(templateOpts);

    // ── Overall result badge ──
    const resultText = record.overall_result === 'passed' || record.overall_result === 'completed'
      ? 'PASSED' : record.overall_result === 'failed' ? 'FAILED' : 'PARTIAL';
    const resultColor: [number, number, number] = resultText === 'PASSED'
      ? PDF_COLORS.green : resultText === 'FAILED' ? PDF_COLORS.red : PDF_COLORS.amber;

    // Draw status banner
    y = checkOverflow(doc, y, 14);
    doc.setFillColor(...resultColor);
    doc.roundedRect(mL, y, contentW, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`OVERALL RESULT: ${resultText}`, pageW / 2, y + 7, { align: 'center' });
    doc.setTextColor(0);
    y += 14;

    // ── Equipment Details ──
    y = drawSection(doc, 'Equipment Details', y);
    y = drawMetadataRows(doc, [
      { label: 'Equipment / Ride', value: rideName },
      { label: 'Category', value: rideCategory },
      { label: 'Manufacturer', value: rideManufacturer },
      { label: 'Serial Number', value: rideSerialNumber },
    ], y);

    // ── Inspection Details ──
    y = drawSection(doc, 'Inspection Details', y);
    y = drawMetadataRows(doc, [
      { label: 'Document Reference', value: docId },
      { label: 'Check Frequency', value: frequencyLabel },
      { label: 'Version', value: `v${record.version}` },
      { label: 'Check Completed By', value: record.inspector_name },
      { label: 'Check Date', value: format(new Date(record.check_date), 'dd MMM yyyy') },
      { label: 'Completed At', value: format(new Date(record.completed_at), "dd MMM yyyy 'at' HH:mm") },
      { label: 'Location', value: record.location },
      { label: 'Weather', value: record.weather_conditions },
      { label: 'Compliance Officer', value: record.compliance_officer },
    ], y);

    if (record.environment_notes) {
      y = drawNotesBox(doc, `Environment: ${record.environment_notes}`, y);
    }

    // ── Summary statistics ──
    const items = (record.item_results || []) as ItemResultSnapshot[];
    const passCount = items.filter(i => i.result === 'pass').length;
    const failCount = items.filter(i => i.result === 'fail').length;
    const naCount = items.filter(i => i.result === 'na').length;
    const defectCount = record.defect_ids?.length || 0;

    y = checkOverflow(doc, y, 22);
    y = drawSection(doc, 'Results Summary', y);

    // Summary boxes
    const boxW = contentW / 5;
    const summaryData = [
      { label: 'TOTAL', value: String(items.length), color: PDF_COLORS.navy },
      { label: 'PASSED', value: String(passCount), color: PDF_COLORS.green },
      { label: 'FAILED', value: String(failCount), color: PDF_COLORS.red },
      { label: 'N/A', value: String(naCount), color: PDF_COLORS.muted },
      { label: 'DEFECTS', value: String(defectCount), color: defectCount > 0 ? PDF_COLORS.red : PDF_COLORS.muted },
    ];

    doc.setFillColor(...PDF_COLORS.panelBg);
    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(mL, y, contentW, 16, 1.5, 1.5, 'FD');

    summaryData.forEach((item, i) => {
      const cx = mL + boxW * i + boxW / 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...item.color);
      doc.text(item.value, cx, y + 7, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(item.label, cx, y + 12, { align: 'center' });
    });
    y += 20;
    doc.setTextColor(0);

    // ── Checklist Results Table ──
    y = checkOverflow(doc, y, 30);
    y = drawSection(doc, 'Checklist Results', y);

    // Sort: failed first, then passed, then na
    const sortedItems = [...items].sort((a, b) => {
      const order = { fail: 0, pass: 1, na: 2 };
      return (order[a.result] ?? 2) - (order[b.result] ?? 2);
    });

    const tableHead = [['#', 'Description', 'Result', 'Notes']];
    const tableBody = sortedItems.map((item, idx) => {
      const resultLabel = item.result === 'pass' ? '✓ PASS' : item.result === 'fail' ? '✗ FAIL' : '○ N/A';
      return [
        String(idx + 1),
        item.check_item_text + (item.category ? ` [${item.category}]` : ''),
        resultLabel,
        item.notes || '—',
      ];
    });

    autoTable(doc, {
      startY: y,
      head: tableHead,
      body: tableBody,
      margin: { left: mL, right: mR },
      headStyles: {
        ...PDF_TABLE_HEAD_STYLES,
        fontSize: 7.5,
      },
      bodyStyles: {
        ...PDF_TABLE_BODY_STYLES,
        fontSize: 7,
      },
      alternateRowStyles: PDF_TABLE_ALT_ROW,
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 40 },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 2) {
          const val = String(data.cell.raw);
          if (val.includes('PASS')) {
            data.cell.styles.textColor = PDF_COLORS.green;
            data.cell.styles.fontStyle = 'bold';
          } else if (val.includes('FAIL')) {
            data.cell.styles.textColor = PDF_COLORS.red;
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = PDF_COLORS.muted;
          }
        }
      },
    });

    y = (doc as any).lastAutoTable?.finalY + 6 || y + 20;

    // ── Failures & Defects section ──
    const failedItems = items.filter(i => i.result === 'fail');
    if (failedItems.length > 0 || defectCount > 0) {
      y = checkOverflow(doc, y, 20);
      y = drawSection(doc, 'Failures & Defects', y);

      if (failedItems.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...PDF_COLORS.red);
        doc.text(`${failedItems.length} item(s) failed inspection:`, mL + 2, y);
        y += 5;

        for (const item of failedItems) {
          y = checkOverflow(doc, y, 12);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(...PDF_COLORS.body);
          doc.text(`• ${item.check_item_text}`, mL + 4, y);
          y += 4;
          if (item.notes) {
            doc.setFontSize(6.5);
            doc.setTextColor(...PDF_COLORS.muted);
            doc.text(`  Note: ${item.notes}`, mL + 6, y);
            y += 4;
          }
        }
        y += 2;
      }

      if (defectCount > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...PDF_COLORS.red);
        doc.text(`${defectCount} defect(s) raised during this inspection.`, mL + 2, y);
        y += 5;

        // List defect IDs
        if (record.defect_ids) {
          for (const defId of record.defect_ids) {
            y = checkOverflow(doc, y, 6);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(...PDF_COLORS.body);
            doc.text(`• Defect ref: ${defId.substring(0, 8)}...`, mL + 4, y);
            y += 4;
          }
        }
        y += 2;
      }

      // Photo paths indicator
      if (record.photo_paths && record.photo_paths.length > 0) {
        y = checkOverflow(doc, y, 8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...PDF_COLORS.muted);
        doc.text(`📷 ${record.photo_paths.length} photo(s) attached to this inspection record.`, mL + 2, y);
        y += 6;
      }
    }

    // ── Additional Notes ──
    if (record.notes) {
      y = checkOverflow(doc, y, 15);
      y = drawSection(doc, 'Additional Notes', y);
      y = drawNotesBox(doc, record.notes, y);
    }

    // ── Confirmation Statement ──
    y = checkOverflow(doc, y, 25);
    y = drawSection(doc, 'Confirmation Statement', y);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.3);
    const confirmText =
      'I confirm that all items have been inspected and the results recorded accurately. ' +
      'This record forms part of the statutory safety documentation for the equipment listed above.';
    const confirmLines = doc.splitTextToSize(confirmText, contentW - 8);
    const confirmBoxH = confirmLines.length * 4 + 14;
    doc.roundedRect(mL, y, contentW, confirmBoxH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_COLORS.body);
    doc.text(confirmLines, mL + 4, y + 5);

    const signedY = y + confirmLines.length * 4 + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.navy);
    doc.text(
      `Confirmed by: ${record.inspector_name}  ·  ${format(new Date(record.completed_at), "dd MMM yyyy 'at' HH:mm")}`,
      mL + 4,
      signedY,
    );
    y += confirmBoxH + 4;

    // ── Audit Trail ──
    const versions = await fetchRecordVersions(record.check_id);
    const auditEntries: AuditTrailEntry[] = versions.map(v => ({
      version: v.version,
      status: v.superseded_by_id ? 'superseded' as const : 'active' as const,
      created_at: v.created_at,
      created_by_name: v.inspector_name,
      created_by_role: null,
      updated_at: v.superseded_by_id ? v.created_at : null,
      edit_reason: v.amendment_reason,
    }));

    if (auditEntries.length > 0) {
      y = checkOverflow(doc, y, 20);
      y = drawAuditTrail(doc, auditEntries, y);
    }

    // ── Footers ──
    drawTemplateFooters(templateOpts);

    // ── Upload PDF ──
    const pdfBlob = doc.output('blob');
    const safeRideName = rideName.replace(/[^a-z0-9]/gi, '_');
    const dateStr = format(new Date(record.check_date), 'yyyyMMdd');
    const filePath = `${effectiveUserId}/${record.ride_id}/inspection-records/IR_${safeRideName}_v${record.version}_${dateStr}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('ride-documents')
      .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      console.error('Failed to upload inspection record PDF:', uploadError);
      return null;
    }

    // Register in ride_documents
    const rideCode = await getRideCode(record.ride_id);
    await storeRideDocument({
      rideId: record.ride_id,
      rideCode,
      documentType: 'IR',
      documentId: docId,
      fileUrl: filePath,
      title: `${frequencyLabel} Safety Check Record – ${rideName} – v${record.version}`,
      metadata: {
        checked_by: record.inspector_name,
        frequency: record.check_frequency,
        version: record.version,
        overall_result: record.overall_result,
        check_id: record.check_id,
      },
    });

    // Update inspection_records row with PDF reference
    await updateInspectionRecordPdf(record.id, filePath, docId);

    return { filePath, documentId: docId };
  } catch (err) {
    console.error('Error generating inspection record PDF:', err);
    return null;
  }
}
