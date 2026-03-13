import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Plus, ImagePlus, AlertTriangle, Camera, FolderOpen, Trash2, Loader2, ShieldAlert, Gauge } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { z } from 'zod';
import { RequestRideTypeDialog } from '@/components/RequestRideTypeDialog';
import { useSubscription, getRideTier, getTierLabel, RIDE_TIERS, SELF_SERVE_MAX } from '@/hooks/useSubscription';
import { OverLimitDialog } from '@/components/OverLimitDialog';
import { TierUpgradeDialog, getTierCrossing } from '@/components/TierUpgradeDialog';
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
  category_group: z.string().min(1, "Please select an equipment group"),
  category_id: z.string().optional(),
  manufacturer: z.string().trim().max(100, "Manufacturer must be less than 100 characters").optional(),
  year_manufactured: z.number().int().min(1800).max(new Date().getFullYear() + 1).optional(),
  serial_number: z.string().trim().max(50, "Serial number must be less than 50 characters").optional(),
  owner_name: z.string().trim().max(100, "Controller name must be less than 100 characters").optional(),
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
  const [showOverLimitDialog, setShowOverLimitDialog] = useState(false);
  const [showTierUpgradeDialog, setShowTierUpgradeDialog] = useState(false);
  const [profileData, setProfileData] = useState<{ company_name?: string; full_name?: string } | null>(null);
  const [formData, setFormData] = useState({
    ride_name: ride?.ride_name || '',
    category_group: '',
    category_id: ride?.category_id || '',
    manufacturer: ride?.manufacturer || '',
    year_manufactured: ride?.year_manufactured?.toString() || '',
    serial_number: ride?.serial_number || '',
    owner_name: ride?.owner_name || '',
  });

  // Pressure monitoring config — enabled by default for inflatables
  const [pressureEnabled, setPressureEnabled] = useState(ride?.pressure_monitoring_enabled ?? false);
  const [isMultiSectional, setIsMultiSectional] = useState(ride?.is_multi_sectional ?? false);
  const [sectionCount, setSectionCountState] = useState(ride?.section_count ?? 1);
  const [sectionConfig, setSectionConfig] = useState<Array<{ name: string; default_reading_point?: string; target_pressure?: number; min_pressure?: number; max_pressure?: number }>>(
    (ride?.section_config as any[]) || []
  );
  const [defaultPressureUnit, setDefaultPressureUnit] = useState((ride as any)?.default_pressure_unit || 'psi');
  const [pressureErrors, setPressureErrors] = useState<Record<string, string>>({});

  // Sync section config array length with sectionCount
  const updateSectionCount = (count: number) => {
    setSectionCountState(count);
    setSectionConfig(prev => {
      const next = [...prev];
      while (next.length < count) next.push({ name: `Section ${next.length + 1}` });
      return next.slice(0, count);
    });
  };


  // Pre-fill controller name from profile for new rides + load profile data for over-limit dialog
  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('controller_name, company_name')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data) {
          setProfileData({ company_name: data.company_name ?? undefined });
          if (!isEditMode && !formData.owner_name && data.controller_name) {
            setFormData(prev => ({ ...prev, owner_name: data.controller_name! }));
          }
        }
      } catch (e) {
        // Non-critical, ignore
      }
    };
    loadProfile();
  }, [user, isEditMode]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  // Derive groups and filtered types
  const categoryGroups = [...new Set(categories.map(c => c.category_group))].sort();
  const filteredTypes = formData.category_group
    ? categories.filter(c => c.category_group === formData.category_group)
    : [];

  // Check if adding a billable ride would exceed the current tier
  const selectedCategory = categories.find(c => c.id === formData.category_id);
  const selectedGroupCategories = categories.filter(c => c.category_group === formData.category_group);
  const isSelectedCategoryBillable = formData.category_id
    ? selectedCategory?.is_billable !== false
    : selectedGroupCategories.length > 0 ? selectedGroupCategories[0]?.is_billable !== false : false;
  const wouldExceedTier = !isEditMode && subscription && isSelectedCategoryBillable && !subscription.canAddRide && subscription.subscriptionStatus === 'active';

  // Soft mismatch warning: if name suggests a billable item but category is non-billable
  const BILLABLE_KEYWORDS = [
    'ride', 'waltzer', 'dodgem', 'carousel', 'coaster', 'wheel', 'swinger', 'chair-o-plane',
    'inflatable', 'bouncy', 'castle', 'slide', 'bungee', 'obstacle',
    'funhouse', 'dark ride', 'dark show', 'mirror maze', 'walkthrough', 'ghost train',
    'helter', 'skelter', 'sizzler', 'twister', 'orbiter', 'tagada', 'enterprise',
  ];
  const showMismatchWarning = (() => {
    if (!formData.ride_name || !formData.category_group) return false;
    if (isSelectedCategoryBillable) return false; // already counted, no issue
    const nameLower = formData.ride_name.toLowerCase();
    return BILLABLE_KEYWORDS.some(kw => nameLower.includes(kw));
  })();

  useEffect(() => {
    loadCategories();
    if (isEditMode && ride) {
      loadExistingPhoto();
    }
  }, []);

  // In edit mode, set category_group from loaded categories once available
  useEffect(() => {
    if (isEditMode && ride?.category_id && categories.length > 0 && !formData.category_group) {
      const existingCat = categories.find(c => c.id === ride.category_id);
      if (existingCat) {
        setFormData(prev => ({ ...prev, category_group: existingCat.category_group }));
      }
    }
  }, [categories, isEditMode, ride]);

  // Auto-select category_id when group has only one type
  useEffect(() => {
    if (formData.category_group && filteredTypes.length === 1 && formData.category_id !== filteredTypes[0].id) {
      setFormData(prev => ({ ...prev, category_id: filteredTypes[0].id }));
    }
  }, [formData.category_group, filteredTypes]);


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

  // Only the controller can add rides
  const canAddRides = !isStaff;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only staff without manager role are blocked from adding equipment
    if (!canAddRides && !isEditMode) {
      toast({
        title: "Permission denied",
        description: "Only staff with full access can add new equipment. Please contact your operator.",
        variant: "destructive",
      });
      return;
    }
    
    // If adding a billable ride would exceed self-serve cap, show over-limit dialog
    if (wouldExceedTier) {
      setShowOverLimitDialog(true);
      return;
    }
    
    setErrors({});
    setPressureErrors({});

    try {
      // Resolve category_id: if not explicitly selected, use first type in group
      let resolvedCategoryId = formData.category_id;
      if (!resolvedCategoryId && formData.category_group) {
        const groupTypes = categories.filter(c => c.category_group === formData.category_group);
        if (groupTypes.length > 0) {
          resolvedCategoryId = groupTypes[0].id;
        }
      }

      // Prepare data for validation
      const validationData = {
        ...formData,
        category_id: resolvedCategoryId || undefined,
        year_manufactured: formData.year_manufactured ? parseInt(formData.year_manufactured) : undefined,
        manufacturer: formData.manufacturer || undefined,
        serial_number: formData.serial_number || undefined,
        owner_name: formData.owner_name || undefined,
      };

      // Validate form data
      const validatedData = rideSchema.parse(validationData);
      
      // Ensure we have a resolved category_id for the DB
      const finalCategoryId = resolvedCategoryId || '';
      if (!finalCategoryId) {
        setErrors({ category_group: 'Please select an equipment group' });
        return;
      }

      // Validate pressure config for inflatables
      if (pressureEnabled) {
        const pErrors: Record<string, string> = {};
        if (!defaultPressureUnit) {
          pErrors.unit = 'Please select a pressure unit';
        }
        if (isMultiSectional) {
          sectionConfig.forEach((sc, idx) => {
            if (!sc.name?.trim()) {
              pErrors[`section_name_${idx}`] = 'Section name is required';
            }
          });
        }
        if (Object.keys(pErrors).length > 0) {
          setPressureErrors(pErrors);
          toast({ title: 'Missing pressure setup fields', description: 'Please complete the highlighted fields.', variant: 'destructive' });
          return;
        }
      }

      setLoading(true);

      if (isEditMode && ride) {
        // Update existing ride
        const { error } = await supabase
          .from('rides')
          .update({
            ride_name: validatedData.ride_name,
            category_id: finalCategoryId,
            manufacturer: validatedData.manufacturer || null,
            year_manufactured: validatedData.year_manufactured || null,
            serial_number: validatedData.serial_number || null,
            owner_name: validatedData.owner_name || null,
            pressure_monitoring_enabled: pressureEnabled,
            is_multi_sectional: isMultiSectional,
            section_count: isMultiSectional ? sectionCount : 1,
            section_config: isMultiSectional ? sectionConfig : [],
            default_pressure_unit: pressureEnabled ? defaultPressureUnit : null,
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
        // Determine default for requires_operational_checks based on category group
        const selectedCat = categories.find(c => c.id === finalCategoryId);
        const nonOperationalGroups = ['Food Stalls', 'Games', 'Equipment'];
        const defaultRequiresChecks = selectedCat ? !nonOperationalGroups.includes(selectedCat.category_group) : true;

        // Insert new ride
        const { data: newRide, error } = await supabase
          .from('rides')
          .insert({
            user_id: user!.id,
            ride_name: validatedData.ride_name,
            category_id: finalCategoryId,
            manufacturer: validatedData.manufacturer || null,
            year_manufactured: validatedData.year_manufactured || null,
            serial_number: validatedData.serial_number || null,
            owner_name: validatedData.owner_name || null,
            requires_operational_checks: defaultRequiresChecks,
            pressure_monitoring_enabled: pressureEnabled,
            is_multi_sectional: isMultiSectional,
            section_count: isMultiSectional ? sectionCount : 1,
            section_config: isMultiSectional ? sectionConfig : [],
            default_pressure_unit: pressureEnabled ? defaultPressureUnit : null,
          })
          .select()
          .single();

        if (error) {
          // Intercept RLS tier-limit block and show user-friendly dialog
          if (error.message?.includes('row-level security') || error.code === '42501') {
            setShowOverLimitDialog(true);
          } else {
            toast({
              title: "Error adding ride",
              description: error.message,
              variant: "destructive",
            });
          }
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


  // Staff members without manager role cannot add new equipment - show a blocking message
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
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-32 md:pb-6 bg-[hsl(210,30%,95%)] -mx-4 md:mx-auto px-4 md:px-6 min-h-full">
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
            {isEditMode ? 'Update the details for this equipment' : 'Add a new item to your equipment register'}
          </p>
          {subscription && !isEditMode && subscription.subscriptionStatus === 'active' && (
            <p className="text-xs text-muted-foreground mt-2">
              {subscription.billableRideCount} of {subscription.rideLimit} billable items on {subscription.tierLabel} tier
            </p>
          )}
          {wouldExceedTier && (
            <Alert className="mt-3 border-warning/30 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle className="text-warning">You've reached your plan limit</AlertTitle>
              <AlertDescription>
                You've reached the self-serve plan limit of {SELF_SERVE_MAX} items.
                Need more capacity? <button type="button" className="underline font-medium" onClick={() => setShowOverLimitDialog(true)}>Contact us</button> about a larger operator plan.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <form id="ride-form-root" onSubmit={handleSubmit} className="space-y-5">

        {/* ── Section 1: Essential Information ── */}
        <section className="rounded-xl border border-foreground/10 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <h3 className="text-sm font-bold text-foreground">Essential Information</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ride_name" className="text-[13px] font-semibold text-foreground">Equipment Name *</Label>
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

            <div className="space-y-1.5">
              <Label htmlFor="category_group" className="text-[13px] font-semibold text-foreground">Equipment Group *</Label>
              <Select
                value={formData.category_group}
                onValueChange={(value) => {
                  const typesInGroup = categories.filter(c => c.category_group === value);
                  const autoId = typesInGroup.length === 1 ? typesInGroup[0].id : '';
                  setFormData({ ...formData, category_group: value, category_id: autoId });
                  // Auto-enable pressure monitoring for inflatables
                  if (value === 'Inflatables') {
                    setPressureEnabled(true);
                  } else {
                    setPressureEnabled(false);
                    setIsMultiSectional(false);
                  }
                }}
              >
                <SelectTrigger className={errors.category_group ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select equipment group" />
                </SelectTrigger>
                <SelectContent>
                  {categoryGroups.map((group) => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-foreground/55">
                The broad category of your equipment
              </p>
              {formData.category_group && isSelectedCategoryBillable && !isEditMode && (
                <p className="text-xs text-primary mt-1">
                  This item counts toward your plan allowance
                </p>
              )}
              {formData.category_group && !isSelectedCategoryBillable && !isEditMode && (
                <p className="text-xs text-muted-foreground mt-1">
                  This item does not count toward your plan allowance
                </p>
              )}
            </div>

            {formData.category_group && filteredTypes.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="category_id" className="text-[13px] font-semibold text-foreground">Equipment Type (optional)</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a specific type" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTypes.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-foreground/55">
                  If you can't find the exact type, leave blank or request a new one below
                </p>
              </div>
            )}

            {formData.category_group && filteredTypes.length === 1 && (
              <p className="text-xs text-foreground/55">
                Type auto-selected: <span className="font-semibold text-foreground/70">{filteredTypes[0].name}</span>
              </p>
            )}

            {errors.category_group && (
              <p className="text-sm text-destructive">{errors.category_group}</p>
            )}

            {showMismatchWarning && (
              <Alert className="border-warning/30 bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle className="text-warning text-sm">Check classification</AlertTitle>
                <AlertDescription className="text-xs">
                  The name "{formData.ride_name}" looks like it could be a ride, inflatable, or attraction. 
                  Items in {formData.category_group} are not counted toward your plan. Please check this is the right category.
                </AlertDescription>
              </Alert>
            )}

            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={() => setOpenRequest(true)}
              className="h-auto py-1 px-2 text-xs w-fit text-primary"
            >
              <Plus className="w-3 h-3 mr-1" />
              Request a new type
            </Button>
          </div>
        </section>

        {/* ── Section 2: Technical Details ── */}
        <section className="rounded-xl border border-foreground/10 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <h3 className="text-sm font-bold text-foreground">Technical Details <span className="font-normal text-muted-foreground">(optional)</span></h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="manufacturer" className="text-[13px] font-semibold text-foreground">Manufacturer</Label>
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

              <div className="space-y-1.5">
                <Label htmlFor="year_manufactured" className="text-[13px] font-semibold text-foreground">Year Manufactured</Label>
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

            <div className="space-y-1.5">
              <Label htmlFor="serial_number" className="text-[13px] font-semibold text-foreground">Serial Number</Label>
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
        </section>

        {/* ── Section 3: Controller ── */}
        <section className="rounded-xl border border-foreground/10 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <h3 className="text-sm font-bold text-foreground">Controller <span className="font-normal text-muted-foreground">(optional)</span></h3>
          </div>
          <div className="p-4 space-y-1.5">
            <Label htmlFor="owner_name" className="text-[13px] font-semibold text-foreground">Controller Name(s)</Label>
            <Input
              id="owner_name"
              value={formData.owner_name}
              onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
              placeholder="e.g. John & Jane Smith"
              className={errors.owner_name ? "border-destructive" : ""}
            />
            {errors.owner_name && (
              <p className="text-sm text-destructive">{errors.owner_name}</p>
            )}
            <p className="text-xs text-foreground/55 pt-0.5">
              The person(s) responsible for this equipment's safety and compliance
            </p>
          </div>
        </section>

        {/* ── Section 4: Pressure Monitoring (inflatables only) ── */}
        {formData.category_group === 'Inflatables' && (
        <section className="rounded-xl border border-foreground/10 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Pressure Monitoring</h3>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-[11px] text-muted-foreground">
              Pressure monitoring is available for all inflatables. Log pressure readings via the Pressure tab once this equipment is saved.
            </p>

             {/* Default pressure unit */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold text-foreground">Pressure unit *</Label>
              <Select value={defaultPressureUnit} onValueChange={(v) => { setDefaultPressureUnit(v); setPressureErrors(prev => { const n = {...prev}; delete n.unit; return n; }); }}>
                <SelectTrigger className={`w-40 ${pressureErrors.unit ? 'border-destructive' : ''}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="psi">PSI</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="mbar">mbar</SelectItem>
                  <SelectItem value="mmH2O">mmH₂O</SelectItem>
                </SelectContent>
              </Select>
              {pressureErrors.unit && <p className="text-xs text-destructive">{pressureErrors.unit}</p>}
              <p className="text-[11px] text-muted-foreground">Pre-selected when you start a new pressure session.</p>
            </div>

            {/* Single vs Multi-section selector */}
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold text-foreground">Inflatable structure</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsMultiSectional(false)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    !isMultiSectional
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <p className="text-[13px] font-semibold text-foreground">Single-section</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">One air chamber</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMultiSectional(true);
                    if (sectionCount < 2) updateSectionCount(2);
                  }}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    isMultiSectional
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <p className="text-[13px] font-semibold text-foreground">Multi-section</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Multiple air chambers</p>
                </button>
              </div>
            </div>

            {isMultiSectional && (
              <div className="space-y-3 border-t border-border pt-4">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-semibold text-foreground">How many sections does this inflatable have?</Label>
                  <Input
                    type="number"
                    min={2}
                    max={20}
                    value={sectionCount}
                    onChange={e => updateSectionCount(Math.max(2, Math.min(20, parseInt(e.target.value) || 2)))}
                    className="w-24"
                  />
                  <p className="text-[11px] text-muted-foreground">Each section will require its own pressure reading during a session.</p>
                </div>
                <div className="space-y-2">
                  {sectionConfig.map((sc, idx) => (
                    <div key={idx} className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Section {idx + 1}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Section name *</Label>
                          <Input
                            value={sc.name}
                            onChange={e => {
                              const next = [...sectionConfig];
                              next[idx] = { ...next[idx], name: e.target.value };
                              setSectionConfig(next);
                              if (e.target.value.trim()) {
                                setPressureErrors(prev => { const n = {...prev}; delete n[`section_name_${idx}`]; return n; });
                              }
                            }}
                            placeholder={`e.g. Front Arch, Rear Chamber`}
                            className={`h-9 text-[13px] ${pressureErrors[`section_name_${idx}`] ? 'border-destructive' : ''}`}
                          />
                          {pressureErrors[`section_name_${idx}`] && <p className="text-[10px] text-destructive">{pressureErrors[`section_name_${idx}`]}</p>}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Reading point for this section</Label>
                          <Input
                            value={sc.default_reading_point || ''}
                            onChange={e => {
                              const next = [...sectionConfig];
                              next[idx] = { ...next[idx], default_reading_point: e.target.value };
                              setSectionConfig(next);
                            }}
                            placeholder="e.g. Valve A, Near seam"
                            className="h-9 text-[13px]"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Target pressure</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={sc.target_pressure ?? ''}
                            onChange={e => {
                              const next = [...sectionConfig];
                              next[idx] = { ...next[idx], target_pressure: e.target.value ? parseFloat(e.target.value) : undefined };
                              setSectionConfig(next);
                            }}
                            placeholder="e.g. 1.5"
                            className="h-9 text-[13px]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Min pressure</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={sc.min_pressure ?? ''}
                            onChange={e => {
                              const next = [...sectionConfig];
                              next[idx] = { ...next[idx], min_pressure: e.target.value ? parseFloat(e.target.value) : undefined };
                              setSectionConfig(next);
                            }}
                            placeholder="e.g. 1.0"
                            className="h-9 text-[13px]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Max pressure</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={sc.max_pressure ?? ''}
                            onChange={e => {
                              const next = [...sectionConfig];
                              next[idx] = { ...next[idx], max_pressure: e.target.value ? parseFloat(e.target.value) : undefined };
                              setSectionConfig(next);
                            }}
                            placeholder="e.g. 2.0"
                            className="h-9 text-[13px]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isMultiSectional && (
              <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg p-3">
                Single-section inflatable — pressure sessions will show one reading row.
              </p>
            )}
          </div>
        </section>
        )}

        {/* ── Section 5: Photo ── */}
        <section className="rounded-xl border border-foreground/10 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <h3 className="text-sm font-bold text-foreground">Photo <span className="font-normal text-muted-foreground">(optional)</span></h3>
          </div>
          <div className="p-4 space-y-3">
            {/* New photo preview (takes priority) */}
            {photoPreview ? (
              <div className="relative inline-block">
                <img 
                  src={photoPreview} 
                  alt="New photo preview" 
                  className="h-40 max-w-full rounded-lg object-contain border border-border bg-muted/30"
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
                <p className="text-xs text-foreground/50 mt-2">New photo (will replace existing on save)</p>
              </div>
            ) : existingPhotoUrl ? (
              /* Existing photo in edit mode */
              <div className="space-y-3">
                <div className="relative inline-block">
                  <img 
                    src={existingPhotoUrl} 
                    alt="Current device photo" 
                    className="h-40 max-w-full rounded-lg object-contain border border-border bg-muted/30"
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
                
                {/* Dual Upload Tiles */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="h-28 flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-foreground/12 bg-[hsl(210,30%,96%)] hover:bg-primary/8 hover:border-primary/40 transition-all group active:scale-[0.98] shadow-sm"
                    onClick={() => document.getElementById('ride-photo-camera')?.click()}
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center group-hover:bg-primary/20 transition-colors shadow-sm">
                      <Camera className="h-5 w-5 text-primary" strokeWidth={2.2} />
                    </div>
                    <span className="text-[13px] font-bold text-foreground/65 group-hover:text-foreground/85">Take Photo</span>
                  </button>
                  <button
                    type="button"
                    className="h-28 flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-foreground/12 bg-[hsl(210,30%,96%)] hover:bg-primary/8 hover:border-primary/40 transition-all group active:scale-[0.98] shadow-sm"
                    onClick={() => document.getElementById('ride-photo')?.click()}
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center group-hover:bg-primary/20 transition-colors shadow-sm">
                      <FolderOpen className="h-5 w-5 text-primary" strokeWidth={2.2} />
                    </div>
                    <span className="text-[13px] font-bold text-foreground/65 group-hover:text-foreground/85">Choose File</span>
                  </button>
                </div>
              </>
            )}
            <p className="text-xs text-foreground/55">
              Tip: Include the whole device and ID plate if possible
            </p>
          </div>
        </section>

        {/* ── Sticky Action Bar ── */}
        <div className="flex items-center justify-end gap-3 pt-4 md:pt-6 md:relative fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] md:bottom-auto left-0 right-0 md:left-auto md:right-auto bg-card md:bg-transparent px-4 md:px-0 py-3 md:py-0 z-30 border-t-2 border-foreground/12 md:border-t md:border-foreground/10 shadow-[0_-8px_24px_rgba(0,0,0,0.15)] md:shadow-none">
          <Button type="button" variant="outline" onClick={onCancel} className="min-w-[80px]">
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={loading || !formData.category_group}
            className="min-w-[140px]"
          >
            <Save className="h-4 w-4" />
            {loading ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Equipment' : 'Add Equipment')}
          </Button>
        </div>
      </form>

      {/* Request Category dialog */}
      <RequestRideTypeDialog open={openRequest} onOpenChange={setOpenRequest} />

      {/* Over-limit dialog */}
      {subscription && (
        <OverLimitDialog
          open={showOverLimitDialog}
          onOpenChange={setShowOverLimitDialog}
          currentPlan={subscription.tierLabel}
          currentItemCount={subscription.billableRideCount}
          attemptedItemCount={subscription.billableRideCount + 1}
          organisationName={profileData?.company_name}
          userEmail={user?.email}
        />
      )}

    </div>
  );
};

export default RideForm;