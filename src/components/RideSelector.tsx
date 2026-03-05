import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ChevronRight, Sparkles, Filter } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredRides = rides.filter(ride =>
    ride.ride_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Offline with no cached data
  if (!isOnline && rides.length === 0 && !loading) {
    return <OfflineDataPlaceholder message="Open this page once online to make equipment available offline." />;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted rounded-lg animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      {rides.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search equipment…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      )}

      {/* Equipment List */}
      {rides.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nothing here yet"
          description="Press Add ride or Add generator to get started"
          actionLabel={showAddRide && onAddRide ? "Add Your First Item" : undefined}
          onAction={showAddRide && onAddRide ? onAddRide : undefined}
        />
      ) : filteredRides.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Filter className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
          <p className="text-sm">No equipment matches your search.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRides.map((ride) => {
            const hasThumb = !!thumbs[ride.id];

            return (
              <button
                key={ride.id}
                type="button"
                onClick={() => onRideSelect(ride)}
                className="w-full text-left rounded-lg border border-border border-l-4 border-l-primary/30 bg-card hover:bg-accent/30 active:bg-accent/50 active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Thumbnail or compact icon */}
                  {hasThumb ? (
                    <img
                      src={thumbs[ride.id]}
                      alt={ride.ride_name}
                      className="w-14 h-14 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{ride.ride_name}</p>
                    <p className="text-[10px] text-muted-foreground">{ride.ride_categories.name}</p>
                    {(ride.manufacturer || ride.year_manufactured) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {ride.manufacturer && <span>{ride.manufacturer}</span>}
                        {ride.manufacturer && ride.year_manufactured && <span> · </span>}
                        {ride.year_manufactured && <span>{ride.year_manufactured}</span>}
                      </p>
                    )}
                  </div>

                  {/* Chevron */}
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      )}
      
      <RequestRideTypeDialog open={openRequest} onOpenChange={setOpenRequest} />
    </div>
  );
};

export default RideSelector;
