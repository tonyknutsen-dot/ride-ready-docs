import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Building, User, MapPin, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

interface ProfileSetupProps {
  onComplete: () => void;
}

const profileSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required").max(100),
  controller_name: z.string().trim().min(1, "Controller name is required").max(100),
  showmen_name: z.string().trim().max(100).optional(),
  address: z.string().trim().max(500).optional(),
});

const ProfileSetup = ({ onComplete }: ProfileSetupProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    controller_name: '',
    showmen_name: '',
    address: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      // Validate form data
      const validationData = {
        ...formData,
        showmen_name: formData.showmen_name || undefined,
        address: formData.address || undefined,
      };
      
      const validatedData = profileSchema.parse(validationData);
      setLoading(true);

      // Insert or update profile
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user!.id,
          company_name: validatedData.company_name,
          controller_name: validatedData.controller_name,
          showmen_name: validatedData.showmen_name || null,
          address: validatedData.address || null,
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        toast({
          title: "Error saving profile",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Profile completed!",
          description: "Your profile has been set up successfully.",
        });
        onComplete();
      }
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
        console.error('Error saving profile:', error);
        toast({
          title: "Error saving profile",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Complete Your Profile</CardTitle>
          <CardDescription className="text-lg">
            Let's set up your company information to get started with Ride Ready Docs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="company_name" className="flex items-center space-x-2">
                <Building className="h-4 w-4" />
                <span>Company Name *</span>
              </Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Enter your company name"
                className={errors.company_name ? "border-destructive" : ""}
              />
              {errors.company_name && (
                <p className="text-sm text-destructive">{errors.company_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="controller_name" className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Controller Name *</span>
              </Label>
              <Input
                id="controller_name"
                value={formData.controller_name}
                onChange={(e) => setFormData({ ...formData, controller_name: e.target.value })}
                placeholder="Enter the controller's name"
                className={errors.controller_name ? "border-destructive" : ""}
              />
              {errors.controller_name && (
                <p className="text-sm text-destructive">{errors.controller_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="showmen_name">Showmen Name</Label>
              <Input
                id="showmen_name"
                value={formData.showmen_name}
                onChange={(e) => setFormData({ ...formData, showmen_name: e.target.value })}
                placeholder="Enter showmen name (optional)"
                className={errors.showmen_name ? "border-destructive" : ""}
              />
              {errors.showmen_name && (
                <p className="text-sm text-destructive">{errors.showmen_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span>Address</span>
              </Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter your business address (optional)"
                rows={3}
                className={errors.address ? "border-destructive" : ""}
              />
              {errors.address && (
                <p className="text-sm text-destructive">{errors.address}</p>
              )}
            </div>

            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full flex items-center justify-center space-x-2"
              size="lg"
            >
              <Save className="h-4 w-4" />
              <span>{loading ? 'Saving...' : 'Complete Setup'}</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileSetup;