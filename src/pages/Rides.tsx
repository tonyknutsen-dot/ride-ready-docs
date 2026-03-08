import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Settings, FileText, CheckSquare, Mail, Lock, Gamepad2, Utensils, Zap, FerrisWheel, Wind, Store, Sparkles, ImageIcon, Camera, Loader2, Clock, AlertTriangle, CheckCircle, Share2, AlertOctagon } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { setCache, getCache } from '@/lib/offlineCache';
import { Tables } from '@/integrations/supabase/types';
import RideForm from '@/components/RideForm';
import { SendDocumentsDialog } from '@/components/SendDocumentsDialog';
import { ItemLimitWarning } from '@/components/ItemLimitWarning';
import { compressImage } from '@/utils/imageCompression';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { PullToRefresh } from '@/components/PullToRefresh';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import { OfflineStaleAlert } from '@/components/OfflineStaleAlert';
import EquipmentViewToggle, { type ViewMode } from '@/components/equipment/EquipmentViewToggle';
import EquipmentListView from '@/components/equipment/EquipmentListView';
import { useAllRidesCriticalDefects, useAllRidesOpenDefects } from '@/hooks/useOpenCriticalDefects';

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
  const { isStaff, permissionLevel } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();
  const [rides, setRides] = useState<Ride[]>([]);
  const [ridePhotos, setRidePhotos] = useState<Record<string, string | null>>({});
  const [rideStats, setRideStats] = useState<Record<string, {
    docCount: number;
    checkCount: number;
    nextDue: string | null;
    overdueCount: number;
    expiredDocCount: number;
    dueSoonCount: number;
  }>>({});
  const [loading, setLoading] = useState(true);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>('All');
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null);
  const { data: criticalDefectsMap } = useAllRidesCriticalDefects();
  const { data: openDefectsMap } = useAllRidesOpenDefects();

  // View toggle with localStorage persistence
  const VIEW_PREF_KEY = 'rrd-equipment-view';
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEW_PREF_KEY);
      if (saved === 'cards' || saved === 'list') return saved;
    } catch {}
    return 'cards';
  });
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_PREF_KEY, mode); } catch {}
  };
  
  // Only the controller (owner) can add rides
  const canAddRides = !isStaff;
  
  // Check for action parameter to auto-open add form (only for users who can add)
  useEffect(() => {
    if (searchParams.get('action') === 'add' && canAddRides) {
      setShowAddForm(true);
      // Clear the param so refreshing doesn't re-open
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, canAddRides]);
  
  // Determine if user has active access (subscriber or tester)
  const hasAdvancedAccess = subscription?.subscriptionStatus === 'active' || isTester;

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
        // Try offline cache fallback
        const cached = await getCache<Ride[]>(`rides:${effectiveUserId}`);
        if (cached) {
          setRides(cached.data);
          setIsOfflineData(true);
        } else {
          toast({
            title: "Error loading rides",
            description: error.message,
            variant: "destructive"
          });
        }
      } else {
        setRides(data as Ride[]);
        setIsOfflineData(false);
        // Cache for offline use
        setCache(`rides:${effectiveUserId}`, data).catch(console.error);
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
    if (ridesData.length === 0) return;
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const thirtyDaysStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const rideIds = ridesData.map(r => r.id);
    const stats: Record<string, { docCount: number; checkCount: number; nextDue: string | null; overdueCount: number; expiredDocCount: number; dueSoonCount: number; }> = {};
    
    // Initialize all rides
    rideIds.forEach(id => { stats[id] = { docCount: 0, checkCount: 0, nextDue: null, overdueCount: 0, expiredDocCount: 0, dueSoonCount: 0 }; });

    try {
      // Batch queries: get all docs & checks counts in parallel
      const [docsResult, checksResult, maintenanceResult, inspectionResult, ndtResult, expiredDocsResult, dueSoonDocsResult, overdueInspResult, dueSoonInspResult] = await Promise.all([
        supabase
          .from('documents')
          .select('ride_id')
          .in('ride_id', rideIds)
          .eq('user_id', effectiveUserId)
          .neq('document_type', 'maintenance')
          .neq('document_type', 'photo')
          .eq('is_latest_version', true),
        supabase
          .from('checks')
          .select('ride_id')
          .in('ride_id', rideIds)
          .eq('user_id', effectiveUserId)
          .eq('is_test_data', false),
        supabase
          .from('maintenance_records')
          .select('ride_id, next_maintenance_due')
          .in('ride_id', rideIds)
          .eq('user_id', effectiveUserId)
          .not('next_maintenance_due', 'is', null),
        supabase
          .from('annual_inspection_reports')
          .select('ride_id, next_inspection_due')
          .in('ride_id', rideIds)
          .eq('user_id', effectiveUserId)
          .not('next_inspection_due', 'is', null),
        supabase
          .from('ndt_reports')
          .select('ride_id, next_inspection_due')
          .in('ride_id', rideIds)
          .eq('user_id', effectiveUserId)
          .not('next_inspection_due', 'is', null),
        // Expired documents per ride
        supabase
          .from('documents')
          .select('ride_id')
          .in('ride_id', rideIds)
          .eq('user_id', effectiveUserId)
          .not('expires_at', 'is', null)
          .eq('is_latest_version', true)
          .eq('is_test_data', false)
          .lt('expires_at', todayStr),
        // Due soon documents per ride (within 30 days)
        supabase
          .from('documents')
          .select('ride_id')
          .in('ride_id', rideIds)
          .eq('user_id', effectiveUserId)
          .not('expires_at', 'is', null)
          .eq('is_latest_version', true)
          .gte('expires_at', todayStr)
          .lte('expires_at', thirtyDaysStr),
        // Overdue inspections per ride
        supabase
          .from('inspection_schedules')
          .select('ride_id')
          .in('ride_id', rideIds)
          .eq('user_id', effectiveUserId)
          .lt('due_date', todayStr)
          .eq('is_active', true),
        // Due soon inspections per ride
        supabase
          .from('inspection_schedules')
          .select('ride_id')
          .in('ride_id', rideIds)
          .eq('user_id', effectiveUserId)
          .gte('due_date', todayStr)
          .lte('due_date', thirtyDaysStr)
          .eq('is_active', true),
      ]);

      // Count docs per ride
      docsResult.data?.forEach(d => {
        if (d.ride_id && stats[d.ride_id]) stats[d.ride_id].docCount++;
      });

      // Count checks per ride
      checksResult.data?.forEach(c => {
        if (c.ride_id && stats[c.ride_id]) stats[c.ride_id].checkCount++;
      });

      // Expired docs count per ride
      expiredDocsResult.data?.forEach(d => {
        if (d.ride_id && stats[d.ride_id]) stats[d.ride_id].expiredDocCount++;
      });

      // Due soon docs count per ride
      dueSoonDocsResult.data?.forEach(d => {
        if (d.ride_id && stats[d.ride_id]) stats[d.ride_id].dueSoonCount++;
      });

      // Overdue inspections count per ride
      overdueInspResult.data?.forEach(i => {
        if (i.ride_id && stats[i.ride_id]) stats[i.ride_id].overdueCount++;
      });

      // Due soon inspections count
      dueSoonInspResult.data?.forEach(i => {
        if (i.ride_id && stats[i.ride_id]) stats[i.ride_id].dueSoonCount++;
      });

      // Find earliest due date per ride
      const allDueDates: Record<string, string[]> = {};
      rideIds.forEach(id => { allDueDates[id] = []; });
      
      maintenanceResult.data?.forEach(m => {
        if (m.ride_id && m.next_maintenance_due) allDueDates[m.ride_id]?.push(m.next_maintenance_due);
      });
      inspectionResult.data?.forEach(i => {
        if (i.ride_id && i.next_inspection_due) allDueDates[i.ride_id]?.push(i.next_inspection_due);
      });
      ndtResult.data?.forEach(n => {
        if (n.ride_id && n.next_inspection_due) allDueDates[n.ride_id]?.push(n.next_inspection_due);
      });

      rideIds.forEach(id => {
        const dates = allDueDates[id]?.sort();
        stats[id].nextDue = dates?.[0] || null;
      });
    } catch (error) {
      console.error('Error loading ride statistics:', error);
    }
    
    setRideStats(stats);
  };

  const loadRidePhotos = async (ridesData: Ride[]) => {
    if (ridesData.length === 0) return;
    
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

      // Rides without photos get null immediately
      const photos: Record<string, string | null> = {};
      rideIds.forEach(id => {
        if (!photoByRide[id]) photos[id] = null;
      });
      setRidePhotos(prev => ({ ...prev, ...photos }));

      // Generate ALL signed URLs in parallel (single batch)
      const ridesWithPhotos = Object.entries(photoByRide);
      if (ridesWithPhotos.length > 0) {
        const filePaths = ridesWithPhotos.map(([, path]) => path);
        const { data: signedUrls } = await supabase.storage
          .from('ride-documents')
          .createSignedUrls(filePaths, 3600);

        const urlPhotos: Record<string, string | null> = {};
        ridesWithPhotos.forEach(([rideId], index) => {
          urlPhotos[rideId] = signedUrls?.[index]?.signedUrl || null;
        });
        setRidePhotos(prev => ({ ...prev, ...urlPhotos }));
      }
    } catch (error) {
      console.error('Error loading ride photos:', error);
      const photos: Record<string, string | null> = {};
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
  const complianceGroups = ['Documents Overdue', 'Inspections Overdue', 'Due Soon', 'Attention', 'Compliant'] as const;

  const getComplianceStatus = (rideId: string): 'stop_use' | 'attention' | 'documents_overdue' | 'inspection_overdue' | 'due_soon' | 'compliant' | 'no_docs' => {
    // Stop-use defects take absolute priority
    const defects = openDefectsMap?.get(rideId);
    if (defects?.critical && defects.critical > 0) return 'stop_use';
    // Any open non-stop defect means attention needed
    if (defects?.nonCritical && defects.nonCritical > 0) return 'attention';

    const s = rideStats[rideId];
    if (!s) return 'compliant';

    // Specific overdue reasons (no generic overdue badge)
    if (s.expiredDocCount > 0) return 'documents_overdue';
    if (s.overdueCount > 0) return 'inspection_overdue';

    if (s.dueSoonCount > 0) return 'due_soon';
    if (s.docCount === 0) return 'no_docs';
    return 'compliant';
  };

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

  const filteredRides = (() => {
    let base = activeGroup === 'All' ? rides : 
      complianceGroups.includes(activeGroup as any)
        ? rides.filter(r => {
            const s = getComplianceStatus(r.id);
            if (activeGroup === 'Documents Overdue') return s === 'documents_overdue';
            if (activeGroup === 'Inspections Overdue') return s === 'inspection_overdue';
            if (activeGroup === 'Due Soon') return s === 'due_soon';
            if (activeGroup === 'Attention') return s === 'attention' || s === 'stop_use';
            if (activeGroup === 'Compliant') return s === 'compliant' || s === 'no_docs';
            return true;
          })
        : rides.filter(r => r.ride_categories.category_group === activeGroup);
    return base;
  })();

  const docsOverdueTotal = rides.filter(r => (rideStats[r.id]?.expiredDocCount ?? 0) > 0).length;
  const inspectionsOverdueTotal = rides.filter(r => (rideStats[r.id]?.overdueCount ?? 0) > 0).length;
  const dueSoonTotal = rides.filter(r => getComplianceStatus(r.id) === 'due_soon').length;
  const attentionTotal = rides.filter(r => ['attention', 'stop_use'].includes(getComplianceStatus(r.id))).length;
  const compliantTotal = rides.filter(r => ['compliant', 'no_docs'].includes(getComplianceStatus(r.id))).length;

  const groupCounts: Record<string, number> = {
    All: rides.length,
    Rides: rides.filter(r => r.ride_categories.category_group === 'Rides').length,
    'Food Stalls': rides.filter(r => r.ride_categories.category_group === 'Food Stalls').length,
    Stalls: rides.filter(r => r.ride_categories.category_group === 'Stalls').length,
    Games: rides.filter(r => r.ride_categories.category_group === 'Games').length,
    Inflatables: rides.filter(r => r.ride_categories.category_group === 'Inflatables').length,
    Attractions: rides.filter(r => r.ride_categories.category_group === 'Attractions').length,
    Equipment: rides.filter(r => r.ride_categories.category_group === 'Equipment').length,
    'Documents Overdue': docsOverdueTotal,
    'Inspections Overdue': inspectionsOverdueTotal,
    'Due Soon': dueSoonTotal,
    Attention: attentionTotal,
    Compliant: compliantTotal,
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={loading}>
    <StaffAccountBanner />
    <TooltipProvider>
    <div className="container mx-auto px-4 py-5 pb-28 md:pb-8 space-y-5">
      {/* Offline staleness alert */}
      <OfflineStaleAlert />

      {/* Item Limit Warning */}
      <ItemLimitWarning />

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="space-y-0.5">
            <h1 className="text-xl font-bold tracking-tight">My Equipment</h1>
            <p className="text-sm text-muted-foreground">{rides.length} {rides.length === 1 ? 'item' : 'items'}</p>
          </div>
          {rides.length > 0 && (
            <EquipmentViewToggle view={viewMode} onViewChange={handleViewChange} />
          )}
        </div>
        {canAddRides && (
          <Button 
            onClick={() => setShowAddForm(true)} 
            className="flex items-center justify-center gap-2 h-10 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Ride or Stall</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}
      </div>

      {/* Compliance KPI Strip */}
      {rides.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <button
            onClick={() => setActiveGroup('Documents Overdue')}
            className={`flex flex-col items-center gap-0.5 p-3 rounded-xl border transition-all ${activeGroup === 'Documents Overdue' ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card hover:border-destructive/30'}`}
          >
            <span className="text-xl font-bold text-destructive">{docsOverdueTotal}</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Docs Overdue</span>
          </button>
          <button
            onClick={() => setActiveGroup('Inspections Overdue')}
            className={`flex flex-col items-center gap-0.5 p-3 rounded-xl border transition-all ${activeGroup === 'Inspections Overdue' ? 'border-warning/50 bg-warning/5' : 'border-border bg-card hover:border-warning/30'}`}
          >
            <span className="text-xl font-bold text-warning">{inspectionsOverdueTotal}</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Insp. Overdue</span>
          </button>
          <button
            onClick={() => setActiveGroup('Due Soon')}
            className={`flex flex-col items-center gap-0.5 p-3 rounded-xl border transition-all ${activeGroup === 'Due Soon' ? 'border-warning/50 bg-warning/5' : 'border-border bg-card hover:border-warning/30'}`}
          >
            <span className="text-xl font-bold text-warning">{dueSoonTotal}</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Due Soon</span>
          </button>
          <button
            onClick={() => setActiveGroup('Attention')}
            className={`flex flex-col items-center gap-0.5 p-3 rounded-xl border transition-all ${activeGroup === 'Attention' ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20' : 'border-border bg-card hover:border-amber-500/30'}`}
          >
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{attentionTotal}</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Attention</span>
          </button>
          <button
            onClick={() => setActiveGroup('Compliant')}
            className={`flex flex-col items-center gap-0.5 p-3 rounded-xl border transition-all ${activeGroup === 'Compliant' ? 'border-success/50 bg-success/5' : 'border-border bg-card hover:border-success/30'}`}
          >
            <span className="text-xl font-bold text-success">{compliantTotal}</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Compliant</span>
          </button>
        </div>
      )}

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
                  {groupCounts[group] ?? 0}
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
      ) : viewMode === 'list' ? (
        <EquipmentListView
          rides={filteredRides as any}
          rideStats={rideStats}
          criticalDefectsMap={criticalDefectsMap}
          openDefectsMap={openDefectsMap}
          onSelectRide={(ride) => navigate(`/rides/${ride.id}`)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRides.map(ride => (
            <Card 
              key={ride.id}
              className="group border-border/60 hover:shadow-elegant hover:border-primary/40 transition-all active:scale-[0.98] cursor-pointer flex flex-col overflow-hidden rounded-2xl"
              onClick={() => navigate(`/rides/${ride.id}`)}
            >
              {/* Photo Thumbnail — taller, with compliance badge overlay */}
              <div className="h-44 sm:h-48 bg-gradient-to-br from-primary/8 to-primary/3 flex items-center justify-center overflow-hidden relative">
                {ridePhotos[ride.id] ? (
                  <>
                    <img 
                      src={ridePhotos[ride.id]!} 
                      alt={ride.ride_name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover transition-opacity duration-500"
                      onLoad={(e) => (e.target as HTMLImageElement).style.opacity = '1'}
                      style={{ opacity: 0 }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    <Badge className="absolute top-3 right-3 bg-background/90 text-foreground border-0 backdrop-blur-sm text-[11px] font-semibold px-2.5 py-1 shadow-sm">
                      {ride.ride_categories.name}
                    </Badge>
                  </>
                ) : ridePhotos[ride.id] === undefined ? (
                  <div className="flex flex-col items-center gap-2 text-primary/30">
                    <div className="w-12 h-12 rounded-2xl bg-primary/8 animate-pulse" />
                  </div>
                ) : uploadingPhotoFor === ride.id ? (
                  <div className="flex flex-col items-center gap-2 text-primary">
                    <Loader2 className="h-7 w-7 animate-spin" />
                    <span className="text-xs font-medium">Uploading...</span>
                  </div>
                ) : (
                  <label 
                    className="flex flex-col items-center gap-3 cursor-pointer hover:bg-primary/5 transition-colors w-full h-full justify-center"
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
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors border-2 border-dashed border-primary/20 group-hover:border-primary/30">
                      <Camera className="h-7 w-7 text-primary/60" />
                    </div>
                    <span className="text-xs text-primary/70 font-medium">Tap to add photo</span>
                  </label>
                )}
                {/* Category badge when no photo */}
                {!ridePhotos[ride.id] && (
                  <Badge className="absolute top-3 right-3 bg-primary/10 text-primary border-primary/20 text-[11px] font-semibold px-2.5 py-1">
                    {ride.ride_categories.name}
                  </Badge>
                )}
                {/* Status badge — bottom left */}
                {(() => {
                  const s = getComplianceStatus(ride.id);
                  const badgeClick = (e: React.MouseEvent, tab: string) => {
                    e.stopPropagation();
                    navigate(`/rides/${ride.id}?tab=${tab}`);
                  };
                  if (s === 'stop_use') return (
                     <button onClick={(e) => { e.stopPropagation(); navigate(`/defects?rideId=${ride.id}&severity=stop_operation`); }} className="absolute bottom-3 left-3 flex items-center gap-1 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-1 rounded-full shadow hover:opacity-90 transition-opacity">
                       <AlertOctagon className="h-2.5 w-2.5" /> Do not operate
                    </button>
                  );
                  if (s === 'documents_overdue') return (
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/rides/${ride.id}?tab=documents&filter=expired`); }} className="absolute bottom-3 left-3 flex items-center gap-1 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-1 rounded-full shadow hover:opacity-90 transition-opacity">
                      <AlertTriangle className="h-2.5 w-2.5" /> Documents overdue
                    </button>
                  );
                  if (s === 'inspection_overdue') return (
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/rides/${ride.id}?tab=checks&checksSubTab=annual&filter=overdue`); }} className="absolute bottom-3 left-3 flex items-center gap-1 bg-warning text-warning-foreground text-[10px] font-bold px-2 py-1 rounded-full shadow hover:opacity-90 transition-opacity">
                      <AlertTriangle className="h-2.5 w-2.5" /> Inspection overdue
                    </button>
                  );
                  if (s === 'attention') return (
                     <button onClick={(e) => { e.stopPropagation(); navigate(`/defects?rideId=${ride.id}`); }} className="absolute bottom-3 left-3 flex items-center gap-1 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow hover:opacity-90 transition-opacity">
                       <AlertTriangle className="h-2.5 w-2.5" /> Attention needed
                    </button>
                  );
                  if (s === 'due_soon') return (
                    <button onClick={(e) => badgeClick(e, 'documents')} className="absolute bottom-3 left-3 flex items-center gap-1 bg-warning text-warning-foreground text-[10px] font-bold px-2 py-1 rounded-full shadow hover:opacity-90 transition-opacity">
                      <Clock className="h-2.5 w-2.5" /> Due Soon
                    </button>
                  );
                  if (s === 'compliant') return (
                    <span className="absolute bottom-3 left-3 flex items-center gap-1 bg-success text-success-foreground text-[10px] font-bold px-2 py-1 rounded-full shadow">
                      <CheckCircle className="h-2.5 w-2.5" /> Compliant
                    </span>
                  );
                  return null;
                })()}
              </div>

              {/* Content section */}
              <div className="flex flex-col flex-1 p-4 gap-3">
                {/* Title + metadata */}
                <div className="space-y-1">
                  <h3 className="font-bold text-[15px] leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {ride.ride_name}
                  </h3>
                  {(ride.manufacturer || ride.year_manufactured) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {[ride.manufacturer, ride.year_manufactured].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                
                {/* Stats row — compact horizontal */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-bold text-primary">{rideStats[ride.id]?.docCount ?? 0}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">docs</span>
                  </div>
                  
                  {hasAdvancedAccess ? (
                    <div 
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-success/5 border border-success/10 cursor-pointer hover:bg-success/10 transition-colors"
                      onClick={e => {
                        e.stopPropagation();
                        navigate(`/rides/${ride.id}?tab=inspections`);
                      }}
                    >
                      <CheckSquare className="h-3.5 w-3.5 text-success" />
                      <span className="text-sm font-bold text-success">{rideStats[ride.id]?.checkCount ?? 0}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">checks</span>
                    </div>
                  ) : (
                    <div 
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted border border-dashed border-primary/15 cursor-pointer hover:border-primary/30 transition-colors"
                      onClick={e => {
                        e.stopPropagation();
                        navigate('/billing');
                      }}
                    >
                      <Lock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-medium">Checks</span>
                    </div>
                  )}
                </div>

                {/* Due Date Alert — inline */}
                {rideStats[ride.id]?.nextDue && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
                    <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
                    <p className="text-xs text-warning font-semibold">
                      Due: {new Date(rideStats[ride.id].nextDue!).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: '2-digit'
                      })}
                    </p>
                  </div>
                )}

                {/* Actions — fixed: separated SendDocumentsDialog from Tooltip to prevent ref issues */}
                <div className="flex gap-2 mt-auto pt-1" onClick={e => e.stopPropagation()}>
                  <Button 
                    onClick={() => navigate(`/rides/${ride.id}`)} 
                    className="flex-1 h-10 rounded-xl font-semibold text-sm"
                  >
                    View Details
                  </Button>
                  <SendDocumentsDialog 
                    ride={ride} 
                    trigger={
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-xl"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    } 
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
    </TooltipProvider>
    </PullToRefresh>
  );
};

export default Rides;
