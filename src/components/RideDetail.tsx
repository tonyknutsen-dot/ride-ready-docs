import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, FileText, CheckSquare, Upload, Settings, Mail, Wrench, Pencil } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import RideDocuments from './RideDocuments';
import InspectionManager from './InspectionManager';
import MaintenanceManager from './MaintenanceManager';
import { SendDocumentsDialog } from './SendDocumentsDialog';
import { FeatureGate } from './FeatureGate';
import { RestrictedFeatureCard } from './RestrictedFeatureCard';
import RideForm from './RideForm';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

interface RideDetailProps {
  ride: Ride;
  onBack: () => void;
  onUpdate: () => void;
}

const RideDetail = ({ ride, onBack, onUpdate }: RideDetailProps) => {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [rideStats, setRideStats] = useState({
    docCount: 0,
    todayChecks: 0,
    maintenanceCount: 0,
    loading: true
  });

  const isAdvanced = subscription?.subscriptionStatus === 'advanced';

  useEffect(() => {
    loadRideStatistics();
  }, [ride.id, user]);

  const loadRideStatistics = async () => {
    if (!user) return;

    try {
      const { count: docCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('ride_id', ride.id);

      const today = new Date().toISOString().split('T')[0];
      const { count: todayChecks } = await supabase
        .from('checks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('ride_id', ride.id)
        .eq('check_date', today);

      const { count: maintenanceCount } = await supabase
        .from('maintenance_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('ride_id', ride.id);

      setRideStats({
        docCount: docCount || 0,
        todayChecks: todayChecks || 0,
        maintenanceCount: maintenanceCount || 0,
        loading: false
      });
    } catch (error) {
      console.error('Error loading ride statistics:', error);
      setRideStats(prev => ({ ...prev, loading: false }));
    }
  };

  const handleEditSuccess = () => {
    setIsEditing(false);
    onUpdate();
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <RideForm 
          ride={ride} 
          onSuccess={handleEditSuccess} 
          onCancel={() => setIsEditing(false)} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Actions */}
      <div className="flex flex-col gap-3">
        <Button variant="outline" onClick={onBack} className="w-fit h-10 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditing(true)} className="flex-1 sm:flex-none h-11 flex items-center justify-center gap-2">
            <Pencil className="h-4 w-4" />
            <span>Edit</span>
          </Button>
          <SendDocumentsDialog 
            ride={ride}
            trigger={
              <Button className="flex-1 sm:flex-none h-11 flex items-center justify-center gap-2">
                <Mail className="h-4 w-4" />
                <span>Send Docs</span>
              </Button>
            }
          />
        </div>
      </div>

      {/* Ride Title */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl md:text-2xl font-bold break-words">{ride.ride_name}</h2>
          <Badge variant="secondary" className="text-xs">{ride.ride_categories.name}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage documentation and safety checks
        </p>
      </div>

      {/* Ride Info Card */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            <span>Equipment Info</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase">Category</span>
              <p className="font-medium">{ride.ride_categories.name}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase">Manufacturer</span>
              <p className="font-medium break-words">{ride.manufacturer || '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase">Year</span>
              <p className="font-medium">{ride.year_manufactured || '—'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase">Serial</span>
              <p className="font-medium break-all">{ride.serial_number || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className={`grid w-full gap-1 p-1 bg-muted/50 h-auto ${isAdvanced ? 'grid-cols-4' : 'grid-cols-2'}`}>
          <TabsTrigger value="overview" className="flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm">
            <FileText className="h-4 w-4" />
            <span className="hidden xs:inline">Home</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm">
            <Upload className="h-4 w-4" />
            <span className="hidden xs:inline">Docs</span>
          </TabsTrigger>
          {isAdvanced && (
            <>
              <TabsTrigger value="inspections" className="flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm">
                <CheckSquare className="h-4 w-4" />
                <span className="hidden xs:inline">Checks</span>
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm">
                <Wrench className="h-4 w-4" />
                <span className="hidden xs:inline">Maint</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Documents Card */}
            <Card className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">Documents</p>
                    <p className="text-2xl font-bold text-primary">
                      {rideStats.loading ? '...' : rideStats.docCount}
                    </p>
                  </div>
                </div>
                <Button onClick={() => setActiveTab("documents")} className="w-full mt-4 h-11">
                  Manage Documents
                </Button>
              </CardContent>
            </Card>

            {/* Maintenance Card */}
            <FeatureGate 
              requiredPlan="advanced" 
              feature="Maintenance Logging"
              fallback={
                <RestrictedFeatureCard
                  title="Maintenance"
                  description="Log maintenance activities"
                  icon={<Wrench className="h-5 w-5" />}
                  requiredPlan="advanced"
                />
              }
            >
              <Card className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                      <Wrench className="h-6 w-6 text-accent-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">Maintenance</p>
                      <p className="text-2xl font-bold text-accent-foreground">
                        {rideStats.loading ? '...' : rideStats.maintenanceCount}
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => setActiveTab("maintenance")} className="w-full mt-4 h-11">
                    Log Maintenance
                  </Button>
                </CardContent>
              </Card>
            </FeatureGate>

            {/* Inspections Card */}
            <FeatureGate 
              requiredPlan="advanced" 
              feature="Inspections"
              fallback={
                <RestrictedFeatureCard
                  title="Inspections"
                  description="Manage inspection checks"
                  icon={<CheckSquare className="h-5 w-5" />}
                  requiredPlan="advanced"
                />
              }
            >
              <Card className="shadow-card sm:col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                      <CheckSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">Today's Checks</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {rideStats.loading ? '...' : rideStats.todayChecks}
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => setActiveTab("inspections")} variant="outline" className="w-full mt-4 h-11">
                    Start Inspection
                  </Button>
                </CardContent>
              </Card>
            </FeatureGate>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <RideDocuments ride={ride} />
        </TabsContent>

        <TabsContent value="inspections">
          <FeatureGate requiredPlan="advanced" feature="Inspections">
            <InspectionManager ride={ride} />
          </FeatureGate>
        </TabsContent>

        <TabsContent value="maintenance">
          <FeatureGate requiredPlan="advanced" feature="Maintenance Logging">
            <MaintenanceManager ride={ride} />
          </FeatureGate>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RideDetail;
