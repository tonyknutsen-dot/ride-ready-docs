import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Building, User, MapPin } from 'lucide-react';
import { z } from 'zod';
import { CompanyLogoField, type CompanyLogoValue } from '@/components/profile/CompanyLogoField';

const profileSchema = z.object({
  company_name: z.string().max(100).optional(),
  controller_name: z.string().min(1, 'Controller name is required'),
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
    address: profile?.address || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [logo, setLogo] = useState<CompanyLogoValue>({ file: null, previewUrl: null, remove: false });
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);

  // Load existing logo on mount
  useEffect(() => {
    const loadExistingLogo = async () => {
      if (profile?.company_logo_path) {
        try {
          const { data } = await supabase.storage
            .from('ride-documents')
            .createSignedUrl(profile.company_logo_path, 3600);
          if (data?.signedUrl) {
            setExistingLogoUrl(data.signedUrl);
          }
        } catch (e) {
          console.log('Could not load existing logo');
        }
      }
    };
    loadExistingLogo();
  }, [profile?.company_logo_path]);

  const uploadLogo = async (file: File): Promise<string | null> => {
    
    
    const fileExt = file.name.split('.').pop();
    const fileName = `company-logos/${profile.user_id}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('ride-documents')
      .upload(fileName, file, { upsert: true });
    
    if (uploadError) {
      throw new Error('Failed to upload logo');
    }
    
    return fileName;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = profileSchema.parse(formData);
      setIsLoading(true);
      setErrors({});

      // Handle logo upload/removal
      let logoPath: string | null | undefined = undefined;
      
      if (logo.file) {
        logoPath = await uploadLogo(logo.file);
      } else if (logo.remove) {
        logoPath = null;
      }

      const updateData: any = { ...validatedData };
      if (logoPath !== undefined) {
        updateData.company_logo_path = logoPath;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
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
    <form onSubmit={handleSubmit} className="space-y-5">
      
      {/* Form Fields */}
      <div className="space-y-4">
        <CompanyLogoField
          label="Company Logo"
          disabled={isLoading}
          existingPreviewUrl={existingLogoUrl}
          value={logo}
          onChange={setLogo}
          helperText={
            "Used on PDF reports • Minimum 200×200px • Max 5MB • Formats: JPG, PNG, WebP"
          }
        />

        <div className="space-y-2">
          <Label htmlFor="company_name" className="flex items-center gap-2 text-sm">
            <Building className="h-4 w-4 text-muted-foreground" />
            Company Name
          </Label>
          <Input
            id="company_name"
            value={formData.company_name}
            onChange={(e) => handleInputChange('company_name', e.target.value)}
            placeholder="Enter company name (optional)"
            disabled={isLoading}
            className="h-11"
          />
          {errors.company_name && (
            <p className="text-xs text-destructive">{errors.company_name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="controller_name" className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            Controller Name(s) *
          </Label>
          <Input
            id="controller_name"
            value={formData.controller_name}
            onChange={(e) => handleInputChange('controller_name', e.target.value)}
            placeholder="e.g. John Smith & Jane Smith"
            disabled={isLoading}
            className="h-11"
          />
          {errors.controller_name && (
            <p className="text-xs text-destructive">{errors.controller_name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Address
          </Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            placeholder="Enter address (optional)"
            disabled={isLoading}
            className="h-11"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-11"
      >
        {isLoading ? 'Updating...' : 'Update Profile'}
      </Button>
    </form>
  );
};

export default ProfileEdit;
