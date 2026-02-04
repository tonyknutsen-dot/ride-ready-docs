import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTester } from '@/contexts/TesterContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Settings, FileText, CheckSquare, Mail, Lock, Gamepad2, Utensils, Zap, FerrisWheel, Wind, Store, Sparkles, ImageIcon, Camera, Loader2 } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import RideForm from '@/components/RideForm';
import { SendDocumentsDialog } from '@/components/SendDocumentsDialog';
import { ItemLimitWarning } from '@/components/ItemLimitWarning';
import { compressImage } from '@/utils/imageCompression';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { PullToRefresh } from '@/components/PullToRefresh';
import StaffAccountBanner from '@/components/StaffAccountBanner';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

const Rides = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { subscription } = useSubscription();
  const { isTester } = useTester();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();
  const [rides, setRides] = useState<Ride[]>([]);
  const [ridePhotos, setRidePhotos] = useState<Record<string, string | null>>({});
  const [rideStats, setRideStats] = useState<Record<string, {
    docCount: number;
    checkCount: number;
    nextDue: string | null;
  }>>({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>('All');
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null);
  
  // Check for action parameter to auto-open add form (only for non-staff)
  useEffect(() => {
    if (searchParams.get('action') === 'add' && !isStaff) {
      setShowAddForm(true);
      // Clear the param so refreshing doesn't re-open
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, isStaff]);
  
  // Determine if user has advanced access (subscriber or tester)
  const hasAdvancedAccess = subscription?.subscriptionStatus === 'advanced' || isTester;

  useEffect(() => {
    if (effectiveUserId) {
      loadRides();
    }
  }, [effectiveUserId]);

  const loadRides = async () => {
    try {
      // Always scope to the *current operator* (effectiveUserId).
      // RLS will further restrict staff to assigned rides when applicable.
      let query = supabase
        .from('rides')
        .select(`
          *,
          ride_categories (
            name,
            description,
            category_group
          )
        `)
        .order('created_at', { ascending: false });

      query = query.eq('user_id', effectiveUserId);
      
      const { data, error } = await query;

      if (error) {
        console.error('Error loading rides:', error);
        toast({
          title: "Error loading rides",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setRides(data as Ride[]);
        await Promise.all([
          loadRideStatistics(data as Ride[]),
          loadRidePhotos(data as Ride[])
        ]);
      }
    } catch (error) {
      console.error('Error loading rides:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRideStatistics = async (ridesData: Ride[]) => {
    const stats: Record<string, {
      docCount: number;
      checkCount: number;
      nextDue: string | null;
    }> = {};
    
    for (const ride of ridesData) {
      try {
        // Count ride-specific documents only (exclude global and maintenance docs for display)
        let docQuery = supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('ride_id', ride.id)
          .neq('document_type', 'maintenance')
          .neq('document_type', 'photo');
        docQuery = docQuery.eq('user_id', effectiveUserId);
        const { count: docCount } = await docQuery;
        
        let checkQuery = supabase
          .from('checks')
          .select('*', { count: 'exact', head: true })
          .eq('ride_id', ride.id);
        checkQuery = checkQuery.eq('user_id', effectiveUserId);
        const { count: checkCount } = await checkQuery;
        
        // For maintenance/inspection queries, staff rely on RLS
        const userId = effectiveUserId;
        const [maintenanceQuery, inspectionQuery, ndtQuery] = await Promise.all([
          isStaff 
            ? supabase.from('maintenance_records').select('next_maintenance_due').eq('ride_id', ride.id).not('next_maintenance_due', 'is', null).order('next_maintenance_due', { ascending: true }).limit(1).maybeSingle()
            : supabase.from('maintenance_records').select('next_maintenance_due').eq('user_id', userId).eq('ride_id', ride.id).not('next_maintenance_due', 'is', null).order('next_maintenance_due', { ascending: true }).limit(1).maybeSingle(),
          isStaff
            ? supabase.from('annual_inspection_reports').select('next_inspection_due').eq('ride_id', ride.id).not('next_inspection_due', 'is', null).order('next_inspection_due', { ascending: true }).limit(1).maybeSingle()
            : supabase.from('annual_inspection_reports').select('next_inspection_due').eq('user_id', userId).eq('ride_id', ride.id).not('next_inspection_due', 'is', null).order('next_inspection_due', { ascending: true }).limit(1).maybeSingle(),
          isStaff
            ? supabase.from('ndt_reports').select('next_inspection_due').eq('ride_id', ride.id).not('next_inspection_due', 'is', null).order('next_inspection_due', { ascending: true }).limit(1).maybeSingle()
            : supabase.from('ndt_reports').select('next_inspection_due').eq('user_id', userId).eq('ride_id', ride.id).not('next_inspection_due', 'is', null).order('next_inspection_due', { ascending: true }).limit(1).maybeSingle()
        ]);
        
        const dueDates = [
          maintenanceQuery.data?.next_maintenance_due,
          inspectionQuery.data?.next_inspection_due,
          ndtQuery.data?.next_inspection_due
        ].filter(Boolean).sort();
        
        stats[ride.id] = {
          docCount: docCount || 0,
          checkCount: checkCount || 0,
          nextDue: dueDates[0] || null
        };
      } catch (error) {
        console.error(`Error loading stats for ride ${ride.id}:`, error);
        stats[ride.id] = { docCount: 0, checkCount: 0, nextDue: null };
      }
    }
    setRideStats(stats);
  };

  const loadRidePhotos = async (ridesData: Ride[]) => {
    if (ridesData.length === 0) return;
    
    const photos: Record<string, string | null> = {};
    const rideIds = ridesData.map(r => r.id);
    
    try {
       // Batch query: Get all photo documents for all rides in ONE query
      let photoQuery = supabase
        .from('documents')
        .select('ride_id, file_path')
        .in('ride_id', rideIds)
        .eq('document_type', 'photo')
        .eq('is_latest_version', true)
        .order('uploaded_at', { ascending: false });
       photoQuery = photoQuery.eq('user_id', effectiveUserId);
      const { data: photoDocs } = await photoQuery;

      // Group by ride_id (take first/latest for each)
      const photoByRide: Record<string, string> = {};
      photoDocs?.forEach(doc => {
        if (doc.ride_id && !photoByRide[doc.ride_id]) {
          photoByRide[doc.ride_id] = doc.file_path;
        }
      });

      // Initialize all rides with null (no photo) first for immediate UI update
      rideIds.forEach(id => {
        photos[id] = photoByRide[id] ? undefined : null; // undefined = loading, null = no photo
      });
      setRidePhotos({ ...photos });

      // Now generate signed URLs in batches of 5 for rides that have photos
      const ridesWithPhotos = Object.entries(photoByRide);
      const batchSize = 5;
      
      for (let i = 0; i < ridesWithPhotos.length; i += batchSize) {
        const batch = ridesWithPhotos.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async ([rideId, filePath]) => {
          try {
            const { data } = await supabase.storage
              .from('ride-documents')
              .createSignedUrl(filePath, 3600);
            
            photos[rideId] = data?.signedUrl || null;
          } catch {
            photos[rideId] = null;
          }
        }));
        
        // Update state after each batch for progressive loading
        setRidePhotos(prev => ({ ...prev, ...photos }));
      }
    } catch (error) {
      console.error('Error loading ride photos:', error);
      // Mark all as no photo on error
      rideIds.forEach(id => { photos[id] = null; });
      setRidePhotos(photos);
    }
  };

  const handleRideAdded = () => {
    setShowAddForm(false);
    loadRides();
    toast({
      title: "Equipment added successfully",
      description: "Your new equipment has been added."
    });
  };

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await loadRides();
  }, [effectiveUserId]);

  const handleQuickPhotoUpload = async (rideId: string, file: File) => {
    if (!user) return;
    
    setUploadingPhotoFor(rideId);
    
    try {
      // Compress the image
      const compressedFile = await compressImage(file, 1920, 1920, 0.8);
      
      const ts = Date.now();
      const safeName = file.name.replace(/\s+/g, '-');
      const fileName = `device-photo-${ts}-${safeName}`;
      const filePath = `${user.id}/${rideId}/${fileName}`;

      // Upload to storage
      const { error: upErr } = await supabase
        .storage
        .from('ride-documents')
        .upload(filePath, compressedFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: compressedFile.type || 'image/jpeg',
        });
      if (upErr) throw upErr;

      // Insert document record
      const { error: docErr } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          ride_id: rideId,
          document_name: 'Device Photo',
          document_type: 'photo',
          file_path: filePath,
          file_size: compressedFile.size,
          mime_type: compressedFile.type || 'image/jpeg',
          notes: 'Primary device photo',
          is_latest_version: true,
        });
      if (docErr) throw docErr;

      // Get the signed URL for the new photo
      const { data: signedData } = await supabase.storage
        .from('ride-documents')
        .createSignedUrl(filePath, 3600);
      
      if (signedData?.signedUrl) {
        setRidePhotos(prev => ({ ...prev, [rideId]: signedData.signedUrl }));
      }

      toast({
        title: "Photo added",
        description: "The equipment photo has been uploaded successfully."
      });
    } catch (error: any) {
      console.error('Quick photo upload failed:', error);
      toast({
        title: "Upload failed",
        description: error?.message || "Failed to upload photo. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploadingPhotoFor(null);
    }
  };

  if (showAddForm) {
    return (
      <div className="container mx-auto px-4 py-6">
        <RideForm onSuccess={handleRideAdded} onCancel={() => setShowAddForm(false)} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <LoadingState message="Loading your equipment..." />
      </div>
    );
  }

  const categoryGroups = ['All', 'Rides', 'Food Stalls', 'Stalls', 'Games', 'Inflatables', 'Attractions', 'Equipment'] as const;

  const getCategoryIcon = (group: string) => {
    switch (group) {
      case 'Rides': return <FerrisWheel className="h-4 w-4" />;
      case 'Food Stalls': return <Utensils className="h-4 w-4" />;
      case 'Stalls': return <Store className="h-4 w-4" />;
      case 'Games': return <Gamepad2 className="h-4 w-4" />;
      case 'Inflatables': return <Wind className="h-4 w-4" />;
      case 'Attractions': return <Sparkles className="h-4 w-4" />;
      case 'Equipment': return <Zap className="h-4 w-4" />;
      default: return null;
    }
  };

  const filteredRides = activeGroup === 'All' 
    ? rides 
    : rides.filter(r => r.ride_categories.category_group === activeGroup);

  const groupCounts = {
    All: rides.length,
    Rides: rides.filter(r => r.ride_categories.category_group === 'Rides').length,
    'Food Stalls': rides.filter(r => r.ride_categories.category_group === 'Food Stalls').length,
    Stalls: rides.filter(r => r.ride_categories.category_group === 'Stalls').length,
    Games: rides.filter(r => r.ride_categories.category_group === 'Games').length,
    Inflatables: rides.filter(r => r.ride_categories.category_group === 'Inflatables').length,
    Attractions: rides.filter(r => r.ride_categories.category_group === 'Attractions').length,
    Equipment: rides.filter(r => r.ride_categories.category_group === 'Equipment').length,
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={loading}>
    <StaffAccountBanner />
    <div className="container mx-auto px-4 py-5 pb-28 md:pb-8 space-y-5">
      {/* Item Limit Warning */}
      <ItemLimitWarning />

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">My Equipment</h1>
          <p className="text-sm text-muted-foreground">Manage your rides, stalls, and equipment</p>
        </div>
        
        {/* Only show Add button for owners, not staff members */}
        {!isStaff && (
          <Button 
            onClick={() => setShowAddForm(true)} 
            className="w-full sm:w-auto flex items-center justify-center gap-2 h-12 sm:h-10"
          >
            <Plus className="h-5 w-5" />
            <span>Add Ride or Stall</span>
          </Button>
        )}
      </div>

      {/* Category Filter Tabs */}
      {rides.length > 0 && (
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 pb-2 min-w-max">
            {categoryGroups.map(group => (
              <Button
                key={group}
                variant={activeGroup === group ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveGroup(group)}
                className="h-9 gap-1.5 whitespace-nowrap"
              >
                {getCategoryIcon(group)}
                <span>{group}</span>
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-background/20">
                  {groupCounts[group as keyof typeof groupCounts]}
                </Badge>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {rides.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Settings className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No equipment added yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Start by adding your first ride, food stall, game, or equipment using the button above.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : filteredRides.length === 0 ? (
        <EmptyState
          icon={FerrisWheel}
          title={`No ${activeGroup.toLowerCase()} found`}
          description="Add your first item to get started"
          variant="compact"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRides.map(ride => (
            <Card 
              key={ride.id}
              className="group border-border hover:shadow-elegant hover:border-primary/30 transition-all active:scale-[0.98] cursor-pointer flex flex-col overflow-hidden"
              onClick={() => navigate(`/rides/${ride.id}`)}
            >
              {/* Photo Thumbnail */}
              <div className="h-40 bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center overflow-hidden relative">
                {ridePhotos[ride.id] ? (
                  <img 
                    src={ridePhotos[ride.id]!} 
                    alt={ride.ride_name}
                    loading="lazy"
                    decoding="async"
                    className="max-w-full max-h-full object-contain transition-opacity duration-300"
                    onLoad={(e) => (e.target as HTMLImageElement).style.opacity = '1'}
                    style={{ opacity: 0.7 }}
                  />
                ) : ridePhotos[ride.id] === undefined ? (
                  <div className="flex flex-col items-center gap-2 text-primary/40">
                    <div className="w-10 h-10 rounded-full bg-primary/10 animate-pulse" />
                    <span className="text-xs">Loading...</span>
                  </div>
                ) : uploadingPhotoFor === ride.id ? (
                  <div className="flex flex-col items-center gap-2 text-primary">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-xs font-medium">Uploading...</span>
                  </div>
                ) : (
                  <label 
                    className="flex flex-col items-center gap-2 cursor-pointer hover:bg-primary/5 transition-colors w-full h-full justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleQuickPhotoUpload(ride.id, file);
                        }
                        e.target.value = '';
                      }}
                    />
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Camera className="h-7 w-7 text-primary" />
                    </div>
                    <span className="text-xs text-primary font-medium">Add Photo</span>
                  </label>
                )}
              </div>

              <CardHeader className="pb-3 space-y-2 pt-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base leading-tight flex-1 break-words line-clamp-2">
                    {ride.ride_name}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs px-2 py-1 bg-primary/10 text-primary border-primary/30 shrink-0 whitespace-nowrap font-medium">
                    {ride.ride_categories.name}
                  </Badge>
                </div>
                
                {(ride.manufacturer || ride.year_manufactured) && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {ride.manufacturer && <div className="truncate">Make: {ride.manufacturer}</div>}
                    {ride.year_manufactured && <div>Year: {ride.year_manufactured}</div>}
                  </div>
                )}
              </CardHeader>
              
              <CardContent className="flex-1 flex flex-col gap-3 pt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 text-center border border-primary/20">
                    <FileText className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-xl font-bold text-primary">{rideStats[ride.id]?.docCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground font-medium">Documents</p>
                  </div>
                  
                  {hasAdvancedAccess ? (
                    <div 
                      className="p-3 rounded-xl bg-gradient-to-br from-accent/5 to-accent/15 text-center border border-accent/20 cursor-pointer hover:bg-accent/20 transition-colors"
                      onClick={e => {
                        e.stopPropagation();
                        navigate(`/rides/${ride.id}?tab=inspections`);
                      }}
                    >
                      <CheckSquare className="h-5 w-5 mx-auto text-accent mb-1" />
                      <p className="text-xl font-bold text-accent">{rideStats[ride.id]?.checkCount ?? 0}</p>
                      <p className="text-xs text-muted-foreground font-medium">Checks</p>
                    </div>
                  ) : (
                    <div 
                      className="p-3 rounded-xl bg-secondary text-center border border-dashed border-primary/20 relative cursor-pointer hover:border-primary/40 transition-colors"
                      onClick={e => {
                        e.stopPropagation();
                        navigate('/billing');
                      }}
                    >
                      <Lock className="h-3 w-3 absolute top-2 right-2 text-primary/40" />
                      <CheckSquare className="h-5 w-5 mx-auto text-primary/30 mb-1" />
                      <p className="text-xl font-bold text-primary/40">—</p>
                      <p className="text-xs text-muted-foreground">Checks</p>
                    </div>
                  )}
                </div>

                {/* Due Date Alert */}
                {rideStats[ride.id]?.nextDue && (
                  <div className="text-center p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-300 dark:border-amber-700">
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                      Due: {new Date(rideStats[ride.id].nextDue!).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: '2-digit'
                      })}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                  <Button 
                    onClick={e => {
                      e.stopPropagation();
                      navigate(`/rides/${ride.id}`);
                    }} 
                    className="flex-1 h-11"
                  >
                    View Details
                  </Button>
                  <SendDocumentsDialog 
                    ride={ride} 
                    trigger={
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="h-11 w-11 shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    } 
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
};

export default Rides;
