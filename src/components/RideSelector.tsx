import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { RequestRideTypeDialog } from '@/components/RequestRideTypeDialog';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
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
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRequest, setOpenRequest] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const getTileClasses = (categoryName: string) => {
    if (/generator/i.test(categoryName)) return "border-amber-400 bg-amber-50 dark:bg-amber-950/20";
    return "border-border bg-card";
  };

  useEffect(() => {
    if (user) {
      loadRides();
    }
  }, [user]);

  const loadRides = async () => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select(`
          *,
          ride_categories (
            name,
            description
          )
        `)
        .eq('user_id', user?.id)
        .order('ride_name');

      if (error) throw error;
      setRides(data as Ride[]);

      if (Array.isArray(data) && data.length) {
        try {
          const next: Record<string, string> = {};
          await Promise.all(
            data.map(async (ride: Ride) => {
              const { data: docs, error } = await supabase
                .from('documents')
                .select('id,file_path,document_type')
                .eq('ride_id', ride.id)
                .eq('document_type', 'photo')
                .order('uploaded_at', { ascending: false })
                .limit(1);

              if (!error && docs && docs[0]?.file_path) {
                const { data: urlData, error: urlErr } = await supabase
                  .storage
                  .from('ride-documents')
                  .createSignedUrl(docs[0].file_path, 3600);
                if (!urlErr && urlData?.signedUrl) {
                  next[ride.id] = urlData.signedUrl;
                }
              }
            })
          );
          setThumbs(next);
        } catch (e) {
          console.warn('Thumb load skipped:', e);
        }
      }
    } catch (error) {
      console.error('Error loading rides:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <Settings className="mx-auto h-10 w-10 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your rides...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {description}
        </p>
      </div>

      {/* Content */}
      {rides.length === 0 ? (
        <Card className="max-w-sm mx-auto shadow-card">
          <CardContent className="py-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Settings className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Nothing here yet</h3>
              <p className="text-sm text-muted-foreground">
                Press Add ride or Add generator to get started
              </p>
            </div>
            {showAddRide && onAddRide && (
              <div className="space-y-2">
                <Button id="rrd-btn-add-ride" onClick={onAddRide} className="h-11 w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  <span>Add Your First Item</span>
                </Button>
                <p className="text-xs text-muted-foreground">
                  Don't see your category?{' '}
                  <button onClick={() => setOpenRequest(true)} className="text-primary underline">
                    Request category
                  </button>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rides.map((ride) => (
            <Card 
              key={ride.id} 
              className={`shadow-card hover:shadow-elegant active:scale-[0.98] transition-all cursor-pointer border ${getTileClasses(ride.ride_categories.name)}`}
              onClick={() => onRideSelect(ride)}
            >
              {thumbs[ride.id] && (
                <img
                  src={thumbs[ride.id]}
                  alt={`${ride.ride_name} photo`}
                  className="w-full h-32 rounded-t-xl object-cover"
                />
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight flex-1 min-w-0 break-words">
                    {ride.ride_name}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/20 shrink-0">
                    {ride.ride_categories.name}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0 space-y-3">
                {(ride.manufacturer || ride.year_manufactured) && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {ride.manufacturer && <div className="truncate">Make: {ride.manufacturer}</div>}
                    {ride.year_manufactured && <div>Year: {ride.year_manufactured}</div>}
                  </div>
                )}
                
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onRideSelect(ride);
                  }}
                  className="w-full h-11"
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {actionLabel}
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
