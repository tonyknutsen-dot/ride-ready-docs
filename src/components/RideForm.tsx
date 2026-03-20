import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Plus, ImagePlus, AlertTriangle, Camera, FolderOpen, Trash2, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { z } from 'zod';
import { RequestRideTypeDialog } from '@/components/RequestRideTypeDialog';
import { useSubscription, getRideTier, getTierLabel, RIDE_TIERS } from '@/hooks/useSubscription';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
import { compressImage } from '@/utils/imageCompression';

type RideCategory = Tables<'ride_categories'>;

interface RideFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  ride?: Tables<'rides'> & {
    ride_categories?: {
      name: string;
      description: string | null;
    };
  };
}

const rideSchema = z.object({
  ride_name: z.string().trim().min(1, "Ride name is required").max(100, "Ride name must be less than 100 characters"),
  category_id: z.string().min(1, "Please select a ride category"),
  manufacturer: z.string().trim().max(100, "Manufacturer must be less than 100 characters").optional(),
  year_manufactured: z.number().int().min(1800).max(new Date().getFullYear() + 1).optional(),
  serial_number: z.string().trim().max(50, "Serial number must be less than 50 characters").optional(),
  owner_name: z.string().trim().max(100, "Owner name must be less than 100 characters").optional(),
});

const RideForm = ({ onSuccess, onCancel, ride }: RideFormProps) => {
  const isEditMode = !!ride;
  const { user } = useAuth();
  const { isStaff, permissionLevel } = useStaff();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const [categories, setCategories] = useState<RideCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [openRequest, setOpenRequest] = useState(false);
  const [formData, setFormData] = useState({
    ride_name: ride?.ride_name || '',
    category_id: ride?.category_id || '',
    manufacturer: ride?.manufacturer || '',
    year_manufactured: ride?.year_manufactured?.toString() || '',
    serial_number: ride?.serial_number || '',
    owner_name: ride?.owner_name || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  // Check if adding a billable ride would exceed the current tier
  const selectedCategory = categories.find(c => c.id === formData.category_id);
  const isSelectedCategoryBillable = selectedCategory?.is_billable !== false; // Default to billable if unknown
  const wouldExceedTier = !isEditMode && subscription && isSelectedCategoryBillable && !subscription.canAddRide && subscription.subscriptionStatus === 'active';

  useEffect(() => {
    loadCategories();
    if (isEditMode && ride) {
      loadExistingPhoto();
    }
  }, []);

  const loadExistingPhoto = async () => {
    if (!user || !ride) return;
    
    try {
      const { data: photoDoc } = await supabase
        .from('documents')
        .select('id, file_path')
        .eq('user_id', user.id)
        .eq('ride_id', ride.id)
        .eq('document_type', 'photo')
        .eq('is_latest_version', true)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (photoDoc?.file_path) {
        setExistingPhotoPath(photoDoc.file_path);
        const { data } = await supabase.storage
          .from('ride-documents')
          .createSignedUrl(photoDoc.file_path, 3600);
        
        if (data?.signedUrl) {
          setExistingPhotoUrl(data.signedUrl);
        }
      }
    } catch (error) {
      console.error('Error loading existing photo:', error);
    }
  };

  const handleDeleteExistingPhoto = async () => {
    if (!user || !ride || !existingPhotoPath) return;
    
    setDeletingPhoto(true);
    try {
      // Delete from storage
      await supabase.storage
        .from('ride-documents')
        .remove([existingPhotoPath]);
      
      // Delete document record
      await supabase
        .from('documents')
        .delete()
        .eq('user_id', user.id)
        .eq('ride_id', ride.id)
        .eq('document_type', 'photo')
        .eq('file_path', existingPhotoPath);
      
      setExistingPhotoUrl(null);
      setExistingPhotoPath(null);
      
      toast({
        title: "Photo deleted",
        description: "The device photo has been removed."
      });
    } catch (error: any) {
      console.error('Error deleting photo:', error);
      toast({
        title: "Failed to delete photo",
        description: error?.message || "Please try again.",
        variant: "destructive"
      });
    } finally {
      setDeletingPhoto(false);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('ride_categories')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error loading categories:', error);
      } else {
        setCategories(data || []);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Compress large images
      let processedFile = file;
      if (file.size > 500000) {
        try {
          processedFile = await compressImage(file);
          if (processedFile.size < file.size) {
            toast({
              title: "Image compressed",
              description: `Reduced from ${(file.size / 1024 / 1024).toFixed(1)}MB to ${(processedFile.size / 1024 / 1024).toFixed(1)}MB`,
            });
          }
        } catch (error) {
          console.error('Compression failed:', error);
        }
      }
      setPhotoFile(processedFile);
      const url = URL.createObjectURL(processedFile);
      setPhotoPreview(url);
    } else {
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  };

  // Staff with full_access can add rides, others cannot
  const canAddRides = !isStaff || permissionLevel === 'manager';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only staff without full_access are blocked from adding equipment
    if (!canAddRides && !isEditMode) {
      toast({
        title: "Permission denied",
        description: "Only staff with full access can add new equipment. Please contact your operator.",
        variant: "destructive",
      });
      return;
    }
    
    // If adding a billable ride would exceed tier, block and redirect
    if (wouldExceedTier) {
      const nextTierKey = subscription!.currentTier === 'starter' ? 'operator' : subscription!.currentTier === 'operator' ? 'professional' : 'business';
      toast({
        title: "Upgrade required",
        description: `You've reached ${subscription!.rideLimit} rides on the ${subscription!.tierLabel} tier. Upgrade to ${getTierLabel(nextTierKey)} to add more.`,
      });
      navigate('/billing');
      return;
    }
    
    setErrors({});

    try {
      // Prepare data for validation
      const validationData = {
        ...formData,
        year_manufactured: formData.year_manufactured ? parseInt(formData.year_manufactured) : undefined,
        manufacturer: formData.manufacturer || undefined,
        serial_number: formData.serial_number || undefined,
        owner_name: formData.owner_name || undefined,
      };

      // Validate form data
      const validatedData = rideSchema.parse(validationData);

      setLoading(true);

      if (isEditMode && ride) {
        // Update existing ride
        const { error } = await supabase
          .from('rides')
          .update({
            ride_name: validatedData.ride_name,
            category_id: validatedData.category_id,
            manufacturer: validatedData.manufacturer || null,
            year_manufactured: validatedData.year_manufactured || null,
            serial_number: validatedData.serial_number || null,
            owner_name: validatedData.owner_name || null,
          })
          .eq('id', ride.id)
          .eq('user_id', user!.id);

        if (error) {
          toast({
            title: "Error updating equipment",
            description: error.message,
            variant: "destructive",
          });
        } else {
          // Upload photo if provided
          if (photoFile && user) {
              try {
                const ts = Date.now();
                const safeName = photoFile.name.replace(/\s+/g, '-');
                const fileName = `device-photo-${ts}-${safeName}`;
                const filePath = `${user.id}/${ride.id}/${fileName}`;

                // Upload to storage
                const { error: upErr } = await supabase
                  .storage
                  .from('ride-documents')
                  .upload(filePath, photoFile, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: photoFile.type || 'image/jpeg',
                  });
                if (upErr) throw upErr;

                // Insert document record
                const { error: docErr } = await supabase
                  .from('documents')
                  .insert({
                    user_id: user.id,
                    ride_id: ride.id,
                    document_name: 'Device Photo',
                    document_type: 'photo',
                    file_path: filePath,
                    file_size: photoFile.size,
                    mime_type: photoFile.type || 'image/jpeg',
                    notes: 'Primary device photo',
                    is_latest_version: true,
                  });
                if (docErr) throw docErr;
              } catch (e: any) {
                console.warn('Photo attach failed:', e?.message || e);
                toast({
                  title: 'Equipment updated (photo not saved)',
                  description: 'The equipment is updated but the photo upload failed. You can add a photo later.',
                  variant: 'destructive',
                });
              } finally {
                if (photoPreview) URL.revokeObjectURL(photoPreview);
                setPhotoFile(null);
                setPhotoPreview(null);
              }
            }
            onSuccess();
          }
      } else {
        // Insert new ride
        const { data: newRide, error } = await supabase
          .from('rides')
          .insert({
            user_id: user!.id,
            ride_name: validatedData.ride_name,
            category_id: validatedData.category_id,
            manufacturer: validatedData.manufacturer || null,
            year_manufactured: validatedData.year_manufactured || null,
            serial_number: validatedData.serial_number || null,
            owner_name: validatedData.owner_name || null,
          })
          .select()
          .single();

        if (error) {
          toast({
            title: "Error adding ride",
            description: error.message,
            variant: "destructive",
          });
        } else {
          // Upload photo if provided
          if (photoFile && newRide?.id && user) {
            try {
              const ts = Date.now();
              const safeName = photoFile.name.replace(/\s+/g, '-');
              const fileName = `device-photo-${ts}-${safeName}`;
              const filePath = `${user.id}/${newRide.id}/${fileName}`;

              // Upload to storage
              const { error: upErr } = await supabase
                .storage
                .from('ride-documents')
                .upload(filePath, photoFile, {
                  cacheControl: '3600',
                  upsert: true,
                  contentType: photoFile.type || 'image/jpeg',
                });
              if (upErr) throw upErr;

              // Insert document record
              const { error: docErr } = await supabase
                .from('documents')
                .insert({
                  user_id: user.id,
                  ride_id: newRide.id,
                  document_name: 'Device Photo',
                  document_type: 'photo',
                  file_path: filePath,
                  file_size: photoFile.size,
                  mime_type: photoFile.type || 'image/jpeg',
                  notes: 'Primary device photo',
                  is_latest_version: true,
                });
              if (docErr) throw docErr;
            } catch (e: any) {
              console.warn('Photo attach failed:', e?.message || e);
              toast({
                title: 'Ride created (photo not saved)',
                description: 'The ride is saved but the photo upload failed. You can add a photo later.',
                variant: 'destructive',
              });
            } finally {
              if (photoPreview) URL.revokeObjectURL(photoPreview);
              setPhotoFile(null);
              setPhotoPreview(null);
            }
          }
          onSuccess();
        }
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
        console.error('Error adding ride:', error);
        toast({
          title: "Error adding ride",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };


  // Staff members without full_access cannot add new equipment - show a blocking message
  if (!canAddRides && !isEditMode) {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <Button 
          variant="ghost" 
          onClick={onCancel} 
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Alert variant="destructive" className="mt-4">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            Only staff with full access permission can add new equipment. Please contact your operator if you need new items added.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={onCancel} 
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{isEditMode ? 'Edit Equipment' : 'Add Equipment'}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isEditMode ? 'Update the details for your ride or generator' : 'Enter the details for your new ride or generator'}
          </p>
          {subscription && !isEditMode && subscription.subscriptionStatus === 'active' && (
            <p className="text-xs text-muted-foreground mt-2">
              {subscription.billableRideCount} of {subscription.rideLimit} billable rides on {subscription.tierLabel} tier
            </p>
          )}
          {wouldExceedTier && (
            <Alert className="mt-3 border-warning/30 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle className="text-warning">Tier limit reached</AlertTitle>
              <AlertDescription>
                You have {subscription!.billableRideCount} of {subscription!.rideLimit} billable rides on the {subscription!.tierLabel} tier. 
                To add more, <button type="button" className="underline font-medium" onClick={() => navigate('/billing')}>upgrade your plan</button>.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <form id="ride-form-root" onSubmit={handleSubmit} className="space-y-8">
        {/* Essential Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Essential Information</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ride_name">Equipment Name *</Label>
              <Input
                id="ride_name"
                value={formData.ride_name}
                onChange={(e) => setFormData({ ...formData, ride_name: e.target.value })}
                placeholder="e.g., Mickey's Waltzer, Super Bob Dodgems, Giant Wheel"
                className={errors.ride_name ? "border-destructive" : ""}
              />
              {errors.ride_name && (
                <p className="text-sm text-destructive">{errors.ride_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category_id">Category *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              >
                <SelectTrigger className={errors.category_id ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category_id && (
                <p className="text-sm text-destructive">{errors.category_id}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Categories help match relevant bulletins
              </p>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                onClick={() => setOpenRequest(true)}
                className="h-auto py-1 px-2 text-xs w-fit"
              >
                <Plus className="w-3 h-3 mr-1" />
                Request category
              </Button>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Technical Details (Optional)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                placeholder="e.g., Wisdom Rides"
                className={errors.manufacturer ? "border-destructive" : ""}
              />
              {errors.manufacturer && (
                <p className="text-sm text-destructive">{errors.manufacturer}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="year_manufactured">Year Manufactured</Label>
              <Input
                id="year_manufactured"
                type="number"
                value={formData.year_manufactured}
                onChange={(e) => setFormData({ ...formData, year_manufactured: e.target.value })}
                placeholder={new Date().getFullYear().toString()}
                min="1800"
                max={new Date().getFullYear() + 1}
                className={errors.year_manufactured ? "border-destructive" : ""}
              />
              {errors.year_manufactured && (
                <p className="text-sm text-destructive">{errors.year_manufactured}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="serial_number">Serial Number</Label>
            <Input
              id="serial_number"
              value={formData.serial_number}
              onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              placeholder="Device serial or identification number"
              className={errors.serial_number ? "border-destructive" : ""}
            />
            {errors.serial_number && (
              <p className="text-sm text-destructive">{errors.serial_number}</p>
            )}
          </div>
        </div>

        {/* Ownership */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Ownership (Optional)</h3>
          
          <div className="space-y-2">
            <Label htmlFor="owner_name">Owner Name</Label>
            <Input
              id="owner_name"
              value={formData.owner_name}
              onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
              placeholder="If different from controller"
              className={errors.owner_name ? "border-destructive" : ""}
            />
            {errors.owner_name && (
              <p className="text-sm text-destructive">{errors.owner_name}</p>
            )}
            <p className="text-xs text-muted-foreground">
              May differ from the controller (safety) or showmen (operator) in your profile
            </p>
          </div>
        </div>

        {/* Photo Upload */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Photo (Optional)</h3>
          
          <div className="space-y-3">
            {/* New photo preview (takes priority) */}
            {photoPreview ? (
              <div className="relative inline-block">
                <img 
                  src={photoPreview} 
                  alt="New photo preview" 
                  className="h-40 max-w-full rounded-lg object-contain border-2 bg-muted/30"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={() => { 
                    setPhotoFile(null); 
                    setPhotoPreview(null); 
                  }}
                >
                  ×
                </Button>
                <p className="text-xs text-muted-foreground mt-2">New photo (will replace existing on save)</p>
              </div>
            ) : existingPhotoUrl ? (
              /* Existing photo in edit mode */
              <div className="space-y-3">
                <div className="relative inline-block">
                  <img 
                    src={existingPhotoUrl} 
                    alt="Current device photo" 
                    className="h-40 max-w-full rounded-lg object-contain border-2 bg-muted/30"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('ride-photo')?.click()}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Replace Photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={handleDeleteExistingPhoto}
                    disabled={deletingPhoto}
                  >
                    {deletingPhoto ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete Photo
                  </Button>
                </div>
                {/* Hidden file input for replacement */}
                <Input
                  id="ride-photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <>
                {/* Hidden file inputs */}
                <Input
                  id="ride-photo"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <Input
                  id="ride-photo-camera"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                
                {/* Dual Upload Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-24 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#1E3A5F] hover:bg-[#F1F5F9] rounded-2xl transition-all group"
                    onClick={() => document.getElementById('ride-photo-camera')?.click()}
                  >
                    <Camera className="h-8 w-8 text-[#475569] group-hover:text-primary transition-colors" strokeWidth={2} />
                    <span className="text-sm font-medium">Take Photo</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-24 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#1E3A5F] hover:bg-[#F1F5F9] rounded-2xl transition-all group"
                    onClick={() => document.getElementById('ride-photo')?.click()}
                  >
                    <FolderOpen className="h-8 w-8 text-[#475569] group-hover:text-primary transition-colors" strokeWidth={2} />
                    <span className="text-sm font-medium">Choose File</span>
                  </Button>
                </div>
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Tip: Include the whole device and ID plate if possible
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={loading || !formData.category_id}
          >
            <Save className="h-4 w-4" />
            {loading ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Equipment' : 'Add Equipment')}
          </Button>
        </div>
      </form>

      {/* Request Category dialog */}
      <RequestRideTypeDialog open={openRequest} onOpenChange={setOpenRequest} />

    </div>
  );
};

export default RideForm;