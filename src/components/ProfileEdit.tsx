import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Building, User, MapPin, Users } from 'lucide-react';
import { z } from 'zod';

const profileSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  controller_name: z.string().min(1, 'Controller name is required'),
  showmen_name: z.string().optional(),
  address: z.string().optional(),
});

interface ProfileEditProps {
  profile: any;
  onComplete: () => void;
}

const ProfileEdit = ({ profile, onComplete }: ProfileEditProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    company_name: profile?.company_name || '',
    controller_name: profile?.controller_name || '',
    showmen_name: profile?.showmen_name || '',
    address: profile?.address || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = profileSchema.parse(formData);
      setIsLoading(true);
      setErrors({});

      const { error } = await supabase
        .from('profiles')
        .update(validatedData)
        .eq('user_id', profile.user_id);

      if (error) {
        toast({
          title: "Error updating profile",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });

      onComplete();
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
        toast({
          title: "Error updating profile",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4 p-4 bg-muted/50 rounded-lg">
        <h4 className="font-medium text-sm mb-2">Role Definitions:</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li><strong>Controller:</strong> The person responsible for ride safety and compliance</li>
          <li><strong>Showmen:</strong> The person who operates the fairground/show (may be same as controller)</li>
          <li><strong>Owner:</strong> The person who owns individual rides (set separately for each ride)</li>
        </ul>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="company_name" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Company Name *
          </Label>
          <Input
            id="company_name"
            value={formData.company_name}
            onChange={(e) => handleInputChange('company_name', e.target.value)}
            placeholder="Enter company name"
            disabled={isLoading}
          />
          {errors.company_name && (
            <p className="text-sm text-destructive">{errors.company_name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="controller_name" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Controller Name *
          </Label>
          <Input
            id="controller_name"
            value={formData.controller_name}
            onChange={(e) => handleInputChange('controller_name', e.target.value)}
            placeholder="Enter controller name"
            disabled={isLoading}
          />
          {errors.controller_name && (
            <p className="text-sm text-destructive">{errors.controller_name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="showmen_name" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Showmen Name
          </Label>
          <Input
            id="showmen_name"
            value={formData.showmen_name}
            onChange={(e) => handleInputChange('showmen_name', e.target.value)}
            placeholder="Enter showmen name (optional)"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Address
          </Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            placeholder="Enter address (optional)"
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="submit"
          disabled={isLoading}
          className="min-w-[120px]"
        >
          {isLoading ? 'Updating...' : 'Update Profile'}
        </Button>
      </div>
    </form>
  );
};

export default ProfileEdit;