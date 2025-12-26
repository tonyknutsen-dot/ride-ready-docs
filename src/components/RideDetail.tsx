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
    category_group: string;
  };
};

interface RideDetailProps {
  ride: Ride;
  onBack: () => void;
  onUpdate: () => void;
  initialTab?: string;
}

const RideDetail = ({ ride, onBack, onUpdate, initialTab = "overview" }: RideDetailProps) => {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [activeTab, setActiveTab] = useState(initialTab);
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
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center justify-between gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack} 
            className="h-10 w-10 shrink-0 active:scale-95 transition-transform"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-base font-semibold truncate">{ride.ride_name}</h1>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5">
              {ride.ride_categories.name}
            </Badge>
          </div>
          
          <div className="flex gap-1.5">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setIsEditing(true)} 
              className="h-10 w-10 shrink-0 active:scale-95 transition-transform"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <SendDocumentsDialog 
              ride={ride}
              trigger={
                <Button 
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 active:scale-95 transition-transform"
                >
                  <Mail className="h-4 w-4" />
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {/* Equipment Details */}
      <Card className="shadow-card overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 divide-x divide-y divide-border/50">
            <div className="p-4 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Category</span>
              <p className="text-sm font-medium">{ride.ride_categories.name}</p>
            </div>
            <div className="p-4 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Manufacturer</span>
              <p className="text-sm font-medium truncate">{ride.manufacturer || '—'}</p>
            </div>
            <div className="p-4 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Year</span>
              <p className="text-sm font-medium">{ride.year_manufactured || '—'}</p>
            </div>
            <div className="p-4 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Serial</span>
              <p className="text-sm font-medium truncate">{ride.serial_number || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="grid w-full h-auto p-1.5 gap-1.5 bg-muted/60" style={{ gridTemplateColumns: isAdvanced ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)' }}>
          <TabsTrigger 
            value="overview" 
            className="flex flex-col items-center justify-center gap-1 py-3 px-2 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg min-h-[60px]"
          >
            <FileText className="h-5 w-5" />
            <span>Home</span>
          </TabsTrigger>
          <TabsTrigger 
            value="documents" 
            className="flex flex-col items-center justify-center gap-1 py-3 px-2 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg min-h-[60px]"
          >
            <Upload className="h-5 w-5" />
            <span>Documents</span>
          </TabsTrigger>
          {isAdvanced && (
            <>
              <TabsTrigger 
                value="inspections" 
                className="flex flex-col items-center justify-center gap-1 py-3 px-2 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg min-h-[60px]"
              >
                <CheckSquare className="h-5 w-5" />
                <span>Checks</span>
              </TabsTrigger>
              <TabsTrigger 
                value="maintenance" 
                className="flex flex-col items-center justify-center gap-1 py-3 px-2 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg min-h-[60px]"
              >
                <Wrench className="h-5 w-5" />
                <span>Maintenance</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 gap-3">
            {/* CHECKS - Main Priority Action */}
            <FeatureGate 
              requiredPlan="advanced" 
              feature="Inspections"
              fallback={
                <RestrictedFeatureCard
                  title="Safety Checks"
                  description="Perform daily, monthly & yearly checks"
                  icon={<CheckSquare className="h-5 w-5" />}
                  requiredPlan="advanced"
                />
              }
            >
              <Card 
                className="shadow-card active:scale-[0.98] transition-transform cursor-pointer border-2 border-success/30 bg-gradient-to-r from-success/5 to-success/10"
                onClick={() => setActiveTab("inspections")}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-success/20 flex items-center justify-center shrink-0">
                    <CheckSquare className="h-8 w-8 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base text-success">Start Safety Check</p>
                    <p className="text-sm text-muted-foreground">Daily, monthly or yearly inspections</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-success">
                      {rideStats.loading ? '...' : rideStats.todayChecks}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">Today</p>
                  </div>
                </CardContent>
              </Card>
            </FeatureGate>

            {/* Documents Quick Action */}
            <Card 
              className="shadow-card active:scale-[0.98] transition-transform cursor-pointer"
              onClick={() => setActiveTab("documents")}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Documents</p>
                  <p className="text-xs text-muted-foreground">Upload and manage files</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-primary">
                    {rideStats.loading ? '...' : rideStats.docCount}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase">Files</p>
                </div>
              </CardContent>
            </Card>

            {/* Maintenance Quick Action */}
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
              <Card 
                className="shadow-card active:scale-[0.98] transition-transform cursor-pointer"
                onClick={() => setActiveTab("maintenance")}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <Wrench className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Maintenance</p>
                    <p className="text-xs text-muted-foreground">Log repairs and service</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {rideStats.loading ? '...' : rideStats.maintenanceCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">Records</p>
                  </div>
                </CardContent>
              </Card>
            </FeatureGate>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="animate-fade-in">
          <RideDocuments ride={ride} />
        </TabsContent>

        <TabsContent value="inspections" className="animate-fade-in">
          <FeatureGate requiredPlan="advanced" feature="Inspections">
            <InspectionManager ride={ride} />
          </FeatureGate>
        </TabsContent>

        <TabsContent value="maintenance" className="animate-fade-in">
          <FeatureGate requiredPlan="advanced" feature="Maintenance Logging">
            <MaintenanceManager ride={ride} />
          </FeatureGate>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RideDetail;
