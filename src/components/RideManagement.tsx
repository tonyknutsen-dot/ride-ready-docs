import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Settings, FileText, CheckSquare, Calendar, Mail, HelpCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import RideForm from './RideForm';
import RideDetail from './RideDetail';
import { SendDocumentsDialog } from './SendDocumentsDialog';
import { RequestRideTypeDialog } from './RequestRideTypeDialog';

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
  const [rideStats, setRideStats] = useState<Record<string, { docCount: number; checkCount: number; nextDue: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);

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
        // Load statistics for each ride
        await loadRideStatistics(data as Ride[]);
      }
    } catch (error) {
      console.error('Error loading rides:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRideStatistics = async (ridesData: Ride[]) => {
    const stats: Record<string, { docCount: number; checkCount: number; nextDue: string | null }> = {};
    
    for (const ride of ridesData) {
      try {
        // Get document count for this ride
        const { count: docCount } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user?.id)
          .eq('ride_id', ride.id);

        // Get daily check count for this ride
        const { count: checkCount } = await supabase
          .from('inspection_checks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user?.id)
          .eq('ride_id', ride.id);

        // Get next due date from various sources
        const [maintenanceQuery, inspectionQuery, ndtQuery] = await Promise.all([
          supabase
            .from('maintenance_records')
            .select('next_maintenance_due')
            .eq('user_id', user?.id)
            .eq('ride_id', ride.id)
            .not('next_maintenance_due', 'is', null)
            .order('next_maintenance_due', { ascending: true })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('annual_inspection_reports')
            .select('next_inspection_due')
            .eq('user_id', user?.id)
            .eq('ride_id', ride.id)
            .not('next_inspection_due', 'is', null)
            .order('next_inspection_due', { ascending: true })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('ndt_reports')
            .select('next_inspection_due')
            .eq('user_id', user?.id)
            .eq('ride_id', ride.id)
            .not('next_inspection_due', 'is', null)
            .order('next_inspection_due', { ascending: true })
            .limit(1)
            .maybeSingle()
        ]);

        // Find the earliest due date
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
      {/* Mobile-friendly header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">My Rides & Stalls</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage your rides, food stalls, games, and equipment
            </p>
          </div>
          
          {/* Mobile: Full-width buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setShowRequestDialog(true)}
              className="flex items-center justify-center space-x-2 w-full sm:w-auto"
            >
              <HelpCircle className="h-4 w-4" />
              <span>Request New Type</span>
            </Button>
            <Button 
              onClick={() => setShowAddForm(true)} 
              className="flex items-center justify-center space-x-2 w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              <span>Add Ride/Stall</span>
            </Button>
          </div>
        </div>
        
        {/* Mobile: Quick stats if rides exist */}
        {rides.length > 0 && (
          <div className="block sm:hidden bg-muted/50 rounded-lg p-3">
            <div className="text-center">
              <div className="text-lg font-semibold text-primary">{rides.length}</div>
              <div className="text-xs text-muted-foreground">Total Items</div>
            </div>
          </div>
        )}
      </div>

      {rides.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Settings className="mx-auto h-16 w-16 text-muted-foreground" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">No rides, stalls, or equipment added yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Start by adding your first ride, food stall, game, or equipment to begin managing documentation and daily checks.
                </p>
              </div>
              <Button onClick={() => setShowAddForm(true)} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Add Your First Item</span>
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
                      <p className="text-xs mt-1">
                        {rideStats[ride.id]?.docCount ?? 0} Docs
                      </p>
                    </div>
                    <div className="p-2 rounded bg-muted">
                      <CheckSquare className="h-4 w-4 mx-auto text-accent" />
                      <p className="text-xs mt-1">
                        {rideStats[ride.id]?.checkCount ?? 0} Checks
                      </p>
                    </div>
                    <div className="p-2 rounded bg-muted">
                      <Calendar className="h-4 w-4 mx-auto text-secondary-foreground" />
                      <p className="text-xs mt-1">
                        {rideStats[ride.id]?.nextDue 
                          ? new Date(rideStats[ride.id].nextDue!).toLocaleDateString('en-GB', { 
                              day: '2-digit', 
                              month: 'short' 
                            })
                          : 'No Due'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setSelectedRide(ride)}
                      className="flex-1"
                      variant="outline"
                    >
                      Manage
                    </Button>
                    <SendDocumentsDialog 
                      ride={ride} 
                      trigger={
                        <Button variant="outline" size="sm">
                          <Mail className="h-4 w-4" />
                        </Button>
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RequestRideTypeDialog 
        open={showRequestDialog} 
        onOpenChange={setShowRequestDialog} 
      />
    </div>
  );
};

export default RideManagement;