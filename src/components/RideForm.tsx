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
import { useBillingWriteGuard } from '@/hooks/useBillingWriteGuard';
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
  const { guardWrite } = useBillingWriteGuard();
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

  // Check if adding a billable item would cross a pricing tier boundary
  const selectedCategory = categories.find(c => c.id === formData.category_id);
  const selectedGroupCategories = categories.filter(c => c.category_group === formData.category_group);
  const isSelectedCategoryBillable = formData.category_id
    ? selectedCategory?.is_billable !== false
    : selectedGroupCategories.length > 0 ? selectedGroupCategories[0]?.is_billable !== false : false;
  
  const tierCrossing = !isEditMode && subscription && isSelectedCategoryBillable
    ? getTierCrossing(subscription.billableRideCount, subscription.currentTier)
    : null;
  const wouldExceedTier = !!tierCrossing;
...
        <TierUpgradeDialog
          open={showTierUpgradeDialog}
          onOpenChange={setShowTierUpgradeDialog}
          currentBillableCount={subscription.billableRideCount}
          currentTier={subscription.currentTier}
          currentTierLabel={subscription.tierLabel}
          organisationName={profileData?.company_name}
          userEmail={user?.email}
        />
      )}

      {/* Fallback: RLS-level block still shows OverLimitDialog */}
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