import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const NOT_OPERATING_REASONS = [
  'Critical defect (pre-opening/daily check)',
  'Maintenance in progress',
  'Planned closure / not scheduled to operate',
  'Staffing unavailable',
  'Weather / environmental conditions',
  'Awaiting parts / repair',
  'Power / utility issue',
  'Test / commissioning',
  'Other',
] as const;

interface NotOperatingReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  disabled?: boolean;
  /** Pre-select a reason (e.g. from critical defect flow) */
  preselectReason?: string;
}

const NotOperatingReasonDialog = ({
  open,
  onOpenChange,
  onConfirm,
  disabled,
  preselectReason,
}: NotOperatingReasonDialogProps) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedReason(preselectReason || '');
      setNotes('');
    }
  }, [open, preselectReason]);

  const handleConfirm = () => {
    if (!selectedReason) return;
    const fullReason = selectedReason === 'Other' && notes.trim()
      ? `Other: ${notes.trim()}`
      : notes.trim()
        ? `${selectedReason} — ${notes.trim()}`
        : selectedReason;
    onConfirm(fullReason);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark ride as NOT operating today?</DialogTitle>
          <DialogDescription>
            This will pause Daily check due/overdue tracking for today.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Reason *</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select a reason…" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border shadow-lg z-50">
                {NOT_OPERATING_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details…"
              rows={2}
              className="text-sm"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={disabled || !selectedReason}>
            {disabled ? 'Updating…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NotOperatingReasonDialog;
export { NOT_OPERATING_REASONS };
