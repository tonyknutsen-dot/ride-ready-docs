import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  Download, 
  FileDown,
  FileText,
  TrendingUp,
  CheckCircle2,
  XCircle,
  MinusCircle,
  MapPin,
  Cloud,
  Eye,
  RefreshCw,
  AlertTriangle,
  Loader2,
  CloudOff,
  Paperclip,
} from 'lucide-react';
import { format, parseISO, subDays, startOfMonth, endOfMonth, startOfYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { EmptyState } from '@/components/EmptyState';
import CheckDetailDialog from './CheckDetailDialog';
import { useOfflineCheckHistory, type OfflineCheckDisplay } from '@/hooks/useOfflineCheckHistory';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { offlineDb } from '@/lib/offlineDb';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PDF_COLORS,
  buildFileName,
  blobToDataUrl,
  drawSectionTitle,
  drawEquipmentDetails,
  drawSummaryBox,
  PDF_TABLE_HEAD_STYLES,
  PDF_TABLE_BODY_STYLES,
  PDF_TABLE_ALT_ROW,
} from '@/utils/pdfUtils';
import {
  drawTemplateHeader,
  drawTemplateFooters,
  generateDocumentId,
} from '@/utils/pdfTemplate';
import { storeRideDocument, getRideCode } from '@/utils/rideDocumentService';
import ExportActionsDialog, { type ExportResult } from '@/components/ExportActionsDialog';
import RegisterHeader, { PreviousReportsSection } from '@/components/RegisterHeader';

type Check = Tables<'checks'>;

type CheckWithResults = Check & {
  check_results: Array<{
    is_checked: boolean;
    result: 'pass' | 'fail' | 'na' | null;
    template_item_id: string;
  }>;
};

interface ChecksHistoryProps {
  rideId: string;
  rideName: string;
  frequency?: string;
}

interface MonthGroup {
  month: string;
  checks: CheckWithResults[];
  passRate: number;
  totalChecks: number;
  passedChecks: number;
}

const ChecksHistory = ({ rideId, rideName, frequency = 'daily' }: ChecksHistoryProps) => {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const { isOnline } = useOnlineStatus();
  const { syncAll, isSyncing } = useOfflineSync();
  const { offlineChecks, refresh: refreshOffline } = useOfflineCheckHistory(rideId, frequency);
  const [checks, setChecks] = useState<CheckWithResults[]>([]);
  const [filteredChecks, setFilteredChecks] = useState<CheckWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCheck, setSelectedCheck] = useState<CheckWithResults | null>(null);
  const [showCheckDetail, setShowCheckDetail] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [savedReports, setSavedReports] = useState<Array<{ id: string; document_name: string; uploaded_at: string; file_path: string }>>([]);
  const itemsPerPage = 20;

  const hasFailedItems = offlineChecks.some(c => c.syncStatus === 'failed');

  const retryFailed = async () => {
    await offlineDb.offlineChecks
      .where('syncStatus')
      .equals('failed')
      .modify({ syncStatus: 'pending', syncAttempts: 0 });
    await offlineDb.offlineDefects
      .where('syncStatus')
      .equals('failed')
      .modify({ syncStatus: 'pending', syncAttempts: 0 });
    refreshOffline();
    syncAll();
  };

  // Load saved reports
  useEffect(() => {
    if (!effectiveUserId || !rideId) return;
    supabase
      .from('documents')
      .select('id, document_name, uploaded_at, file_path')
      .eq('user_id', effectiveUserId)
      .eq('ride_id', rideId)
      .eq('document_type', 'CH')
      .order('uploaded_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setSavedReports(data);
      });
  }, [effectiveUserId, rideId]);

  useEffect(() => {
    if (effectiveUserId) {
      loadChecks();
    }
  }, [effectiveUserId, rideId, dateFrom, dateTo]);

  useEffect(() => {
    applyFilters();
  }, [checks, searchTerm, frequencyFilter, statusFilter]);

  const getDateRange = () => {
    const today = new Date();
    const startDate = dateFrom || subDays(today, 30);
    const endDate = dateTo || today;
    return { 
      startDate: format(startDate, 'yyyy-MM-dd'), 
      endDate: format(endDate, 'yyyy-MM-dd') 
    };
  };

  const loadChecks = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange();

      const { data, error } = await supabase
        .from('checks')
        .select(`
          *,
          check_results (
            is_checked,
            result,
            template_item_id
          )
        `)
        .eq('user_id', effectiveUserId)
        .eq('ride_id', rideId)
        .in('check_frequency', frequency === 'daily' ? ['daily', 'preopening'] : [frequency])
        .eq('is_test_data', false)
        .gte('check_date', startDate)
        .lte('check_date', endDate)
        .order('check_date', { ascending: false });

      if (error) throw error;

      setChecks(data as CheckWithResults[] || []);
    } catch (error) {
      console.error('Error loading checks:', error);
      if (navigator.onLine) {
        toast({
          title: "Error",
          description: "Failed to load checks history",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...checks];

    if (searchTerm) {
      filtered = filtered.filter(check => 
        check.inspector_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (check.notes && check.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (frequencyFilter !== 'all') {
      filtered = filtered.filter(check => check.check_frequency === frequencyFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(check => check.status === statusFilter);
    }

    setFilteredChecks(filtered);
    setCurrentPage(1);
  };

  const groupByMonth = (): MonthGroup[] => {
    const groups: { [key: string]: CheckWithResults[] } = {};

    filteredChecks.forEach(check => {
      const monthKey = format(parseISO(check.check_date), 'MMMM yyyy');
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(check);
    });

    return Object.entries(groups).map(([month, checks]) => {
      const passedChecks = checks.filter(c => c.status === 'passed' || c.status === 'completed').length;
      const totalChecks = checks.length;
      const passRate = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;

      return {
        month,
        checks,
        passRate: Math.round(passRate),
        totalChecks,
        passedChecks
      };
    });
  };

  const overallStats = {
    total: filteredChecks.length,
    passed: filteredChecks.filter(c => c.status === 'passed' || c.status === 'completed').length,
    failed: filteredChecks.filter(c => c.status === 'failed').length,
    partial: filteredChecks.filter(c => c.status === 'partial').length,
    passRate: filteredChecks.length > 0 
      ? Math.round((filteredChecks.filter(c => c.status === 'passed' || c.status === 'completed').length / filteredChecks.length) * 100)
      : 0
  };

  const exportToPDF = async () => {
    const doc = new jsPDF();
    const docId = await generateDocumentId(rideId, 'CH');

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user?.id)
      .single();

    let logoDataUrl: string | null = null;
    if (profile?.company_logo_path) {
      try {
        const { data: logoBlob } = await supabase.storage
          .from('ride-documents')
          .download(profile.company_logo_path);
        if (logoBlob) logoDataUrl = await blobToDataUrl(logoBlob);
      } catch (_) { /* skip */ }
    }

    let rideImageDataUrl: string | null = null;
    const { data: rideImageDoc } = await supabase
      .from('documents')
      .select('file_path')
      .eq('ride_id', rideId)
      .like('mime_type', 'image/%')
      .limit(1)
      .maybeSingle();

    if (rideImageDoc) {
      try {
        const { data: imageBlob } = await supabase.storage
          .from('ride-documents')
          .download(rideImageDoc.file_path);
        if (imageBlob) rideImageDataUrl = await blobToDataUrl(imageBlob);
      } catch (_) { /* skip */ }
    }

    const { startDate, endDate } = getDateRange();
    const frequencyLabel = frequency === 'daily' ? 'DAILY / PRE-OPENING' : frequency === 'monthly' ? 'MONTHLY' : frequency === 'yearly' ? 'YEARLY' : frequency.toUpperCase();
    const templateOpts = { doc, title: `${frequencyLabel} SAFETY CHECKS`, documentId: docId, docType: 'CH' as const };

    let currentY = drawTemplateHeader(templateOpts);

    currentY = drawSectionTitle(doc, 'Equipment Details', currentY);
    currentY = await drawEquipmentDetails({
      doc,
      y: currentY,
      fields: [
        { label: 'Equipment', value: rideName },
        { label: 'Total Checks', value: String(filteredChecks.length) },
        { label: 'Pass Rate', value: `${overallStats.passRate}%` },
        { label: 'Period', value: `${startDate} – ${endDate}` },
      ],
      imageDataUrl: rideImageDataUrl,
    });

    currentY = drawSummaryBox(doc, [
      { label: 'Total Checks', value: String(overallStats.total) },
      { label: 'Passed', value: String(overallStats.passed), accent: true },
      { label: 'Failed', value: String(overallStats.failed) },
      { label: 'Pass Rate', value: `${overallStats.passRate}%`, accent: true },
    ], currentY);

    for (const check of filteredChecks) {
      doc.addPage();
      let y = 20;

      y = drawSectionTitle(doc, `Safety Check — ${format(parseISO(check.check_date), 'd MMM yyyy')}`, y);

      autoTable(doc, {
        startY: y,
        body: [
          ['Date', format(parseISO(check.check_date), 'd MMM yyyy'), 'Checked By', check.inspector_name],
          ['Frequency', check.check_frequency, 'Status', check.status.toUpperCase()],
          ...(((check as any).weather_conditions || (check as any).location) ? [
            ['Weather', (check as any).weather_conditions || '-', 'Location', (check as any).location || '-'],
          ] : []),
        ],
        styles: { ...PDF_TABLE_BODY_STYLES },
        alternateRowStyles: PDF_TABLE_ALT_ROW,
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 }, 2: { fontStyle: 'bold', cellWidth: 32 } },
        margin: { left: 13, right: 13 },
      });

      y = (doc as any).lastAutoTable.finalY + 6;

      if (check.check_results && check.check_results.length > 0) {
        const passed = check.check_results.filter(r => r.result === 'pass' || (r.result === null && r.is_checked)).length;
        const failed = check.check_results.filter(r => r.result === 'fail').length;
        const total = check.check_results.length;

        y = drawSummaryBox(doc, [
          { label: 'Items Checked', value: String(total) },
          { label: 'Passed', value: String(passed), accent: true },
          { label: 'Failed', value: String(failed) },
          { label: 'Result', value: failed === 0 ? 'PASS' : 'FAIL', accent: failed === 0 },
        ], y);
      }

      if (check.notes) {
        y = drawSectionTitle(doc, 'Notes', y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...PDF_COLORS.body);
        const lines = doc.splitTextToSize(check.notes, doc.internal.pageSize.getWidth() - 26);
        doc.text(lines, 13, y);
      }
    }

    drawTemplateFooters(templateOpts);

    const pdfBlob = doc.output('blob');
    const fileName = buildFileName([rideName, frequency, 'SafetyChecks', format(new Date(), 'yyyyMMdd')]);

    const saveToDocuments = async () => {
      const storagePath = `${effectiveUserId}/checks-history/${rideId}/${Date.now()}-${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('ride-documents')
        .upload(storagePath, pdfBlob, { contentType: 'application/pdf', upsert: true });
      if (uploadError) throw uploadError;

      const rideCode = await getRideCode(rideId);
      await storeRideDocument({
        rideId,
        rideCode,
        documentType: 'CH',
        documentId: docId,
        fileUrl: storagePath,
        title: `${frequencyLabel} Safety Checks – ${rideName} – ${format(new Date(), 'dd MMM yyyy')}`,
        metadata: { checkCount: filteredChecks.length, passRate: overallStats.passRate },
      });
    };

    setExportResult({ blob: pdfBlob, fileName, onSaveToDocuments: saveToDocuments, saveLabel: 'Save to Asset Documents' });
    setExportDialogOpen(true);
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Frequency', 'Checked By', 'Status', 'Weather', 'Location', 'Notes'];
    const rows = filteredChecks.map(check => [
      format(parseISO(check.check_date), 'yyyy-MM-dd'),
      check.check_frequency,
      check.inspector_name,
      check.status,
      (check as any).weather_conditions || '',
      (check as any).location || '',
      check.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const fileName = `checks-history-${rideName}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    setExportResult({ blob, fileName });
    setExportDialogOpen(true);
  };

  const handleViewReport = (filePath: string) => {
    window.open(`/documents/view?path=${encodeURIComponent(filePath)}`, '_blank');
  };

  const monthGroups = groupByMonth();
  const totalPages = Math.ceil(filteredChecks.length / itemsPerPage);
  const hasActiveFilters = searchTerm !== '' || frequencyFilter !== 'all' || statusFilter !== 'all' || !!dateFrom || !!dateTo;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 animate-pulse h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4">

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <KpiCard title={frequency === 'daily' ? 'Daily / Pre-Opening' : `${frequency.charAt(0).toUpperCase() + frequency.slice(1)}`} value={overallStats.total} tone="neutral" />
        <KpiCard title="Passed" value={overallStats.passed} tone="good" />
        <KpiCard title="Failed" value={overallStats.failed} tone="bad" />
        <KpiCard title="Pass Rate" value={`${overallStats.passRate}%`} tone={overallStats.passRate >= 80 ? 'good' : overallStats.passRate >= 50 ? 'warn' : 'bad'} />
      </div>

      {/* ── RegisterHeader (actions, search, filters, result count) ── */}
      <RegisterHeader
        resultCount={`${filteredChecks.length} check record${filteredChecks.length !== 1 ? 's' : ''}`}
        totalCount={checks.length}
        hasActiveFilters={hasActiveFilters}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by name or notes…"
        actions={[
          { label: 'Export PDF', icon: <FileDown className="h-3.5 w-3.5" />, onClick: exportToPDF, variant: 'outline' },
          { label: 'Export CSV', icon: <Download className="h-3.5 w-3.5" />, onClick: exportToCSV, variant: 'outline' },
        ]}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        filterContent={
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Frequency</Label>
              <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
                <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frequencies</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="preopening">Pre-Opening</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        savedReports={savedReports}
        onViewReport={handleViewReport}
      />

      {/* ── Offline pending checks ── */}
      {offlineChecks.length > 0 && (
        <div className="rounded-xl border border-warning/40 overflow-hidden">
          <div className="flex items-start justify-between gap-3 p-3 bg-warning/5">
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                <CloudOff className="h-4 w-4 text-warning" />
                Pending Sync
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {offlineChecks.length} check{offlineChecks.length !== 1 ? 's' : ''} saved locally
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {hasFailedItems && (
                <Button variant="outline" size="sm" onClick={retryFailed} disabled={isSyncing} className="h-8 text-xs gap-1 border-destructive/30 text-destructive">
                  <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                  Retry
                </Button>
              )}
              {isOnline && (
                <Button variant="outline" size="sm" onClick={syncAll} disabled={isSyncing} className="h-8 text-xs gap-1 border-primary/30 text-primary">
                  <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                  Sync now
                </Button>
              )}
            </div>
          </div>
          <div className="p-3 space-y-2.5">
            {offlineChecks.map((oc) => (
              <OfflineCheckRow key={oc.localId} check={oc} />
            ))}
          </div>
        </div>
      )}

      {/* ── Month groups ── */}
      {monthGroups.length === 0 && offlineChecks.length === 0 ? (
        <EmptyState icon={FileText} title="No checks found" description="No checks found for the selected filters" variant="compact" />
      ) : (
        monthGroups.map((group) => (
          <div key={group.month} className="rounded-xl border border-border overflow-hidden">
            {/* Month header */}
            <div className="flex items-start justify-between gap-3 p-3 border-b border-border bg-muted/30">
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground">{group.month}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {group.totalChecks} check{group.totalChecks !== 1 ? 's' : ''} · {group.passedChecks} passed · {group.passRate}% pass rate
                </div>
              </div>
              <span className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold border",
                group.passRate >= 80 ? 'bg-success/10 border-success/30 text-success' :
                group.passRate >= 50 ? 'bg-warning/10 border-warning/30 text-warning' :
                                       'bg-destructive/10 border-destructive/30 text-destructive'
              )}>
                {group.passRate}%
              </span>
            </div>

            {/* Check rows */}
            <div className="p-3 space-y-2.5">
              {group.checks.map((check) => (
                <button
                  key={check.id}
                  type="button"
                  onClick={() => { setSelectedCheck(check); setShowCheckDetail(true); }}
                  className={cn(
                    'w-full text-left rounded-xl border border-border bg-card p-3 flex items-start justify-between gap-3 min-w-0',
                    'hover:bg-muted/30 active:bg-muted/50 transition-colors min-h-[56px]'
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(check.check_date), 'd MMM yyyy')} · <span className="font-semibold capitalize">{check.check_frequency}</span>
                    </div>
                    <div className="font-bold text-foreground truncate text-sm">{check.inspector_name}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
                      {(check as any).weather_conditions && (
                        <span className="flex items-center gap-1">
                          <Cloud className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[120px]">{(check as any).weather_conditions}</span>
                        </span>
                      )}
                      {(check as any).location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[140px]">{(check as any).location}</span>
                        </span>
                      )}
                    </div>
                    {check.notes && (
                      <p className="text-xs text-muted-foreground italic line-clamp-1">{check.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-extrabold border",
                      (check.status === 'passed' || check.status === 'completed')  ? 'bg-success/10 border-success/30 text-success' :
                      check.status === 'failed'  ? 'bg-destructive/10 border-destructive/30 text-destructive' :
                      check.status === 'partial' ? 'bg-warning/10 border-warning/30 text-warning' :
                                                   'bg-muted border-border text-muted-foreground'
                    )}>
                      {check.status === 'completed' ? 'Passed' :
                       check.status === 'failed' && check.check_results?.some(r => r.result === 'fail') ? 'Failed' :
                       check.status.charAt(0).toUpperCase() + check.status.slice(1)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredChecks.length)} of {filteredChecks.length}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-9 text-xs">
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-9 text-xs">
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ── Previously Generated Reports ── */}
      <PreviousReportsSection reports={savedReports} onViewReport={handleViewReport} />

      <CheckDetailDialog check={selectedCheck} open={showCheckDetail} onOpenChange={setShowCheckDetail} />
    </div>

    <ExportActionsDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} result={exportResult} />
    </>
  );
};

// ── Local sub-components ──────────────────────────────────────────────

function KpiCard({ title, value, tone }: { title: string; value: number | string; tone: 'neutral' | 'good' | 'bad' | 'warn' }) {
  const cls =
    tone === 'good' ? 'border-success/30 bg-success/5' :
    tone === 'bad'  ? 'border-destructive/30 bg-destructive/5' :
    tone === 'warn' ? 'border-warning/30 bg-warning/5' :
                      'border-border bg-card';
  return (
    <div className={cn('rounded-2xl border shadow-sm p-3.5', cls)}>
      <div className="text-[10px] font-bold text-muted-foreground truncate">{title}</div>
      <div className="mt-1 text-2xl font-extrabold text-foreground">{value}</div>
    </div>
  );
}

function OfflineCheckRow({ check }: { check: OfflineCheckDisplay }) {
  const syncBadge = () => {
    switch (check.syncStatus) {
      case 'pending':
      case 'syncing':
        return (
          <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold border bg-warning/10 border-warning/30 text-warning flex items-center gap-1">
            {check.syncStatus === 'syncing' ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudOff className="h-3 w-3" />}
            Pending Sync
          </span>
        );
      case 'failed':
        return (
          <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold border bg-destructive/10 border-destructive/30 text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Sync Failed
          </span>
        );
      case 'synced':
        if (check.hasLinkedDefects && !check.defectsSynced) {
          return (
            <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold border bg-warning/10 border-warning/30 text-warning flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              Attachments pending
            </span>
          );
        }
        return (
          <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold border bg-success/10 border-success/30 text-success flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Synced
          </span>
        );
    }
  };

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 flex items-start justify-between gap-3 min-w-0">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-xs text-muted-foreground">
          {check.checkDate} · <span className="font-semibold capitalize">{check.checkFrequency}</span>
        </div>
        <div className="font-bold text-foreground truncate text-sm">{check.inspectorName}</div>
        {check.itemCount && (
          <div className="text-xs text-muted-foreground">{check.itemCount} items checked</div>
        )}
      </div>
      <div className="shrink-0">
        {syncBadge()}
      </div>
    </div>
  );
}

export default ChecksHistory;
