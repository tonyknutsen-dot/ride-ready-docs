import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Plus, ImagePlus, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { z } from 'zod';
import { RequestRideTypeDialog } from '@/components/RequestRideTypeDialog';
import { useSubscription, RIDE_LIMITS } from '@/hooks/useSubscription';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
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

  // Check if user can add more rides (only for new rides, not edits)
  const atRideLimit = !isEditMode && subscription && !subscription.canAddRide;

  useEffect(() => {
    loadCategories();
  }, []);

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

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    } else {
      setPhotoFile(null);
      setPhotoPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  // Show ride limit message if at limit
  if (atRideLimit && !subscriptionLoading) {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={onCancel} 
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="text-lg">Equipment Limit Reached</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-4">
              You've reached the limit of <strong>{subscription?.rideLimit} rides/equipment</strong> on your current plan.
              You currently have <strong>{subscription?.rideCount} items</strong> registered.
            </p>
            <p className="mb-4">
              To add more equipment, please contact us to discuss an extended plan for larger operations.
            </p>
            <Button 
              onClick={() => navigate('/settings?tab=billing')}
              className="mt-2"
            >
              View Plan & Billing
            </Button>
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
          {subscription && !isEditMode && (
            <p className="text-xs text-muted-foreground mt-2">
              {subscription.rideCount} of {subscription.rideLimit} equipment slots used
            </p>
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
                placeholder="e.g., Waltzer, Hook-a-Duck, Generator 45kVA"
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
            {photoPreview ? (
              <div className="relative inline-block">
                <img 
                  src={photoPreview} 
                  alt="Preview" 
                  className="h-32 w-32 rounded-lg object-cover border-2"
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
              </div>
            ) : (
              <label htmlFor="ride-photo" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <ImagePlus className="w-8 h-8 mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
                </div>
                <Input
                  id="ride-photo"
                  type="file"
                  accept="image/*"
                  // @ts-ignore
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>
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