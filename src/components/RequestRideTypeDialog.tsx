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

const requestSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  type: z.enum(['ride', 'stall', 'service'], { required_error: 'Please select a type' }),
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
    type: '' as 'ride' | 'stall' | 'service' | '',
    description: '',
    manufacturer: '',
    additionalInfo: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setFormData({
      name: '',
      type: '',
      description: '',
      manufacturer: '',
      additionalInfo: ''
    });
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      // Validate form data
      const validatedData = requestSchema.parse(formData);

      if (!user) {
        throw new Error('You must be logged in to submit a request');
      }

      // Submit request via edge function
      const { data, error } = await supabase.functions.invoke('send-ride-type-request', {
        body: {
          ...validatedData,
          userEmail: user.email,
          userName: user.user_metadata?.full_name || user.email
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Request Submitted Successfully!",
        description: `Your request for "${validatedData.name}" has been sent. We'll review it and add it to our database if appropriate.`,
      });

      resetForm();
      onOpenChange(false);

    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        console.error('Error submitting request:', error);
        toast({
          title: "Error",
          description: "Failed to submit your request. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Request New Ride or Stall Type</span>
          </DialogTitle>
          <DialogDescription>
            Can't find your ride or stall type? Request it here and we'll add it to our database.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Chair-o-Plane, Fish & Chips Stall"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as any })}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ride">Fairground Ride</SelectItem>
                <SelectItem value="stall">Food/Retail Stall</SelectItem>
                <SelectItem value="service">Service/Facility</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && <p className="text-sm text-red-500">{errors.type}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe what this ride or stall does, how it operates, etc."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
            {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="manufacturer">Manufacturer (Optional)</Label>
            <Input
              id="manufacturer"
              placeholder="e.g., Wisdom Rides, KMG, etc."
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            />
            {errors.manufacturer && <p className="text-sm text-red-500">{errors.manufacturer}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalInfo">Additional Information (Optional)</Label>
            <Textarea
              id="additionalInfo"
              placeholder="Any other details that might be helpful..."
              value={formData.additionalInfo}
              onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
              rows={2}
            />
            {errors.additionalInfo && <p className="text-sm text-red-500">{errors.additionalInfo}</p>}
          </div>

          <DialogFooter className="flex space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex items-center space-x-2">
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>{isLoading ? 'Sending...' : 'Submit Request'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};