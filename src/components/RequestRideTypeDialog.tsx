import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Send } from 'lucide-react';
import { z } from 'zod';
import { EQUIPMENT_GROUP_LABELS, type EquipmentGroup, EQUIPMENT_GROUPS } from '@/constants/checkLibrary';

/** Maps equipment group keys to the PascalCase category_group used in ride_categories */
const GROUP_KEY_TO_CATEGORY: Record<EquipmentGroup, string> = {
  rides: 'Rides',
  inflatables: 'Inflatables',
  stalls: 'Stalls',
  attractions: 'Attractions',
  food_stalls: 'Food Stalls',
  games: 'Games',
  equipment: 'Equipment',
};

const requestSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  equipmentGroup: z.string().min(1, 'Please select an equipment group'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(500, 'Description must be less than 500 characters'),
  manufacturer: z.string().trim().max(100, 'Manufacturer must be less than 100 characters').optional(),
  additionalInfo: z.string().trim().max(1000, 'Additional info must be less than 1000 characters').optional()
});

interface RequestRideTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RequestRideTypeDialog = ({ open, onOpenChange }: RequestRideTypeDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    equipmentGroup: '',
    description: '',
    manufacturer: '',
    additionalInfo: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setFormData({ name: '', equipmentGroup: '', description: '', manufacturer: '', additionalInfo: '' });
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      const validatedData = requestSchema.parse(formData);

      if (!user) throw new Error('You must be logged in to submit a request');

      const categoryGroup = GROUP_KEY_TO_CATEGORY[validatedData.equipmentGroup as EquipmentGroup] || validatedData.equipmentGroup;

      const { error } = await supabase
        .from('ride_type_requests')
        .insert({
          user_id: user.id,
          name: validatedData.name,
          type: categoryGroup,
          description: validatedData.description,
          manufacturer: validatedData.manufacturer || null,
          additional_info: validatedData.additionalInfo || null,
        });

      if (error) throw error;

      toast({
        title: "Request Submitted",
        description: `Your request for "${validatedData.name}" has been sent for review.`,
      });

      resetForm();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
      } else {
        console.error('Error submitting request:', error);
        toast({ title: "Error", description: "Failed to submit your request. Please try again.", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => { resetForm(); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Request New Equipment Type</span>
          </DialogTitle>
          <DialogDescription>
            Can't find the right equipment type? Request it here and we'll review it for addition.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Equipment Type Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Chair-o-Plane, Crepe Stand"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label>Equipment Group *</Label>
            <Select value={formData.equipmentGroup} onValueChange={(v) => setFormData({ ...formData, equipmentGroup: v })}>
              <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
              <SelectContent>
                {EQUIPMENT_GROUPS.map(g => (
                  <SelectItem key={g} value={g}>{EQUIPMENT_GROUP_LABELS[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.equipmentGroup && <p className="text-sm text-destructive">{errors.equipmentGroup}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe what this equipment does and how it operates…"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
            {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="manufacturer">Manufacturer (Optional)</Label>
            <Input
              id="manufacturer"
              placeholder="e.g., Wisdom Rides, KMG"
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalInfo">Additional Information (Optional)</Label>
            <Textarea
              id="additionalInfo"
              placeholder="Any other details that might be helpful…"
              value={formData.additionalInfo}
              onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
              rows={2}
            />
          </div>

          <DialogFooter className="flex space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" /> : <Send className="h-4 w-4" />}
              <span>{isLoading ? 'Sending…' : 'Submit Request'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
