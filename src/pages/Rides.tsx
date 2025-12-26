import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Settings, FileText, CheckSquare, Mail, Lock, Gamepad2, Utensils, Zap, FerrisWheel } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import RideForm from '@/components/RideForm';
import { SendDocumentsDialog } from '@/components/SendDocumentsDialog';

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
  const { subscription } = useSubscription();
  const [rides, setRides] = useState<Ride[]>([]);
  const [rideStats, setRideStats] = useState<Record<string, {
    docCount: number;
    checkCount: number;
    nextDue: string | null;
  }>>({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>('All');

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
            description,
            category_group
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

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
        const { count: docCount } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user?.id)
          .eq('ride_id', ride.id);
        
        const { count: checkCount } = await supabase
          .from('checks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user?.id)
          .eq('ride_id', ride.id);
        
        const [maintenanceQuery, inspectionQuery, ndtQuery] = await Promise.all([
          supabase.from('maintenance_records').select('next_maintenance_due').eq('user_id', user?.id).eq('ride_id', ride.id).not('next_maintenance_due', 'is', null).order('next_maintenance_due', { ascending: true }).limit(1).maybeSingle(),
          supabase.from('annual_inspection_reports').select('next_inspection_due').eq('user_id', user?.id).eq('ride_id', ride.id).not('next_inspection_due', 'is', null).order('next_inspection_due', { ascending: true }).limit(1).maybeSingle(),
          supabase.from('ndt_reports').select('next_inspection_due').eq('user_id', user?.id).eq('ride_id', ride.id).not('next_inspection_due', 'is', null).order('next_inspection_due', { ascending: true }).limit(1).maybeSingle()
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

  const handleRideAdded = () => {
    setShowAddForm(false);
    loadRides();
    toast({
      title: "Equipment added successfully",
      description: "Your new equipment has been added."
    });
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
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Settings className="mx-auto h-10 w-10 text-primary animate-spin" />
            <p className="text-muted-foreground text-sm">Loading your equipment...</p>
          </div>
        </div>
      </div>
    );
  }

  const categoryGroups = ['All', 'Rides', 'Food Stalls', 'Games', 'Equipment'] as const;

  const getCategoryIcon = (group: string) => {
    switch (group) {
      case 'Rides': return <FerrisWheel className="h-4 w-4" />;
      case 'Food Stalls': return <Utensils className="h-4 w-4" />;
      case 'Games': return <Gamepad2 className="h-4 w-4" />;
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
    Games: rides.filter(r => r.ride_categories.category_group === 'Games').length,
    Equipment: rides.filter(r => r.ride_categories.category_group === 'Equipment').length,
  };

  return (
    <div className="container mx-auto px-4 py-5 pb-28 md:pb-8 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Equipment</h1>
          <p className="text-sm text-muted-foreground">Manage your rides, stalls, and equipment</p>
        </div>
        
        <Button 
          onClick={() => setShowAddForm(true)} 
          className="w-full sm:w-auto flex items-center justify-center gap-2 h-12 sm:h-10"
        >
          <Plus className="h-5 w-5" />
          <span>Add Ride or Stall</span>
        </Button>
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
        <Card className="shadow-card">
          <CardContent className="py-8">
            <div className="text-center space-y-2">
              {getCategoryIcon(activeGroup)}
              <p className="text-sm text-muted-foreground">No {activeGroup.toLowerCase()} found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRides.map(ride => (
            <Card 
              key={ride.id}
              className="shadow-card hover:shadow-elegant transition-all active:scale-[0.98] cursor-pointer flex flex-col"
              onClick={() => navigate(`/rides/${ride.id}`)}
            >
              <CardHeader className="pb-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base leading-tight flex-1 break-words line-clamp-2">
                    {ride.ride_name}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs px-2 py-1 bg-primary/10 text-primary border-primary/20 shrink-0 whitespace-nowrap">
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
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <FileText className="h-4 w-4 mx-auto text-primary mb-1" />
                    <p className="text-lg font-semibold">{rideStats[ride.id]?.docCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Documents</p>
                  </div>
                  
                  {subscription?.subscriptionStatus === 'advanced' ? (
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <CheckSquare className="h-4 w-4 mx-auto text-accent mb-1" />
                      <p className="text-lg font-semibold">{rideStats[ride.id]?.checkCount ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Checks</p>
                    </div>
                  ) : (
                    <div 
                      className="p-3 rounded-lg bg-muted/30 text-center border border-dashed border-muted-foreground/30 relative"
                      onClick={e => {
                        e.stopPropagation();
                        navigate('/billing');
                      }}
                    >
                      <Lock className="h-3 w-3 absolute top-2 right-2 text-muted-foreground/50" />
                      <CheckSquare className="h-4 w-4 mx-auto text-muted-foreground/40 mb-1" />
                      <p className="text-lg font-semibold text-muted-foreground/60">—</p>
                      <p className="text-xs text-muted-foreground/70">Checks</p>
                    </div>
                  )}
                </div>

                {/* Due Date Alert */}
                {rideStats[ride.id]?.nextDue && (
                  <div className="text-center p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
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
  );
};

export default Rides;
