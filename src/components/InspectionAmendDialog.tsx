import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createAmendment, updateInspectionRecordPdf, type InspectionRecord, type ItemResultSnapshot } from '@/utils/inspectionRecordService';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { generateDocumentId } from '@/utils/pdfTemplate';
import { storeRideDocument, getRideCode } from '@/utils/rideDocumentService';

interface InspectionAmendDialogProps {
  record: InspectionRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAmended: () => void;
}

export const InspectionAmendDialog = ({ record, open, onOpenChange, onAmended }: InspectionAmendDialogProps) => {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState(record.notes || '');
  const [inspectorName, setInspectorName] = useState(record.inspector_name);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({ title: 'Reason required', description: 'You must provide a reason for the amendment.', variant: 'destructive' });
      return;
    }

    if (!user?.id) return;

    setSubmitting(true);
    try {
      const newRecordId = await createAmendment(
        record.id,
        user.id,
        reason.trim(),
        {
          inspectorName: inspectorName.trim(),
          notes: notes.trim() || null,
        }
      );

      if (!newRecordId) {
        throw new Error('Failed to create amendment');
      }

      toast({
        title: 'Amendment created',
        description: `Inspection record amended (v${record.version + 1}). Original record preserved.`,
      });

      onAmended();
    } catch (error) {
      console.error('Error creating amendment:', error);
      toast({ title: 'Error', description: 'Failed to create amendment', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Amend Inspection Record
          </DialogTitle>
          <DialogDescription>
            This will create a new version (v{record.version + 1}). The original record (v{record.version}) will be preserved and never deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current record info */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current version:</span>
              <span className="font-semibold">v{record.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Inspector:</span>
              <span>{record.inspector_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date:</span>
              <span>{record.check_date}</span>
            </div>
          </div>

          {/* Amendment reason (required) */}
          <div className="space-y-1.5">
            <Label htmlFor="amendment-reason" className="text-sm font-semibold">
              Amendment Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="amendment-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this record being amended?"
              className="min-h-[80px]"
            />
          </div>

          {/* Editable fields */}
          <div className="space-y-1.5">
            <Label htmlFor="amend-inspector" className="text-sm font-semibold">Inspector Name</Label>
            <Input
              id="amend-inspector"
              value={inspectorName}
              onChange={(e) => setInspectorName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amend-notes" className="text-sm font-semibold">Notes</Label>
            <Textarea
              id="amend-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !reason.trim()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Amendment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
