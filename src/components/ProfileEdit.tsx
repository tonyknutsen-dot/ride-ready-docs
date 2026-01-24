import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Building, User, MapPin, Users, Upload, X, Image } from 'lucide-react';
import { z } from 'zod';
import { OPERATOR_TYPES } from '@/constants/profile';
import { compressImage } from '@/utils/imageCompression';

const profileSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  controller_name: z.string().min(1, 'Controller name is required'),
  showmen_name: z.string().optional(),
  address: z.string().optional(),
  operator_type: z.string().optional(),
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
    operator_type: profile?.operator_type || 'company',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  
  const isShowman = formData.operator_type === 'showman';

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

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be selected again
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Format",
        description: "Please upload an image file (JPG, PNG, or WebP). Other file types are not supported.",
        variant: "destructive",
      });
      return;
    }

    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: `Your file is ${fileSizeMB}MB. Please upload an image smaller than 5MB.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const compressed = await compressImage(file, 800, 0.85);
      setLogoFile(compressed);
      setLogoPreview(URL.createObjectURL(compressed));
      setRemoveLogo(false);
      toast({
        title: "Logo Ready",
        description: "Your logo has been added. Click 'Update Profile' to save.",
      });
    } catch (error) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setRemoveLogo(false);
      toast({
        title: "Logo Ready",
        description: "Your logo has been added. Click 'Update Profile' to save.",
      });
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return null;
    
    const fileExt = logoFile.name.split('.').pop();
    const fileName = `company-logos/${profile.user_id}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('ride-documents')
      .upload(fileName, logoFile, { upsert: true });
    
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
      
      if (logoFile) {
        logoPath = await uploadLogo();
      } else if (removeLogo) {
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
      {/* Operator Type Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          Operator Type
        </Label>
        <Select
          value={formData.operator_type}
          onValueChange={(value) => handleInputChange('operator_type', value)}
          disabled={isLoading}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Select operator type" />
          </SelectTrigger>
          <SelectContent>
            {OPERATOR_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {formData.operator_type && (
          <p className="text-xs text-muted-foreground">
            {OPERATOR_TYPES.find(t => t.value === formData.operator_type)?.description}
          </p>
        )}
      </div>
      
      {/* Role Definitions */}
      <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1.5">
        <p className="font-medium text-sm">Role Definitions:</p>
        <p><strong>Controller:</strong> Responsible for ride safety and compliance</p>
        <p><strong>{isShowman ? 'Showmen' : 'Operator'}:</strong> Operates the fairground/show (may be same as controller)</p>
        <p><strong>Owner:</strong> Owns individual rides (set separately for each ride)</p>
      </div>
      
      {/* Form Fields */}
      <div className="space-y-4">
        {/* Company Logo Upload */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm">
            <Image className="h-4 w-4 text-muted-foreground" />
            Company Logo
          </Label>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Your logo will appear on PDF reports and documents</p>
            <p className="text-muted-foreground/70">
              <strong>Recommended:</strong> Square image, min 200×200px • <strong>Max size:</strong> 5MB • <strong>Formats:</strong> JPG, PNG, WebP
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Preview */}
            {(logoPreview || (existingLogoUrl && !removeLogo)) && (
              <div className="relative group">
                <img
                  src={logoPreview || existingLogoUrl || ''}
                  alt="Company logo"
                  className="w-20 h-20 object-contain border rounded-lg bg-muted/30"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleRemoveLogo}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            {/* Upload button */}
            {!logoPreview && (!existingLogoUrl || removeLogo) && (
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                  disabled={isLoading}
                />
                <div className="w-20 h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">Upload</span>
                </div>
              </label>
            )}
            
            {/* Change button when logo exists */}
            {(logoPreview || (existingLogoUrl && !removeLogo)) && (
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                  disabled={isLoading}
                />
                <Button type="button" variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Change
                  </span>
                </Button>
              </label>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="company_name" className="flex items-center gap-2 text-sm">
            <Building className="h-4 w-4 text-muted-foreground" />
            Company Name *
          </Label>
          <Input
            id="company_name"
            value={formData.company_name}
            onChange={(e) => handleInputChange('company_name', e.target.value)}
            placeholder="Enter company name"
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
            Controller Name *
          </Label>
          <Input
            id="controller_name"
            value={formData.controller_name}
            onChange={(e) => handleInputChange('controller_name', e.target.value)}
            placeholder="Enter controller name"
            disabled={isLoading}
            className="h-11"
          />
          {errors.controller_name && (
            <p className="text-xs text-destructive">{errors.controller_name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="showmen_name" className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            {isShowman ? 'Showmen Name' : 'Operator Name'}
          </Label>
          <Input
            id="showmen_name"
            value={formData.showmen_name}
            onChange={(e) => handleInputChange('showmen_name', e.target.value)}
            placeholder={`Enter ${isShowman ? 'showmen' : 'operator'} name (optional)`}
            disabled={isLoading}
            className="h-11"
          />
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
