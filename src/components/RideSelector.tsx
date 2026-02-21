import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Plus, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { RequestRideTypeDialog } from '@/components/RequestRideTypeDialog';
import { EmptyState } from '@/components/EmptyState';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
import { OfflineDataPlaceholder } from '@/components/OfflineDataPlaceholder';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

interface RideSelectorProps {
  title: string;
  description: string;
  actionLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  onRideSelect: (ride: Ride) => void;
  showAddRide?: boolean;
  onAddRide?: () => void;
}

const RideSelector = ({ 
  title, 
  description, 
  actionLabel, 
  icon: Icon, 
  onRideSelect,
  showAddRide = false,
  onAddRide
}: RideSelectorProps) => {
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();
  const { isOnline } = useOnlineStatus();
  const [openRequest, setOpenRequest] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const getTileClasses = (categoryName: string) => {
    if (/generator/i.test(categoryName)) return "border-2 border-warning/50 bg-gradient-to-br from-warning/10 to-warning/5";
    if (/inflatable/i.test(categoryName)) return "border-2 border-info/50 bg-gradient-to-br from-info/10 to-info/5";
    if (/food|stall/i.test(categoryName)) return "border-2 border-accent/50 bg-gradient-to-br from-accent/10 to-accent/5";
    return "border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent";
  };

  // Use offline-capable query for rides list
  const { data: rides = [], isLoading: loading, isOfflineData } = useOfflineQuery<Ride[]>({
    queryKey: ['rides-selector', effectiveUserId, isStaff],
    queryFn: async () => {
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
        .order('ride_name');

      if (!isStaff) {
        query = query.eq('user_id', effectiveUserId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Ride[];
    },
    enabled: !!user && !!effectiveUserId,
    staleTime: 1000 * 60 * 2,
    offlineCacheKey: `rides-selector:${effectiveUserId}`,
  });

  // Load thumbnails when rides data is available and online
  useEffect(() => {
    if (rides.length > 0 && isOnline && effectiveUserId) {
      loadThumbnails(rides);
    }
  }, [rides, isOnline, effectiveUserId]);

  const loadThumbnails = async (ridesList: Ride[]) => {
    try {
      const { data: docs, error } = await supabase
        .from('documents')
        .select('id, file_path, ride_id')
        .in('ride_id', ridesList.map(r => r.id))
        .eq('user_id', effectiveUserId)
        .eq('document_type', 'photo')
        .order('uploaded_at', { ascending: false });

      if (error || !docs?.length) return;

      const photosByRide = new Map<string, string>();
      for (const doc of docs) {
        if (doc.ride_id && !photosByRide.has(doc.ride_id)) {
          photosByRide.set(doc.ride_id, doc.file_path);
        }
      }

      if (photosByRide.size === 0) return;

      const urlPromises = Array.from(photosByRide.entries()).map(async ([rideId, filePath]) => {
        const { data: urlData } = await supabase.storage
          .from('ride-documents')
          .createSignedUrl(filePath, 3600);
        return { rideId, url: urlData?.signedUrl };
      });

      const results = await Promise.all(urlPromises);
      const next: Record<string, string> = {};
      for (const { rideId, url } of results) {
        if (url) next[rideId] = url;
      }
      setThumbs(next);
    } catch (e) {
      console.warn('Thumb load skipped:', e);
    }
  };

  // Offline with no cached data
  if (!isOnline && rides.length === 0 && !loading) {
    return <OfflineDataPlaceholder message="Open this page once online to make equipment available offline." />;
  }

  if (loading) {
    return (
      <div className="space-y-5">
        {/* Header skeleton */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-muted animate-pulse mx-auto" />
          <div className="h-6 w-40 bg-muted rounded animate-pulse mx-auto" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse mx-auto" />
        </div>
        {/* Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-2 border-muted rounded-xl animate-pulse">
              <div className="w-full h-24 bg-muted rounded-t-xl" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-11 w-full bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto shadow-md">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {description}
        </p>
      </div>

      {/* Content */}
      {rides.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nothing here yet"
          description="Press Add ride or Add generator to get started"
          actionLabel={showAddRide && onAddRide ? "Add Your First Item" : undefined}
          onAction={showAddRide && onAddRide ? onAddRide : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rides.map((ride) => (
            <Card 
              key={ride.id} 
              className={`shadow-card hover:shadow-elegant active:scale-[0.98] transition-all cursor-pointer ${getTileClasses(ride.ride_categories.name)}`}
              onClick={() => onRideSelect(ride)}
            >
              {thumbs[ride.id] ? (
                <img
                  src={thumbs[ride.id]}
                  alt={`${ride.ride_name} photo`}
                  className="w-full h-40 rounded-t-xl object-cover"
                />
              ) : (
                <div className="w-full h-24 rounded-t-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                  <Icon className="h-10 w-10 text-primary/40" />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex flex-col gap-1.5">
                  <CardTitle className="text-base leading-tight min-w-0 break-words line-clamp-2">
                    {ride.ride_name}
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30 w-fit font-medium truncate max-w-full">
                    {ride.ride_categories.name}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0 space-y-3">
                {(ride.manufacturer || ride.year_manufactured) && (
                  <div className="text-xs text-muted-foreground space-y-0.5 p-2 rounded bg-secondary/30">
                    {ride.manufacturer && <div className="truncate"><span className="font-medium">Make:</span> {ride.manufacturer}</div>}
                    {ride.year_manufactured && <div><span className="font-medium">Year:</span> {ride.year_manufactured}</div>}
                  </div>
                )}
                
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onRideSelect(ride);
                  }}
                  className="w-full h-11 bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 shadow-sm text-xs sm:text-sm"
                >
                  <Icon className="h-4 w-4 mr-2 shrink-0" />
                  <span className="truncate">{actionLabel}</span>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <RequestRideTypeDialog open={openRequest} onOpenChange={setOpenRequest} />
    </div>
  );
};

export default RideSelector;
