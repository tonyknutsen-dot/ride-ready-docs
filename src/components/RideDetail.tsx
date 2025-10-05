import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, FileText, CheckSquare, Calendar, Upload, Settings, AlertTriangle, Mail, Wrench, Pencil } from 'lucide-react';
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
    bulletinCount: 0,
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
      // Get document count for this ride
      const { count: docCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('ride_id', ride.id);

      // Get today's inspection checks count
      const today = new Date().toISOString().split('T')[0];
      const { count: todayChecks } = await supabase
        .from('inspection_checks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('ride_id', ride.id)
        .eq('check_date', today);

      // Get technical bulletins count for this ride category
      const { count: bulletinCount } = await supabase
        .from('technical_bulletins')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', ride.category_id);

      // Get maintenance records count for this ride
      const { count: maintenanceCount } = await supabase
        .from('maintenance_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('ride_id', ride.id);

      setRideStats({
        docCount: docCount || 0,
        todayChecks: todayChecks || 0,
        bulletinCount: bulletinCount || 0,
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
      <div className="pb-24 md:pb-6">
        <RideForm 
          ride={ride} 
          onSuccess={handleEditSuccess} 
          onCancel={() => setIsEditing(false)} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-24 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Button variant="outline" onClick={onBack} className="w-fit flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Rides</span>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditing(true)} className="w-fit flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            <span>Edit</span>
          </Button>
          <SendDocumentsDialog 
            ride={ride}
            trigger={
              <Button className="w-fit flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>Send Documents</span>
              </Button>
            }
          />
        </div>
      </div>

      {/* Ride Title & Badge */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl md:text-3xl font-bold break-words">{ride.ride_name}</h2>
          <Badge variant="secondary" className="text-xs">{ride.ride_categories.name}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage documentation and safety checks for this equipment
        </p>
      </div>

      {/* Ride Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Ride Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <span className="font-medium text-xs uppercase text-muted-foreground">Category</span>
              <p className="text-foreground">{ride.ride_categories.name}</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-xs uppercase text-muted-foreground">Manufacturer</span>
              <p className="text-foreground break-words">{ride.manufacturer || 'Not specified'}</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-xs uppercase text-muted-foreground">Year</span>
              <p className="text-foreground">{ride.year_manufactured || 'Not specified'}</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-xs uppercase text-muted-foreground">Serial Number</span>
              <p className="text-foreground break-all">{ride.serial_number || 'Not specified'}</p>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-xs uppercase text-muted-foreground">Owner</span>
              <p className="text-foreground break-words">{ride.owner_name || 'Not specified'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
        {/* Mobile & Desktop: Responsive grid */}
        <TabsList className={`grid w-full gap-1.5 p-1.5 bg-muted/30 h-auto ${isAdvanced ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2'}`}>
          <TabsTrigger value="overview" className="flex items-center justify-center gap-2 py-2.5">
            <FileText className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Home</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center justify-center gap-2 py-2.5">
            <Upload className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Docs</span>
          </TabsTrigger>
          {isAdvanced && (
            <>
              <TabsTrigger value="inspections" className="flex items-center justify-center gap-2 py-2.5">
                <CheckSquare className="h-4 w-4" />
                <span className="text-xs sm:text-sm">Checks</span>
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="flex items-center justify-center gap-2 py-2.5">
                <Wrench className="h-4 w-4" />
                <span className="text-xs sm:text-sm">Maint</span>
              </TabsTrigger>
              <TabsTrigger value="bulletins" className="flex items-center justify-center gap-2 py-2.5">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs sm:text-sm">Info</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span>Documents</span>
                </CardTitle>
                <CardDescription>
                  Upload and manage ride documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {rideStats.loading ? '...' : rideStats.docCount}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Documents uploaded
                    </p>
                  </div>
                  <Button onClick={() => setActiveTab("documents")} className="w-full">
                    Manage Documents
                  </Button>
                </div>
              </CardContent>
            </Card>

            <FeatureGate 
              requiredPlan="advanced" 
              feature="Maintenance Logging"
              fallback={
                <RestrictedFeatureCard
                  title="Maintenance"
                  description="Log maintenance activities with photos and documentation"
                  icon={<Wrench className="h-5 w-5" />}
                  requiredPlan="advanced"
                />
              }
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Wrench className="h-5 w-5 text-primary" />
                    <span>Maintenance</span>
                  </CardTitle>
                  <CardDescription>
                    Log maintenance with photos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {rideStats.loading ? '...' : rideStats.maintenanceCount}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Records logged
                      </p>
                    </div>
                    <Button onClick={() => setActiveTab("maintenance")} className="w-full">
                      Log Maintenance
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FeatureGate>

            <FeatureGate 
              requiredPlan="advanced" 
              feature="Daily Inspections & Checks"
              fallback={
                <RestrictedFeatureCard
                  title="Inspections"
                  description="Manage all inspection types including daily checks, annual inspections, and NDT testing"
                  icon={<CheckSquare className="h-5 w-5" />}
                  requiredPlan="advanced"
                />
              }
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckSquare className="h-5 w-5 text-accent" />
                    <span>Inspections</span>
                  </CardTitle>
                  <CardDescription>
                    Manage all inspection types
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent">
                        {rideStats.loading ? '...' : rideStats.todayChecks}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Checks completed today
                      </p>
                    </div>
                    <Button onClick={() => setActiveTab("inspections")} variant="outline" className="w-full">
                      Start Inspections
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FeatureGate>

            <FeatureGate 
              requiredPlan="advanced" 
              feature="Technical Bulletins"
              fallback={
                <RestrictedFeatureCard
                  title="Technical Bulletins"
                  description="Access safety bulletins and technical notices relevant to your ride category"
                  icon={<AlertTriangle className="h-5 w-5" />}
                  requiredPlan="advanced"
                />
              }
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-secondary-foreground" />
                    <span>Technical Bulletins</span>
                  </CardTitle>
                  <CardDescription>
                    View relevant safety bulletins
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-secondary-foreground">
                        {rideStats.loading ? '...' : rideStats.bulletinCount}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Available bulletins
                      </p>
                    </div>
                    <Button onClick={() => setActiveTab("bulletins")} variant="secondary" className="w-full">
                      View Bulletins
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FeatureGate>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <RideDocuments ride={ride} />
        </TabsContent>

        <TabsContent value="inspections">
          <FeatureGate requiredPlan="advanced" feature="Daily Inspections & Checks">
            <InspectionManager ride={ride} />
          </FeatureGate>
        </TabsContent>

        <TabsContent value="maintenance">
          <FeatureGate requiredPlan="advanced" feature="Maintenance Logging">
            <MaintenanceManager ride={ride} />
          </FeatureGate>
        </TabsContent>

        <TabsContent value="bulletins">
          <FeatureGate requiredPlan="advanced" feature="Technical Bulletins">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Technical Bulletins for {ride.ride_categories.name}</span>
                </CardTitle>
                <CardDescription>
                  Safety bulletins and technical notices relevant to this ride category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <AlertTriangle className="mx-auto h-16 w-16 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mt-4">No bulletins available</h3>
                  <p className="text-muted-foreground">
                    There are currently no technical bulletins for this ride category.
                  </p>
                </div>
              </CardContent>
            </Card>
          </FeatureGate>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RideDetail;