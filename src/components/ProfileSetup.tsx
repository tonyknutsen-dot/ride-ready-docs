import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Building, User, MapPin, Save, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { COUNTRIES } from '@/constants/profile';
import DeviceHintBanner from './DeviceHintBanner';
import { CompanyLogoField, type CompanyLogoValue } from '@/components/profile/CompanyLogoField';

interface ProfileSetupProps {
  onComplete: () => void;
}

const profileSchema = z.object({
  company_name: z.string().trim().max(100).optional(),
  controller_name: z.string().trim().min(1, "Controller name is required").max(100),
  address: z.string().trim().max(500).optional(),
  country: z.string().min(1, "Please select your country"),
});

const ProfileSetup = ({ onComplete }: ProfileSetupProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    controller_name: '',
    address: '',
    country: user?.user_metadata?.country || 'GB',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<CompanyLogoValue>({ file: null, previewUrl: null, remove: false });

  const uploadLogo = async (): Promise<string | null> => {
    if (!logo.file || !user) return null;
    
    const fileExt = logo.file.name.split('.').pop();
    const fileName = `company-logos/${user.id}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('ride-documents')
      .upload(fileName, logo.file);
    
    if (uploadError) {
      console.error('Logo upload error:', uploadError);
      return null;
    }
    
    return fileName;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      const validationData = {
        ...formData,
        company_name: formData.company_name || undefined,
        address: formData.address || undefined,
      };
      
      const validatedData = profileSchema.parse(validationData);
      setLoading(true);

      // Upload logo if provided
      const logoPath = await uploadLogo();

      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: user!.id,
          company_name: validatedData.company_name || null,
          controller_name: validatedData.controller_name,
          address: validatedData.address || null,
          country: validatedData.country,
          company_logo_path: logoPath,
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-2 border-primary/20 shadow-elegant bg-gradient-to-b from-card to-primary/[0.02]">
        <CardHeader className="text-center space-y-4">
          <div>
            <CardTitle className="text-2xl font-bold">Complete Your Profile</CardTitle>
            <CardDescription className="text-lg">
              Let's set up your company information to get started with Ride Ready Docs
            </CardDescription>
          </div>
          <DeviceHintBanner />
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Country Selection - First for terminology customization */}
            <div className="space-y-2">
              <Label htmlFor="country" className="flex items-center space-x-2">
                <Globe className="h-4 w-4" />
                <span>Country *</span>
              </Label>
              <Select
                value={formData.country}
                onValueChange={(value) => setFormData({ ...formData, country: value })}
              >
                <SelectTrigger className={errors.country ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <div className="flex items-center gap-2">
                        <span>{c.flag}</span>
                        <span>{c.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.country && (
                <p className="text-xs text-muted-foreground">
                  {COUNTRIES.find(c => c.code === formData.country)?.note}
                </p>
              )}
              {errors.country && (
                <p className="text-sm text-destructive">{errors.country}</p>
              )}
            </div>

            <CompanyLogoField
              label="Company Logo (Optional)"
              disabled={loading}
              value={logo}
              onChange={setLogo}
              helperText={
                "Used on PDF reports • Minimum 200×200px • Max 5MB • Formats: JPG, PNG, WebP"
              }
            />

            <div className="space-y-2">
              <Label htmlFor="company_name" className="flex items-center space-x-2">
                <Building className="h-4 w-4" />
                <span>Company Name</span>
              </Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Enter your company name (optional)"
                className={errors.company_name ? "border-destructive" : ""}
              />
              {errors.company_name && (
                <p className="text-sm text-destructive">{errors.company_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="controller_name" className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>Controller Name(s) *</span>
              </Label>
              <Input
                id="controller_name"
                value={formData.controller_name}
                onChange={(e) => setFormData({ ...formData, controller_name: e.target.value })}
                placeholder="e.g. John Smith & Jane Smith"
                className={errors.controller_name ? "border-destructive" : ""}
              />
              {errors.controller_name && (
                <p className="text-sm text-destructive">{errors.controller_name}</p>
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
              className="w-full flex items-center justify-center space-x-2 shadow-elegant"
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