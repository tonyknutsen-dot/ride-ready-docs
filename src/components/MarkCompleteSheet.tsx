import { useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CheckCircle2, Calendar as CalendarIcon, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

interface MarkCompleteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  onCompleted?: () => void;
}

const MarkCompleteSheet = ({
  open,
  onOpenChange,
  eventId,
  eventName,
  isRecurring,
  recurrenceRule,
  onCompleted,
}: MarkCompleteSheetProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [completionDate, setCompletionDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('complete_event', {
        p_event_id: eventId,
        p_completion_date: format(completionDate, 'yyyy-MM-dd'),
        p_completion_notes: notes || null,
        p_evidence_urls: [],
      });
      if (error) throw error;

      const result = data as any;
      const nextCreated = result?.created_next;

      toast({
        title: "Marked Complete",
        description: nextCreated
          ? `Next scheduled for ${format(new Date(result.next_due_date), 'd MMM yyyy')}.`
          : "Event marked as completed.",
      });

      queryClient.invalidateQueries({ queryKey: ['compliance'] });
      onOpenChange(false);
      setNotes('');
      setCompletionDate(new Date());
      onCompleted?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not complete event.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const recurrenceLabel = recurrenceRule
    ? `Every ${recurrenceRule.replace(':', ' ')}`
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] flex flex-col p-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <SheetTitle className="text-base font-semibold text-foreground">Mark Complete</SheetTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1 truncate">{eventName}</p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Completion date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completion Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(completionDate, 'd MMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                <Calendar
                  mode="single"
                  selected={completionDate}
                  onSelect={(date) => { if (date) { setCompletionDate(date); setCalendarOpen(false); } }}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Completion details, inspector name, reference number…"
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Recurrence info */}
          {isRecurring && recurrenceLabel && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-2">
              <Repeat className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-xs text-primary font-medium">
                Next occurrence will be auto-created ({recurrenceLabel})
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border bg-background px-5 py-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button className="flex-1 gap-1.5" onClick={handleConfirm} disabled={submitting}>
            <CheckCircle2 className="h-4 w-4" />
            {submitting ? 'Completing…' : 'Confirm'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MarkCompleteSheet;
