import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wrench, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useQueryClient } from '@tanstack/react-query';

const QUICK_MAINTENANCE_TYPES = [
  { value: 'corrective', label: 'Corrective / Repair' },
  { value: 'preventive', label: 'Adjustment' },
  { value: 'safety', label: 'Safety Fix' },
  { value: 'mechanical', label: 'Mechanical Work' },
  { value: 'electrical', label: 'Electrical Work' },
  { value: 'other', label: 'Other' },
];

interface QuickMaintenanceLogProps {
  rideId: string;
  rideName: string;
  checkItemText: string;
  onLogged?: () => void;
  onCancel?: () => void;
}

const QuickMaintenanceLog = ({ rideId, rideName, checkItemText, onLogged, onCancel }: QuickMaintenanceLogProps) => {
  const [description, setDescription] = useState(`Repair/adjustment during check: ${checkItemText}`);
  const [maintenanceType, setMaintenanceType] = useState('corrective');
  const [performedBy, setPerformedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  const { effectiveUserId } = useEffectiveUserId();
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('maintenance_records')
        .insert({
          user_id: effectiveUserId,
          ride_id: rideId,
          maintenance_date: new Date().toISOString().split('T')[0],
          maintenance_type: maintenanceType,
          description: description.trim(),
          performed_by: performedBy.trim() || null,
          notes: notes.trim() ? `Logged during safety check. ${notes.trim()}` : 'Logged during safety check.',
        });

      if (error) throw error;

      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });

      toast({
        title: "Maintenance logged ✓",
        description: `Repair recorded for ${rideName} and will appear in the Maintenance section.`,
      });

      onLogged?.();
    } catch (error: any) {
      console.error('Error logging maintenance:', error);
      toast({
        title: "Error",
        description: "Failed to log maintenance record",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/30 text-sm">
        <CheckCircle className="h-4 w-4 text-success shrink-0" />
        <span className="text-success font-medium">Maintenance logged — visible in Maintenance section</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Wrench className="h-4 w-4 text-primary" />
        Quick Maintenance Log
      </div>

      <div className="space-y-2">
        <Label htmlFor="maint-desc" className="text-xs">What was done? *</Label>
        <Textarea
          id="maint-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the repair or adjustment..."
          className="min-h-[60px] text-sm resize-none"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={maintenanceType} onValueChange={setMaintenanceType}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUICK_MAINTENANCE_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Done by</Label>
          <Input
            value={performedBy}
            onChange={(e) => setPerformedBy(e.target.value)}
            placeholder="Name"
            className="h-9 text-xs"
          />
        </div>
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-xs">
            Cancel
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || !description.trim()}
          className="gap-1.5 text-xs flex-1"
        >
          {submitting ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>
          ) : (
            <><Wrench className="h-3 w-3" /> Log Maintenance</>
          )}
        </Button>
      </div>
    </div>
  );
};

export default QuickMaintenanceLog;
