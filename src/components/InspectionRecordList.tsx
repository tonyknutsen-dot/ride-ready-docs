import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Eye,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  Edit3,
  History,
  Clock,
  Lock,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useAppRole } from '@/hooks/useAppRole';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '@/components/EmptyState';
import { InspectionAmendDialog } from './InspectionAmendDialog';
import {
  fetchInspectionRecords,
  isWithinAmendmentWindow,
  type InspectionRecord,
} from '@/utils/inspectionRecordService';

interface InspectionRecordListProps {
  rideId: string;
  rideName: string;
  frequency?: string;
}

const InspectionRecordList = ({ rideId, rideName, frequency = 'daily' }: InspectionRecordListProps) => {
  const { effectiveUserId } = useEffectiveUserId();
  const role = useAppRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [amendRecord, setAmendRecord] = useState<InspectionRecord | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['inspection-records', rideId, frequency],
    queryFn: () => fetchInspectionRecords(rideId, { frequency }),
    enabled: !!effectiveUserId,
  });

  const handleDownloadPdf = async (record: InspectionRecord) => {
    if (!record.pdf_file_path) {
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
      a.download = `Inspection-Record-v${record.version}-${format(parseISO(record.check_date), 'yyyy-MM-dd')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({ title: 'Download failed', description: 'Could not download the PDF.', variant: 'destructive' });
    }
  };

  const handleViewRecord = (record: InspectionRecord) => {
    navigate(`/inspection-record/${record.id}`);
  };

  const getResultBadge = (result: string, record?: InspectionRecord) => {
    // Check if this record has critical/stop-operation defects
    const hasCriticalDefects = record && (record.defect_ids?.length || 0) > 0 && result === 'failed';
    
    if (hasCriticalDefects) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold border bg-destructive/10 border-destructive/30 text-destructive">
          <AlertTriangle className="h-3 w-3" />
          Failed — Defect recorded
        </span>
      );
    }

    switch (result) {
      case 'passed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold border bg-success/10 border-success/30 text-success">
            <CheckCircle2 className="h-3 w-3" />
            Passed
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold border bg-success/10 border-success/30 text-success">
            <CheckCircle2 className="h-3 w-3" />
            Passed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold border bg-destructive/10 border-destructive/30 text-destructive">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold border bg-warning/10 border-warning/30 text-warning">
            <MinusCircle className="h-3 w-3" />
            Partial
          </span>
        );
    }
  };

  const isController = role === 'controller';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
              <EmptyState
        icon={FileText}
        title="No check records"
        description="Records will appear here once safety checks are completed."
        variant="compact"
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
            Check Records ({records.length})
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {records.map((record) => {
          const defectCount = record.defect_ids?.length || 0;
          const canAmend = isController && isWithinAmendmentWindow(record) && !record.superseded_by_id;

          return (
            <div
              key={record.id}
              className="rounded-xl border border-border bg-card p-3 flex items-start justify-between gap-3 min-w-0"
            >
              <div className="min-w-0 flex-1 space-y-1">
                {/* Checked by + date */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-sm text-foreground truncate">{record.inspector_name}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {format(parseISO(record.completed_at), 'd MMM yyyy, HH:mm')}
                  </span>
                </div>

                {/* Meta line */}
                <div className="flex items-center gap-2 flex-wrap">
                  {getResultBadge(record.overall_result, record)}
                  <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    v{record.version}
                  </span>
                  {defectCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      {defectCount} defect{defectCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {record.amended_from_id && (
                    <span className="text-[10px] text-muted-foreground italic">Amended</span>
                  )}
                  {record.superseded_by_id && (
                    <span className="text-[10px] text-muted-foreground italic line-through">Superseded</span>
                  )}
                </div>

                {/* Amendment window status for controllers */}
                {isController && !record.superseded_by_id && (
                  <div className="mt-0.5">
                    {isWithinAmendmentWindow(record) ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        Amendment window open
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
                        <Lock className="h-2.5 w-2.5" />
                        Amendment window expired (24 hours)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleViewRecord(record)}
                  title="View details"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDownloadPdf(record)}
                  disabled={!record.pdf_file_path}
                  title="Download PDF"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {canAmend && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => setAmendRecord(record)}
                    title="Amend record"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {amendRecord && (
        <InspectionAmendDialog
          record={amendRecord}
          open={!!amendRecord}
          onOpenChange={(open) => { if (!open) setAmendRecord(null); }}
          onAmended={() => {
            queryClient.invalidateQueries({ queryKey: ['inspection-records'] });
            setAmendRecord(null);
          }}
        />
      )}
    </div>
  );
};

export default InspectionRecordList;
