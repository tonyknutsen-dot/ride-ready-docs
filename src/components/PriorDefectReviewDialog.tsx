import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, History, Loader2, RotateCcw, FilePlus2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface PriorDefectReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defectId: string;
  /** User chose to reopen the prior defect — open the edit dialog. */
  onReopen: () => void;
  /** User chose to start a fresh defect for this run — open the create dialog. */
  onRaiseNew: () => void;
}

interface PriorDefect {
  id: string;
  description: string;
  severity: string;
  status: string;
  reported_at: string;
  location_on_ride: string | null;
  photo_paths: string[] | null;
}

const SEVERITY_LABEL: Record<string, string> = {
  stop_operation: 'Stop Operation',
  urgent: 'Urgent',
  non_urgent: 'Non-Urgent',
};

const PriorDefectReviewDialog = ({
  open,
  onOpenChange,
  defectId,
  onReopen,
  onRaiseNew,
}: PriorDefectReviewDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [defect, setDefect] = useState<PriorDefect | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !defectId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('defects')
        .select('id, description, severity, status, reported_at, location_on_ride, photo_paths')
        .eq('id', defectId)
        .maybeSingle();
      if (cancelled) return;
      setDefect(data as PriorDefect | null);

      if (data?.photo_paths?.length) {
        const urls = await Promise.all(
          (data.photo_paths as string[]).slice(0, 5).map(async (p) => {
            const { data: signed } = await supabase.storage
              .from('defect-photos')
              .createSignedUrl(p, 60 * 10);
            return signed?.signedUrl ?? '';
          })
        );
        if (!cancelled) setPhotoUrls(urls.filter(Boolean));
      } else {
        setPhotoUrls([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, defectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
              <History className="h-4 w-4 text-amber-700" />
            </div>
            <div>
              <DialogTitle className="text-base">Previous open defect</DialogTitle>
              <DialogDescription className="text-xs">
                Not yet linked to this check run.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !defect ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Could not load the previous defect.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Historical badge bar */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-300 bg-amber-50">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-700 shrink-0" />
              <p className="text-[11px] font-semibold text-amber-900">
                Historical record — from a previous check on this item
              </p>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {SEVERITY_LABEL[defect.severity] ?? defect.severity}
              </Badge>
              <Badge variant="outline" className="text-[10px] capitalize">
                {defect.status.replace('_', ' ')}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                Reported {format(new Date(defect.reported_at), 'd MMM yyyy')}
              </span>
            </div>

            {/* Description */}
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Original description
              </p>
              <p className="text-sm whitespace-pre-wrap">{defect.description || '—'}</p>
              {defect.location_on_ride && (
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="font-medium">Location:</span> {defect.location_on_ride}
                </p>
              )}
            </div>

            {/* Photos */}
            {photoUrls.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Original photos ({photoUrls.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {photoUrls.map((url, i) => (
                    <div key={i} className="aspect-square rounded-md overflow-hidden border border-border">
                      <img src={url} alt="Previous defect" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground italic px-1">
              Choose how to handle this fail. Nothing is linked to the current run until you decide.
            </p>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 border-amber-400 text-amber-900 hover:bg-amber-50"
            onClick={onReopen}
            disabled={loading || !defect}
          >
            <RotateCcw className="h-4 w-4" />
            Reopen previous defect
          </Button>
          <Button
            type="button"
            className="w-full gap-2"
            onClick={onRaiseNew}
            disabled={loading}
          >
            <FilePlus2 className="h-4 w-4" />
            Raise new defect for this run
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PriorDefectReviewDialog;
