import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { User, Settings, FileText, Plus, Users, Wrench, Shield, LogOut, Calendar as CalendarIcon, Bell as BellIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import RideManagement from '@/components/RideManagement';
import GlobalDocuments from '@/components/GlobalDocuments';
import DashboardOverview from '@/components/DashboardOverview';
import CalendarView from '@/components/CalendarView';
import NotificationCenter from '@/components/NotificationCenter';
import MaintenanceTracker from '@/components/MaintenanceTracker';
import ReportGenerator from '@/components/ReportGenerator';
import ProfileSetup from '@/components/ProfileSetup';
import { TrialStatus } from '@/components/TrialStatus';
import { PlanSelection } from '@/components/PlanSelection';
import { FeatureGate } from '@/components/FeatureGate';
import { RestrictedFeatureCard } from '@/components/RestrictedFeatureCard';
import { useSubscription } from '@/hooks/useSubscription';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { subscription } = useSubscription();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showPlanSelection, setShowPlanSelection] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account.",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <FileText className="mx-auto h-12 w-12 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Show profile setup if no profile exists
  if (!profile) {
    return <ProfileSetup onComplete={loadProfile} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-3">
          {/* Mobile-first responsive header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <FileText className="h-6 w-6 md:h-8 md:w-8 text-primary flex-shrink-0" />
              <h1 className="text-lg md:text-2xl font-bold truncate">
                <span className="hidden sm:inline">Ride Ready Docs</span>
                <span className="sm:hidden">RRD</span>
              </h1>
            </div>
            
            {/* Desktop user info */}
            <div className="hidden md:flex items-center space-x-4">
              <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                Welcome, {user?.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center space-x-2 flex-shrink-0"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </Button>
            </div>

            {/* Mobile user menu */}
            <div className="md:hidden flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center space-x-1 text-xs"
              >
                <LogOut className="h-4 w-4" />
                <span>Exit</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 md:py-8">
        <TrialStatus onUpgrade={() => setShowPlanSelection(true)} />
        
        <div className="space-y-4 md:space-y-6">
          <div className="space-y-1 md:space-y-2">
            <h2 className="text-xl md:text-3xl font-bold">Dashboard</h2>
            <p className="text-sm md:text-base text-muted-foreground">
              Manage your ride documentation and compliance
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
            {/* Mobile: Scrollable tabs */}
            <div className="md:hidden">
              <TabsList className="flex w-full overflow-x-auto scrollbar-hide h-auto p-1 gap-1">
                <TabsTrigger value="overview" className="flex flex-col items-center py-2 px-3 text-xs whitespace-nowrap flex-shrink-0">
                  <Plus className="h-4 w-4 mb-1" />
                  <span>Overview</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="rides" 
                  className="flex flex-col items-center py-2 px-3 text-xs whitespace-nowrap flex-shrink-0"
                  disabled={subscription?.subscriptionStatus === 'trial' || subscription?.subscriptionStatus === 'basic'}
                >
                  <Settings className="h-4 w-4 mb-1" />
                  <span>Rides</span>
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex flex-col items-center py-2 px-3 text-xs whitespace-nowrap flex-shrink-0">
                  <Shield className="h-4 w-4 mb-1" />
                  <span>Docs</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="calendar" 
                  className="flex flex-col items-center py-2 px-3 text-xs whitespace-nowrap flex-shrink-0"
                  disabled={subscription?.subscriptionStatus === 'trial' || subscription?.subscriptionStatus === 'basic'}
                >
                  <CalendarIcon className="h-4 w-4 mb-1" />
                  <span>Calendar</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="maintenance" 
                  className="flex flex-col items-center py-2 px-3 text-xs whitespace-nowrap flex-shrink-0"
                  disabled={subscription?.subscriptionStatus === 'trial' || subscription?.subscriptionStatus === 'basic'}
                >
                  <Wrench className="h-4 w-4 mb-1" />
                  <span>Maintenance</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="notifications" 
                  className="flex flex-col items-center py-2 px-3 text-xs whitespace-nowrap flex-shrink-0"
                  disabled={subscription?.subscriptionStatus === 'trial' || subscription?.subscriptionStatus === 'basic'}
                >
                  <BellIcon className="h-4 w-4 mb-1" />
                  <span>Alerts</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="reports" 
                  className="flex flex-col items-center py-2 px-3 text-xs whitespace-nowrap flex-shrink-0"
                  disabled={subscription?.subscriptionStatus === 'trial' || subscription?.subscriptionStatus === 'basic'}
                >
                  <FileText className="h-4 w-4 mb-1" />
                  <span>Reports</span>
                </TabsTrigger>
                <TabsTrigger value="profile" className="flex flex-col items-center py-2 px-3 text-xs whitespace-nowrap flex-shrink-0">
                  <User className="h-4 w-4 mb-1" />
                  <span>Profile</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Desktop: Grid layout */}
            <div className="hidden md:block">
              <TabsList className="grid w-full grid-cols-8 h-auto p-1">
                <TabsTrigger value="overview" className="flex flex-col items-center py-3 px-2 text-xs">
                  <Plus className="h-4 w-4 mb-1" />
                  <span>Overview</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="rides" 
                  className="flex flex-col items-center py-3 px-2 text-xs"
                  disabled={subscription?.subscriptionStatus === 'trial' || subscription?.subscriptionStatus === 'basic'}
                >
                  <Settings className="h-4 w-4 mb-1" />
                  <span>My Rides</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="calendar" 
                  className="flex flex-col items-center py-3 px-2 text-xs"
                  disabled={subscription?.subscriptionStatus === 'trial' || subscription?.subscriptionStatus === 'basic'}
                >
                  <CalendarIcon className="h-4 w-4 mb-1" />
                  <span>Calendar</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="maintenance" 
                  className="flex flex-col items-center py-3 px-2 text-xs"
                  disabled={subscription?.subscriptionStatus === 'trial' || subscription?.subscriptionStatus === 'basic'}
                >
                  <Wrench className="h-4 w-4 mb-1" />
                  <span>Maintenance</span>
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex flex-col items-center py-3 px-2 text-xs">
                  <Shield className="h-4 w-4 mb-1" />
                  <span>Documents</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="notifications" 
                  className="flex flex-col items-center py-3 px-2 text-xs"
                  disabled={subscription?.subscriptionStatus === 'trial' || subscription?.subscriptionStatus === 'basic'}
                >
                  <BellIcon className="h-4 w-4 mb-1" />
                  <span>Notifications</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="reports" 
                  className="flex flex-col items-center py-3 px-2 text-xs"
                  disabled={subscription?.subscriptionStatus === 'trial' || subscription?.subscriptionStatus === 'basic'}
                >
                  <FileText className="h-4 w-4 mb-1" />
                  <span>Reports</span>
                </TabsTrigger>
                <TabsTrigger value="profile" className="flex flex-col items-center py-3 px-2 text-xs">
                  <User className="h-4 w-4 mb-1" />
                  <span>Profile</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview">
              <DashboardOverview onNavigate={setActiveTab} />
            </TabsContent>

            <TabsContent value="rides">
              <FeatureGate requiredPlan="advanced" feature="Ride Management">
                <RideManagement />
              </FeatureGate>
            </TabsContent>

            <TabsContent value="calendar">
              <FeatureGate requiredPlan="advanced" feature="Calendar & Scheduling">
                <CalendarView />
              </FeatureGate>
            </TabsContent>

            <TabsContent value="maintenance">
              <FeatureGate requiredPlan="advanced" feature="Maintenance Tracking">
                <MaintenanceTracker />
              </FeatureGate>
            </TabsContent>

            <TabsContent value="documents">
              <FeatureGate requiredPlan="basic" feature="Document Management">
                <GlobalDocuments />
              </FeatureGate>
            </TabsContent>

            <TabsContent value="notifications">
              <FeatureGate requiredPlan="advanced" feature="Notifications & Alerts">
                <NotificationCenter />
              </FeatureGate>
            </TabsContent>

            <TabsContent value="reports">
              <FeatureGate requiredPlan="advanced" feature="Advanced Reporting">
                <ReportGenerator />
              </FeatureGate>
            </TabsContent>

            <TabsContent value="profile">
              {/* Profile Info */}
              {profile && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="h-5 w-5" />
                      <span>Profile Information</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Company:</span>{' '}
                        {profile.company_name || 'Not set'}
                      </div>
                      <div>
                        <span className="font-medium">Controller:</span>{' '}
                        {profile.controller_name || 'Not set'}
                      </div>
                      <div>
                        <span className="font-medium">Showmen:</span>{' '}
                        {profile.showmen_name || 'Not set'}
                      </div>
                      <div>
                        <span className="font-medium">Address:</span>{' '}
                        {profile.address || 'Not set'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      <Dialog open={showPlanSelection} onOpenChange={setShowPlanSelection}>
        <DialogContent className="max-w-4xl">
          <PlanSelection onClose={() => setShowPlanSelection(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;