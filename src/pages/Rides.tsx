import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Settings, FileText, CheckSquare, Mail, HelpCircle, Lock } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import RideForm from '@/components/RideForm';
import { SendDocumentsDialog } from '@/components/SendDocumentsDialog';
import { RequestRideTypeDialog } from '@/components/RequestRideTypeDialog';
type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};
const Rides = () => {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const { subscription } = useSubscription();
  const [rides, setRides] = useState<Ride[]>([]);
  const [rideStats, setRideStats] = useState<Record<string, {
    docCount: number;
    checkCount: number;
    nextDue: string | null;
  }>>({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  useEffect(() => {
    if (user) {
      loadRides();
    }
  }, [user]);
  const loadRides = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('rides').select(`
          *,
          ride_categories (
            name,
            description
          )
        `).eq('user_id', user?.id).order('created_at', {
        ascending: false
      });
      if (error) {
        console.error('Error loading rides:', error);
        toast({
          title: "Error loading rides",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setRides(data as Ride[]);
        await loadRideStatistics(data as Ride[]);
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
        const {
          count: docCount
        } = await supabase.from('documents').select('*', {
          count: 'exact',
          head: true
        }).eq('user_id', user?.id).eq('ride_id', ride.id);
        const {
          count: checkCount
        } = await supabase.from('inspection_checks').select('*', {
          count: 'exact',
          head: true
        }).eq('user_id', user?.id).eq('ride_id', ride.id);
        const [maintenanceQuery, inspectionQuery, ndtQuery] = await Promise.all([supabase.from('maintenance_records').select('next_maintenance_due').eq('user_id', user?.id).eq('ride_id', ride.id).not('next_maintenance_due', 'is', null).order('next_maintenance_due', {
          ascending: true
        }).limit(1).maybeSingle(), supabase.from('annual_inspection_reports').select('next_inspection_due').eq('user_id', user?.id).eq('ride_id', ride.id).not('next_inspection_due', 'is', null).order('next_inspection_due', {
          ascending: true
        }).limit(1).maybeSingle(), supabase.from('ndt_reports').select('next_inspection_due').eq('user_id', user?.id).eq('ride_id', ride.id).not('next_inspection_due', 'is', null).order('next_inspection_due', {
          ascending: true
        }).limit(1).maybeSingle()]);
        const dueDates = [maintenanceQuery.data?.next_maintenance_due, inspectionQuery.data?.next_inspection_due, ndtQuery.data?.next_inspection_due].filter(Boolean).sort();
        stats[ride.id] = {
          docCount: docCount || 0,
          checkCount: checkCount || 0,
          nextDue: dueDates[0] || null
        };
      } catch (error) {
        console.error(`Error loading stats for ride ${ride.id}:`, error);
        stats[ride.id] = {
          docCount: 0,
          checkCount: 0,
          nextDue: null
        };
      }
    }
    setRideStats(stats);
  };
  const handleRideAdded = () => {
    setShowAddForm(false);
    loadRides();
    toast({
      title: "Equipment added successfully",
      description: "Your new equipment has been added."
    });
  };
  if (showAddForm) {
    return <div className="container mx-auto py-6">
        <RideForm onSuccess={handleRideAdded} onCancel={() => setShowAddForm(false)} />
      </div>;
  }
  if (loading) {
    return <div className="container mx-auto py-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Settings className="mx-auto h-12 w-12 text-primary animate-spin" />
            <p className="text-muted-foreground">Loading your equipment...</p>
          </div>
        </div>
      </div>;
  }
  return <div className="container mx-auto py-6 pb-24 md:pb-6 space-y-6">
      <Alert>
        <AlertDescription>
          Add and manage your rides, stalls, and equipment. Click on any item to view details and manage documents or checks.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">My Equipment</h1>
          <p className="text-muted-foreground">Manage your rides, stalls, and equipment</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setShowRequestDialog(true)} className="flex items-center justify-center gap-2">
            <HelpCircle className="h-4 w-4" />
            <span>Request Category</span>
          </Button>
          <Button onClick={() => setShowAddForm(true)} className="flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            <span>Add Equipment</span>
          </Button>
        </div>
      </div>

      {rides.length === 0 ? <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Settings className="mx-auto h-16 w-16 text-muted-foreground" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">No equipment added yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Start by adding your first ride, food stall, game, or equipment using the button above.
                </p>
              </div>
            </div>
          </CardContent>
        </Card> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rides.map(ride => <Card key={ride.id} className="hover:shadow-md transition-all cursor-pointer flex flex-col min-h-[280px]" onClick={() => navigate(`/rides/${ride.id}`)}>
              <CardHeader className="pb-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg leading-tight flex-1 break-words line-clamp-2">
                    {ride.ride_name}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs px-2 py-1 bg-primary/10 text-primary border-primary/20 shrink-0 whitespace-nowrap">
                    {ride.ride_categories.name}
                  </Badge>
                </div>
                
                {(ride.manufacturer || ride.year_manufactured) && <div className="text-xs text-muted-foreground space-y-1">
                    {ride.manufacturer && <div className="truncate">Make: {ride.manufacturer}</div>}
                    {ride.year_manufactured && <div>Year: {ride.year_manufactured}</div>}
                  </div>}
              </CardHeader>
              
              <CardContent className="flex-1 flex flex-col gap-3 pt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-md bg-muted/50 text-center">
                    <FileText className="h-4 w-4 mx-auto text-primary mb-1.5" />
                    <p className="text-sm font-medium">
                      {rideStats[ride.id]?.docCount ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Documents</p>
                  </div>
                  {subscription?.subscriptionStatus === 'advanced' ? (
                    <div className="p-3 rounded-md bg-muted/50 text-center">
                      <CheckSquare className="h-4 w-4 mx-auto text-accent mb-1.5" />
                      <p className="text-sm font-medium">
                        {rideStats[ride.id]?.checkCount ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Checks</p>
                    </div>
                  ) : (
                    <div 
                      className="p-3 rounded-md bg-muted/30 text-center border border-dashed border-muted-foreground/30 relative cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/billing');
                      }}
                    >
                      <Lock className="h-3 w-3 absolute top-2 right-2 text-muted-foreground/50" />
                      <CheckSquare className="h-4 w-4 mx-auto text-muted-foreground/40 mb-1.5" />
                      <p className="text-sm font-medium text-muted-foreground/60">-</p>
                      <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">
                        Checks
                      </p>
                      <p className="text-[9px] text-primary/60 font-medium mt-1">
                        Operations Plan
                      </p>
                    </div>
                  )}
                </div>

                {rideStats[ride.id]?.nextDue && <div className="text-center p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      Due: {new Date(rideStats[ride.id].nextDue!).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: '2-digit'
              })}
                    </p>
                  </div>}

                <div className="flex gap-2 mt-auto">
                  <Button onClick={e => {
              e.stopPropagation();
              navigate(`/rides/${ride.id}`);
            }} className="flex-1 font-medium" variant="default" size="default">
                    View Details
                  </Button>
                  <SendDocumentsDialog ride={ride} trigger={<Button variant="outline" size="default" className="px-3" onClick={e => e.stopPropagation()}>
                        <Mail className="h-4 w-4" />
                      </Button>} />
                </div>
              </CardContent>
            </Card>)}
        </div>}

      <RequestRideTypeDialog open={showRequestDialog} onOpenChange={setShowRequestDialog} />
    </div>;
};
export default Rides;