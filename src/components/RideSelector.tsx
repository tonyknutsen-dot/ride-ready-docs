import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, FileText, Wrench, Calendar, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

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
          <Settings className="mx-auto h-12 w-12 text-primary animate-spin" />
          <p className="text-muted-foreground">Loading your rides...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center space-x-2">
          <Icon className="h-8 w-8 text-primary" />
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {description}
        </p>
      </div>

      {rides.length === 0 ? (
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center space-y-4">
            <Settings className="mx-auto h-16 w-16 text-muted-foreground" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">No rides added yet</h3>
              <p className="text-sm text-muted-foreground">
                You need to add at least one ride, stall, or equipment before you can {actionLabel.toLowerCase()}
              </p>
            </div>
            {showAddRide && onAddRide && (
              <Button onClick={onAddRide} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Add Your First Item</span>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {rides.map((ride) => (
            <Card 
              key={ride.id} 
              className="hover:shadow-md transition-all cursor-pointer border-muted/50 hover:border-primary/20"
              onClick={() => onRideSelect(ride)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight flex-1 min-w-0">
                    {ride.ride_name}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/20 flex-shrink-0">
                    {ride.ride_categories.name}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {(ride.manufacturer || ride.year_manufactured) && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {ride.manufacturer && (
                        <div>Make: {ride.manufacturer}</div>
                      )}
                      {ride.year_manufactured && (
                        <div>Year: {ride.year_manufactured}</div>
                      )}
                    </div>
                  )}
                  
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onRideSelect(ride);
                    }}
                    className="w-full"
                    size="sm"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {actionLabel}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RideSelector;