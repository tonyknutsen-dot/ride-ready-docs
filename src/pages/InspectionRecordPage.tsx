import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, addHours } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAppRole } from '@/hooks/useAppRole';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import {
  isWithinAmendmentWindow,
  type InspectionRecord,
  type ItemResultSnapshot,
} from '@/utils/inspectionRecordService';
import { generateInspectionRecordPdf } from '@/utils/inspectionRecordPdf';
import { ChecklistItemRow, normalizeChecklistSource, type ChecklistRowResult } from '@/components/checks/ChecklistItemRow';
import { InspectionAmendDialog } from '@/components/InspectionAmendDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft,
  Download,
  Edit3,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  Clock,
  Lock,
  FileText,
  Shield,
  Camera,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { markCheckDebug, setCheckDebugValue } from '@/utils/checkDebug';

const InspectionRecordPage = () => {
  const { recordId } = useParams<{ recordId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const role = useAppRole();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { effectiveUserId } = useEffectiveUserId();
  const queryClient = useQueryClient();
  const [amendRecord, setAmendRecord] = useState<InspectionRecord | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfRetryKey, setPdfRetryKey] = useState(0);
  const pdfGenerationAttemptedRef = useRef<string | null>(null);

  // Origin-aware back navigation: always returns to the canonical hub
  // (`/rides/:id?tab=checks`); `from=checks` makes the hub bounce to `/checks`.
  const fromParam = searchParams.get('from');
  const fromRideId = searchParams.get('rideId');
  const goBack = () => {
    if (fromRideId) {
      const suffix = fromParam === 'checks' ? '&from=checks' : '';
      setCheckDebugValue('any redirect target', `/rides/${fromRideId}?tab=checks${suffix}`);
      markCheckDebug('back target ready');
      navigate(`/rides/${fromRideId}?tab=checks${suffix}`);
    } else {
      setCheckDebugValue('any redirect target', 'history back');
      markCheckDebug('back target ready');
      navigate(-1);
    }
  };

  const { data: record, isLoading } = useQuery({
    queryKey: ['inspection-record', recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspection_records')
        .select('*')
        .eq('id', recordId!)
        .single();
      if (error) throw error;
      markCheckDebug('record detail fetched');
      return data as unknown as InspectionRecord;
    },
    enabled: !!recordId,
    refetchInterval: (query) => ((query.state.data as InspectionRecord | undefined)?.pdf_file_path ? false : 5000),
    refetchIntervalInBackground: true,
  });

  // Fetch ride name
  const { data: ride } = useQuery({
    queryKey: ['ride-name', record?.ride_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('rides')
        .select('ride_name, manufacturer, serial_number, ride_categories(name)')
        .eq('id', record!.ride_id)
        .single();
      return data;
    },
    enabled: !!record?.ride_id,
  });

  const pdfAvailablePath = record?.pdf_file_path ?? null;

  const handleDownloadPdf = async () => {
    if (!pdfAvailablePath || !record) {
      toast({ title: 'No PDF available', description: 'PDF has not been generated for this record.', variant: 'destructive' });
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from('ride-documents')
        .download(pdfAvailablePath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Check-Record-v${record.version}-${record.check_date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Download failed', description: 'Could not download the PDF.', variant: 'destructive' });
    }
  };

  const retryPdfGeneration = () => {
    if (!record) return;
    setPdfError(null);
    pdfGenerationAttemptedRef.current = null;
    setPdfRetryKey((key) => key + 1);
  };

  useEffect(() => {
    if (!record || record.pdf_file_path || !ride || !effectiveUserId || pdfGenerating || pdfGenerationAttemptedRef.current === `${record.id}:${pdfRetryKey}`) return;

    let cancelled = false;
    let timeoutId: number | null = null;
    const preparePdf = async () => {
      pdfGenerationAttemptedRef.current = `${record.id}:${pdfRetryKey}`;
      setPdfGenerating(true);
      setPdfError(null);
      try {
        const result = await Promise.race([
          generateInspectionRecordPdf({
          record,
          rideName: ride.ride_name,
          rideCategory: (ride as any)?.ride_categories?.name,
          rideManufacturer: (ride as any)?.manufacturer,
          rideSerialNumber: (ride as any)?.serial_number,
          effectiveUserId,
          }),
          new Promise<null>((resolve) => {
            timeoutId = window.setTimeout(() => resolve(null), 25000);
          }),
        ]);
        if (!cancelled && result) {
          await queryClient.invalidateQueries({ queryKey: ['inspection-record', recordId] });
          await queryClient.invalidateQueries({ queryKey: ['inspection-records'] });
        } else if (!cancelled) {
          setPdfError('PDF generation did not complete. You can retry now.');
        }
      } catch (error) {
        console.error('Inspection record PDF preparation failed:', error);
        if (!cancelled) setPdfError('PDF generation failed. Please retry.');
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
        if (!cancelled) setPdfGenerating(false);
      }
    };

    void preparePdf();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [effectiveUserId, pdfGenerating, pdfRetryKey, queryClient, record, recordId, ride]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <FileText className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Record not found</p>
        <Button variant="outline" onClick={goBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Go back
        </Button>
      </div>
    );
  }

  const items = (record.item_results || []) as ItemResultSnapshot[];
  const failedItems = items.filter((i) => i.result === 'fail');
  const passedItems = items.filter((i) => i.result === 'pass');
  const naItems = items.filter((i) => i.result === 'na');
  const defectCount = record.defect_ids?.length || 0;

  const isController = role === 'controller';
  const canAmend = isController && isWithinAmendmentWindow(record) && !record.superseded_by_id;
  const amendmentExpiry = addHours(parseISO(record.completed_at), 24);

  const getOverallBadge = () => {
    if (record.superseded_by_id) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold border bg-muted border-border text-muted-foreground line-through">
          <MinusCircle className="h-3.5 w-3.5" /> SUPERSEDED
        </span>
      );
    }
    if (record.amended_from_id) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold border bg-warning/10 border-warning/30 text-warning">
          <Edit3 className="h-3.5 w-3.5" /> AMENDED
        </span>
      );
    }
    if (record.overall_result === 'passed' || record.overall_result === 'completed') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold border bg-success/10 border-success/30 text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> PASSED
        </span>
      );
    }
    if (record.overall_result === 'failed') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold border bg-destructive/10 border-destructive/30 text-destructive">
          <XCircle className="h-3.5 w-3.5" /> FAILED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold border bg-warning/10 border-warning/30 text-warning">
        <MinusCircle className="h-3.5 w-3.5" /> PARTIAL
      </span>
    );
  };

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={goBack} aria-label="Go back">
              <ArrowLeft className="h-4.5 w-4.5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-foreground truncate">
                {record.template_name || 'Check Record'}
              </h1>
              <p className="text-[11px] text-muted-foreground truncate">
                {ride?.ride_name || 'Loading...'} · v{record.version}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {getOverallBadge()}
          </div>
        </div>
      </div>

        <div className="mx-auto max-w-3xl space-y-6 overflow-x-hidden px-3 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-5 sm:px-4 sm:pb-10 sm:pt-6">
        {/* ── Record Info ── */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Check Completed By</span>
              <p className="font-bold text-foreground mt-0.5">{record.inspector_name}</p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Completed</span>
              <p className="font-bold text-foreground mt-0.5">
                {format(parseISO(record.completed_at), 'd MMM yyyy, HH:mm')}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Location</span>
              <p className="font-medium text-foreground mt-0.5">{record.location || '—'}</p>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">Amendment Window</span>
              <p className={cn("font-medium mt-0.5", isWithinAmendmentWindow(record) ? "text-success" : "text-muted-foreground")}>
                {isWithinAmendmentWindow(record)
                  ? `Expires ${format(amendmentExpiry, 'd MMM yyyy, HH:mm')}`
                  : 'Expired'}
              </p>
            </div>
          </div>
          {record.weather_conditions && (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold">Weather:</span> {record.weather_conditions}
            </p>
          )}
        </div>

        <Separator />

        {/* ── Summary Cards ── */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <SummaryCard label="Total" value={items.length} />
          <SummaryCard label="Passed" value={passedItems.length} variant="success" />
          <SummaryCard label="Failed" value={failedItems.length} variant="destructive" />
          <SummaryCard label="N/A" value={naItems.length} variant="muted" />
          <SummaryCard label="Defects" value={defectCount} variant={defectCount > 0 ? 'destructive' : 'muted'} />
        </div>

        <Separator />

        {/* ── Check Items (grouped: Failed → Passed → N/A) ── */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Check Items</h2>

          {failedItems.length > 0 && (
            <ItemGroup label="Failed" icon={XCircle} items={failedItems} variant="destructive" defectIds={record.defect_ids} photoPaths={record.photo_paths} rideTypeName={(ride as any)?.ride_categories?.name} />
          )}
          {passedItems.length > 0 && (
            <ItemGroup label="Passed" icon={CheckCircle2} items={passedItems} variant="success" rideTypeName={(ride as any)?.ride_categories?.name} />
          )}
          {naItems.length > 0 && (
            <ItemGroup label="N/A" icon={MinusCircle} items={naItems} variant="muted" rideTypeName={(ride as any)?.ride_categories?.name} />
          )}
        </div>

        <Separator />

        {/* ── Confirmation Statement ── */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Confirmation
          </h3>
          <p className="text-sm text-foreground">
            I confirm that all check items have been completed accurately and the results recorded truthfully.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Confirmed by <span className="font-semibold">{record.inspector_name}</span> on{' '}
            {format(parseISO(record.completed_at), 'd MMM yyyy \'at\' HH:mm')}
          </p>
        </div>

        <Separator />

        {/* ── Audit Trail ── */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Audit Trail</h2>
          <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
            <AuditRow label="Record created" value={format(parseISO(record.created_at), 'd MMM yyyy, HH:mm:ss')} />
            <AuditRow
              label="Amended"
              value={record.amended_from_id ? `Yes — "${record.amendment_reason}"` : 'No'}
            />
            <AuditRow
              label="Superseded"
              value={record.superseded_by_id ? 'Yes' : 'No'}
            />
            <AuditRow
              label="PDF generated"
              value={record.pdf_file_path ? 'Yes' : pdfError ? 'Failed' : 'Not yet'}
              icon={record.pdf_file_path ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : pdfError ? <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
            />
            <AuditRow
              label="Locked"
              value={record.is_locked ? 'Immutable' : 'Unlocked'}
              icon={record.is_locked ? <Lock className="h-3.5 w-3.5 text-foreground" /> : null}
            />
          </div>
        </div>

        <Separator />

        {/* ── Actions ── */}
        {!record.pdf_file_path && (
          <div className={cn('rounded-lg border p-3 text-sm', pdfError ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-border bg-muted/30 text-muted-foreground')}>
            {pdfError || (pdfGenerating
              ? 'Preparing PDF. The download will become active when generation finishes.'
              : 'PDF is not ready yet. Leave this record open or retry shortly to download it.')}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            className="min-h-11 w-full whitespace-normal"
            onClick={handleDownloadPdf}
            disabled={!record.pdf_file_path}
          >
            {pdfGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {record.pdf_file_path ? 'Download PDF' : pdfGenerating ? 'Preparing PDF' : 'PDF not ready'}
          </Button>
          {pdfError && !record.pdf_file_path && (
            <Button variant="outline" className="min-h-11 w-full whitespace-normal" onClick={retryPdfGeneration}>
              Retry PDF
            </Button>
          )}
          {isController && (
            canAmend ? (
              <Button
                variant="outline"
                className="min-h-11 w-full whitespace-normal"
                onClick={() => setAmendRecord(record)}
              >
                <Edit3 className="h-4 w-4 mr-2" /> Amend Check Record
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground py-2">
                <Lock className="h-3.5 w-3.5" />
                Amendment window expired (24 hours)
              </div>
            )
          )}
        </div>
      </div>

      {/* Amend Dialog */}
      {amendRecord && (
        <InspectionAmendDialog
          record={amendRecord}
          open={!!amendRecord}
          onOpenChange={(open) => { if (!open) setAmendRecord(null); }}
          onAmended={() => {
            queryClient.invalidateQueries({ queryKey: ['inspection-record', recordId] });
            queryClient.invalidateQueries({ queryKey: ['inspection-records'] });
            setAmendRecord(null);
          }}
        />
      )}
    </div>
  );
};

/* ── Sub-components ── */

function SummaryCard({ label, value, variant }: { label: string; value: number; variant?: string }) {
  const colors: Record<string, string> = {
    success: 'text-success',
    destructive: 'text-destructive',
    muted: 'text-muted-foreground',
  };
  return (
    <Card className="border-border">
      <CardContent className="p-2 text-center sm:p-3">
        <p className={cn('text-xl font-black sm:text-2xl', colors[variant || ''] || 'text-foreground')}>{value}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase leading-tight text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function ItemGroup({
  label,
  icon: Icon,
  items,
  variant,
  defectIds,
  photoPaths,
  rideTypeName,
}: {
  label: string;
  icon: React.ElementType;
  items: ItemResultSnapshot[];
  variant: string;
  defectIds?: string[];
  photoPaths?: string[];
  rideTypeName?: string;
}) {
  const colors: Record<string, string> = {
    success: 'text-success border-success/20 bg-success/5',
    destructive: 'text-destructive border-destructive/20 bg-destructive/5',
    muted: 'text-muted-foreground border-border bg-muted/30',
  };
  const headerColors: Record<string, string> = {
    success: 'text-success',
    destructive: 'text-destructive',
    muted: 'text-muted-foreground',
  };

  return (
    <div className="space-y-2">
      <div className={cn('flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide', headerColors[variant])}>
        <Icon className="h-3.5 w-3.5" />
        {label} ({items.length})
      </div>
      <div className="space-y-1.5">
        {items.map((item, idx) => {
          const rowResult: ChecklistRowResult = item.result === 'fail' ? 'fail' : item.result === 'na' ? 'na' : 'pass';
          return (
          <ChecklistItemRow
            key={idx}
            text={item.check_item_text}
            source={normalizeChecklistSource(item.category)}
            rideTypeName={rideTypeName}
            result={rowResult}
            compact
            className={colors[variant]}
          >
            {item.notes && (
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-semibold">Note:</span> {item.notes}
              </p>
            )}
            {/* For failed items, show defect reference + photo hint */}
            {variant === 'destructive' && defectIds && defectIds.length > 0 && (
              <p className="flex items-center gap-1 text-[11px] text-destructive">
                <AlertTriangle className="h-3 w-3" />
                Linked defect(s): {defectIds.length}
              </p>
            )}
            {variant === 'destructive' && photoPaths && photoPaths.length > 0 && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Camera className="h-3 w-3" />
                {photoPaths.length} photo(s) attached
              </p>
            )}
          </ChecklistItemRow>
          );
        })}
      </div>
    </div>
  );
}

function AuditRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 break-words text-sm font-semibold text-foreground sm:justify-end sm:text-right">
        {icon}
        {value}
      </span>
    </div>
  );
}

export default InspectionRecordPage;
