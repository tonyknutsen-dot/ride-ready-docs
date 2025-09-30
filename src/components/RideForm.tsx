import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Plus, ImagePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { z } from 'zod';
import { RequestRideTypeDialog } from '@/components/RequestRideTypeDialog';

type RideCategory = Tables<'ride_categories'>;

interface RideFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const rideSchema = z.object({
  ride_name: z.string().trim().min(1, "Ride name is required").max(100, "Ride name must be less than 100 characters"),
  category_id: z.string().min(1, "Please select a ride category"),
  manufacturer: z.string().trim().max(100, "Manufacturer must be less than 100 characters").optional(),
  year_manufactured: z.number().int().min(1800).max(new Date().getFullYear() + 1).optional(),
  serial_number: z.string().trim().max(50, "Serial number must be less than 50 characters").optional(),
  owner_name: z.string().trim().max(100, "Owner name must be less than 100 characters").optional(),
});

const RideForm = ({ onSuccess, onCancel }: RideFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [categories, setCategories] = useState<RideCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [openRequest, setOpenRequest] = useState(false);
  const [formData, setFormData] = useState({
    ride_name: '',
    category_id: '',
    manufacturer: '',
    year_manufactured: '',
    serial_number: '',
    owner_name: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

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

      // Insert the ride
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

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={onCancel} className="flex items-center space-x-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Rides</span>
        </Button>
        <div>
          <h2 className="text-3xl font-bold">Add New Ride</h2>
          <p className="text-muted-foreground">
            Add a new ride to your inventory
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Ride Information</CardTitle>
          <CardDescription>
            Enter the details for your new ride. Note: The ride owner may be different from the controller or showmen listed in your profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ride_name">Ride Name *</Label>
              <Input
                id="ride_name"
                value={formData.ride_name}
                onChange={(e) => setFormData({ ...formData, ride_name: e.target.value })}
                placeholder="Enter ride name"
                className={errors.ride_name ? "border-destructive" : ""}
              />
              {errors.ride_name && (
                <p className="text-sm text-destructive">{errors.ride_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category_id" className="text-base font-semibold">Ride / Stall / Generator category *</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
              >
                <SelectTrigger className={`h-11 text-base ${errors.category_id ? "border-destructive" : ""}`}>
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
              {!formData.category_id && !errors.category_id && (
                <p className="text-sm text-muted-foreground">Pick the category. If yours isn't listed, press 'Request category'.</p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setOpenRequest(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Can't find my category
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="Enter manufacturer"
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
                  placeholder="Enter year"
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
                placeholder="Enter serial number"
                className={errors.serial_number ? "border-destructive" : ""}
              />
              {errors.serial_number && (
                <p className="text-sm text-destructive">{errors.serial_number}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner_name">Ride Owner</Label>
              <Input
                id="owner_name"
                value={formData.owner_name}
                onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                placeholder="Enter owner name (if different from controller)"
                className={errors.owner_name ? "border-destructive" : ""}
              />
              {errors.owner_name && (
                <p className="text-sm text-destructive">{errors.owner_name}</p>
              )}
              <p className="text-xs text-muted-foreground">
                The ride owner may be different from the controller (responsible for safety) or showmen (operator) in your profile.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ride-photo" className="text-base font-semibold">Attach a photo (optional)</Label>
              <Input
                id="ride-photo"
                type="file"
                accept="image/*"
                // @ts-ignore
                capture="environment"
                onChange={handlePhotoSelect}
                className="h-11 text-base cursor-pointer"
              />
              {photoPreview && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={photoPreview} alt="Preview" className="h-20 w-20 rounded-md object-cover border" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { 
                      setPhotoFile(null); 
                      setPhotoPreview(null); 
                    }}
                  >
                    Remove photo
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Tip: Take a clear picture of the whole device and the ID plate.
              </p>
            </div>

            <div className="flex space-x-4 pt-4">
              <Button 
                type="submit" 
                disabled={loading || !formData.category_id} 
                className="btn-bold-primary flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>{loading ? 'Adding...' : 'Add Ride'}</span>
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Request Category dialog */}
      <RequestRideTypeDialog open={openRequest} onOpenChange={setOpenRequest} />
    </div>
  );
};

export default RideForm;