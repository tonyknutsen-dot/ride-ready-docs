import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
      <Alert>
        <AlertDescription>
          Add and manage your rides, stalls, and equipment. Track documents and certificates for each item. Use the action buttons to view details, send documents, or manage settings.
        </AlertDescription>
      </Alert>
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
              id="rrd-btn-add-ride"
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
                  Start by adding your first ride, food stall, game, or equipment using the "Add Ride/Stall" button above.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {rides.map((ride) => (
            <Card key={ride.id} className="hover:shadow-md transition-all cursor-pointer border-muted/50">
              <CardHeader className="pb-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base sm:text-lg leading-tight flex-1 min-w-0 break-words line-clamp-2">
                    {ride.ride_name}
                  </CardTitle>
                  <Badge 
                    variant="outline" 
                    className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-primary/10 text-primary border-primary/20 flex-shrink-0 whitespace-nowrap"
                  >
                    {ride.ride_categories.name}
                  </Badge>
                </div>
                
                {/* Simplified details for mobile */}
                {(ride.manufacturer || ride.year_manufactured) && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {ride.manufacturer && (
                      <div className="truncate">Make: {ride.manufacturer}</div>
                    )}
                    {ride.year_manufactured && (
                      <div>Year: {ride.year_manufactured}</div>
                    )}
                  </div>
                )}
              </CardHeader>
              
              <CardContent className="pt-0 space-y-3">
                {/* Clean 2-column stats for mobile */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-md bg-muted/50 text-center">
                    <FileText className="h-3 w-3 sm:h-4 sm:w-4 mx-auto text-primary mb-1" />
                    <p className="text-xs sm:text-sm font-medium">
                      {rideStats[ride.id]?.docCount ?? 0}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Documents</p>
                  </div>
                  <div className="p-2 rounded-md bg-muted/50 text-center">
                    <CheckSquare className="h-3 w-3 sm:h-4 sm:w-4 mx-auto text-accent mb-1" />
                    <p className="text-xs sm:text-sm font-medium">
                      {rideStats[ride.id]?.checkCount ?? 0}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Checks</p>
                  </div>
                </div>

                {/* Next due - if exists */}
                {rideStats[ride.id]?.nextDue && (
                  <div className="text-center p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      Due: {new Date(rideStats[ride.id].nextDue!).toLocaleDateString('en-GB', { 
                        day: '2-digit', 
                        month: 'short',
                        year: '2-digit'
                      })}
                    </p>
                  </div>
                )}

                {/* Simplified action buttons */}
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setSelectedRide(ride)}
                    className="flex-1 text-xs sm:text-sm"
                    variant="outline"
                    size="sm"
                  >
                    Manage
                  </Button>
                  <SendDocumentsDialog 
                    ride={ride} 
                    trigger={
                      <Button variant="ghost" size="sm" className="px-2">
                        <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    }
                  />
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