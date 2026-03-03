import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, addHours } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAppRole } from '@/hooks/useAppRole';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  isWithinAmendmentWindow,
  type InspectionRecord,
  type ItemResultSnapshot,
} from '@/utils/inspectionRecordService';
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

const InspectionRecordPage = () => {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const role = useAppRole();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [amendRecord, setAmendRecord] = useState<InspectionRecord | null>(null);

  const { data: record, isLoading } = useQuery({
    queryKey: ['inspection-record', recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspection_records')
        .select('*')
        .eq('id', recordId!)
        .single();
      if (error) throw error;
      return data as InspectionRecord;
    },
    enabled: !!recordId,
  });

  // Fetch ride name
  const { data: ride } = useQuery({
    queryKey: ['ride-name', record?.ride_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('rides')
        .select('ride_name')
        .eq('id', record!.ride_id)
        .single();
      return data;
    },
    enabled: !!record?.ride_id,
  });

  const handleDownloadPdf = async () => {
    if (!record?.pdf_file_path) {
      toast({ title: 'No PDF available', description: 'PDF has not been generated for this record.', variant: 'destructive' });
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from('ride-documents')
        .download(record.pdf_file_path);
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
        <Button variant="outline" onClick={() => navigate(-1)}>
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate(-1)}>
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
          <div className="flex items-center gap-2 shrink-0">
            {getOverallBadge()}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* ── Record Info ── */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
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
        <div className="grid grid-cols-5 gap-2">
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
            <ItemGroup label="Failed" icon={XCircle} items={failedItems} variant="destructive" defectIds={record.defect_ids} photoPaths={record.photo_paths} />
          )}
          {passedItems.length > 0 && (
            <ItemGroup label="Passed" icon={CheckCircle2} items={passedItems} variant="success" />
          )}
          {naItems.length > 0 && (
            <ItemGroup label="N/A" icon={MinusCircle} items={naItems} variant="muted" />
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
              value={record.pdf_file_path ? 'Yes' : 'Not yet'}
              icon={record.pdf_file_path ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
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
        <div className="flex flex-col sm:flex-row gap-3 pb-8">
          <Button
            className="flex-1"
            onClick={handleDownloadPdf}
            disabled={!record.pdf_file_path}
          >
            <Download className="h-4 w-4 mr-2" /> Download PDF
          </Button>
          {isController && (
            canAmend ? (
              <Button
                variant="outline"
                className="flex-1"
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
      <CardContent className="p-3 text-center">
        <p className={cn('text-2xl font-black', colors[variant || ''] || 'text-foreground')}>{value}</p>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">{label}</p>
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
}: {
  label: string;
  icon: React.ElementType;
  items: ItemResultSnapshot[];
  variant: string;
  defectIds?: string[];
  photoPaths?: string[];
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
        {items.map((item, idx) => (
          <div key={idx} className={cn('rounded-lg border p-3 space-y-1.5', colors[variant])}>
            <p className="text-sm font-semibold text-foreground">{item.check_item_text}</p>
            {item.category && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium">
                {item.category}
              </span>
            )}
            {item.notes && (
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-semibold">Note:</span> {item.notes}
              </p>
            )}
            {/* For failed items, show defect reference + photo hint */}
            {variant === 'destructive' && defectIds && defectIds.length > 0 && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
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
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
        {icon}
        {value}
      </span>
    </div>
  );
}

export default InspectionRecordPage;
