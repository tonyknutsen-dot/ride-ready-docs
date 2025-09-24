import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Settings, FileText, CheckSquare, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import RideForm from './RideForm';
import RideDetail from './RideDetail';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

const RideManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);

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
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading rides:', error);
        toast({
          title: "Error loading rides",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setRides(data as Ride[]);
      }
    } catch (error) {
      console.error('Error loading rides:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRideAdded = () => {
    setShowAddForm(false);
    loadRides();
    toast({
      title: "Ride added successfully",
      description: "Your new ride has been added to your inventory.",
    });
  };

  if (selectedRide) {
    return (
      <RideDetail 
        ride={selectedRide} 
        onBack={() => setSelectedRide(null)}
        onUpdate={loadRides}
      />
    );
  }

  if (showAddForm) {
    return (
      <RideForm 
        onSuccess={handleRideAdded}
        onCancel={() => setShowAddForm(false)}
      />
    );
  }

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
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">My Rides</h2>
          <p className="text-muted-foreground">
            Manage your ride inventory and documentation
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Add New Ride</span>
        </Button>
      </div>

      {rides.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Settings className="mx-auto h-16 w-16 text-muted-foreground" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">No rides added yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Start by adding your first ride to begin managing documentation and daily checks.
                </p>
              </div>
              <Button onClick={() => setShowAddForm(true)} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Add Your First Ride</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rides.map((ride) => (
            <Card key={ride.id} className="hover:shadow-elegant transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{ride.ride_name}</CardTitle>
                  <Badge variant="secondary">{ride.ride_categories.name}</Badge>
                </div>
                <CardDescription>
                  {ride.manufacturer && (
                    <span className="block">Manufacturer: {ride.manufacturer}</span>
                  )}
                  {ride.year_manufactured && (
                    <span className="block">Year: {ride.year_manufactured}</span>
                  )}
                  {ride.serial_number && (
                    <span className="block text-xs text-muted-foreground">
                      Serial: {ride.serial_number}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded bg-muted">
                      <FileText className="h-4 w-4 mx-auto text-primary" />
                      <p className="text-xs mt-1">0 Docs</p>
                    </div>
                    <div className="p-2 rounded bg-muted">
                      <CheckSquare className="h-4 w-4 mx-auto text-accent" />
                      <p className="text-xs mt-1">0 Checks</p>
                    </div>
                    <div className="p-2 rounded bg-muted">
                      <Calendar className="h-4 w-4 mx-auto text-secondary-foreground" />
                      <p className="text-xs mt-1">No Due</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setSelectedRide(ride)}
                    className="w-full"
                    variant="outline"
                  >
                    Manage Ride
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

export default RideManagement;