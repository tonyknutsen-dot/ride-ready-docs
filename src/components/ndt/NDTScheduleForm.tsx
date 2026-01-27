import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tables } from '@/integrations/supabase/types';

type NDTSchedule = Tables<'ndt_schedules'>;

interface NDTScheduleFormData {
  schedule_name: string;
  component_description: string;
  ndt_method: string;
  frequency_months: number;
  last_inspection_date: string;
  notes: string;
}

interface NDTScheduleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSchedule: NDTSchedule | null;
  onSave: (formData: NDTScheduleFormData) => Promise<void>;
}

const NDTScheduleForm = ({ open, onOpenChange, editingSchedule, onSave }: NDTScheduleFormProps) => {
  const [formData, setFormData] = useState<NDTScheduleFormData>({
    schedule_name: '',
    component_description: '',
    ndt_method: '',
    frequency_months: 12,
    last_inspection_date: '',
    notes: ''
  });

  useEffect(() => {
    if (editingSchedule) {
      setFormData({
        schedule_name: editingSchedule.schedule_name,
        component_description: editingSchedule.component_description,
        ndt_method: editingSchedule.ndt_method,
        frequency_months: editingSchedule.frequency_months,
        last_inspection_date: editingSchedule.last_inspection_date || '',
        notes: editingSchedule.notes || ''
      });
    } else {
      setFormData({
        schedule_name: '',
        component_description: '',
        ndt_method: '',
        frequency_months: 12,
        last_inspection_date: '',
        notes: ''
      });
    }
  }, [editingSchedule, open]);

  const handleSave = async () => {
    await onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingSchedule ? 'Edit' : 'Create'} NDT Tracking Schedule
          </DialogTitle>
          <DialogDescription>
            Set up tracking for NDT inspections. Actual inspections will be performed by independent NDT inspectors.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="schedule_name">Schedule Name</Label>
            <Input
              id="schedule_name"
              value={formData.schedule_name}
              onChange={(e) => setFormData(prev => ({...prev, schedule_name: e.target.value}))}
              placeholder="e.g., Main Support Structure NDT"
            />
          </div>
          <div>
            <Label htmlFor="component_description">Component Description</Label>
            <Input
              id="component_description"
              value={formData.component_description}
              onChange={(e) => setFormData(prev => ({...prev, component_description: e.target.value}))}
              placeholder="e.g., Main support welds and joints"
            />
          </div>
          <div>
            <Label htmlFor="ndt_method">NDT Method</Label>
            <Select 
              value={formData.ndt_method} 
              onValueChange={(value) => setFormData(prev => ({...prev, ndt_method: value}))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select NDT method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ultrasonic">Ultrasonic Testing</SelectItem>
                <SelectItem value="magnetic_particle">Magnetic Particle Testing</SelectItem>
                <SelectItem value="dye_penetrant">Dye Penetrant Testing</SelectItem>
                <SelectItem value="radiographic">Radiographic Testing</SelectItem>
                <SelectItem value="visual">Visual Testing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="frequency_months">Frequency (Months)</Label>
            <Input
              id="frequency_months"
              type="number"
              min="1"
              max="60"
              value={formData.frequency_months}
              onChange={(e) => setFormData(prev => ({...prev, frequency_months: parseInt(e.target.value)}))}
            />
          </div>
          <div>
            <Label htmlFor="last_inspection_date">Last Inspection Date (Optional)</Label>
            <Input
              id="last_inspection_date"
              type="date"
              value={formData.last_inspection_date}
              onChange={(e) => setFormData(prev => ({...prev, last_inspection_date: e.target.value}))}
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))}
              placeholder="Additional notes or requirements..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {editingSchedule ? 'Update' : 'Create'} Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NDTScheduleForm;
