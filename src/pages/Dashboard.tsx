import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { User, Settings, FileText, Plus, Users, Wrench, Shield, LogOut, Calendar as CalendarIcon, Bell as BellIcon, Crown, AlertTriangle, CheckSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import RideManagement from '@/components/RideManagement';
import RideDocumentManager from '@/components/RideDocumentManager';
import RideInspectionManager from '@/components/RideInspectionManager';
import RideMaintenanceManager from '@/components/RideMaintenanceManager';
import DashboardOverview from '@/components/DashboardOverview';
import CalendarView from '@/components/CalendarView';
import NotificationCenter from '@/components/NotificationCenter';
import MaintenanceTracker from '@/components/MaintenanceTracker';
import ReportGenerator from '@/components/ReportGenerator';
import TechnicalBulletinManager from '@/components/TechnicalBulletinManager';
import TechnicalBulletinList from '@/components/TechnicalBulletinList';
import ProfileSetup from '@/components/ProfileSetup';
import ProfileEdit from '@/components/ProfileEdit';
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
  const [showProfileEdit, setShowProfileEdit] = useState(false);

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

  const isBasicOrTrial = subscription?.subscriptionStatus === 'trial' || subscription?.subscriptionStatus === 'basic';
  
  const PlanAwareTabTrigger = ({ value, icon: Icon, label, requiresAdvanced = false, className = "" }) => {
    const isRestricted = requiresAdvanced && isBasicOrTrial;
    const isAvailable = !isRestricted;
    
    const triggerContent = (
      <TabsTrigger 
        value={value}
        disabled={isRestricted}
        className={`
          flex flex-col items-center justify-center py-2 px-3 text-xs relative min-h-[3rem]
          ${isAvailable ? 'hover:bg-accent/50' : 'opacity-60 cursor-not-allowed'}
          ${className}
        `}
      >
        <div className="relative flex flex-col items-center">
          <Icon className={`h-4 w-4 mb-1 ${isRestricted ? 'opacity-50' : ''}`} />
          <span className={`${isRestricted ? 'opacity-50' : ''} font-medium`}>{label}</span>
          {isRestricted && (
            <Crown className="absolute -top-1 -right-3 h-3 w-3 text-amber-500" />
          )}
        </div>
      </TabsTrigger>
    );

    if (isRestricted) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {triggerContent}
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <div className="text-center">
              <p className="font-medium">Advanced Plan Required</p>
              <p className="text-muted-foreground">Upgrade to access {label}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    return triggerContent;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Simplified Header */}
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo and Title */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <FileText className="h-6 w-6 text-primary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold truncate">Dashboard</h1>
                <p className="text-xs text-muted-foreground truncate">
                  Ride Ready Docs
                </p>
              </div>
            </div>
            
            {/* User Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Desktop user info */}
              <div className="hidden sm:flex items-center gap-3">
                <div className="text-right min-w-0">
                  <p className="text-xs text-muted-foreground">Welcome</p>
                  <p className="text-sm font-medium truncate max-w-[120px]">
                    {user?.email?.split('@')[0]}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="flex items-center gap-1"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden md:inline">Sign Out</span>
                </Button>
              </div>
              
              {/* Mobile user menu */}
              <div className="sm:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="flex items-center gap-1 px-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-xs">Exit</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 py-3 md:px-4 md:py-6">
        <TrialStatus onUpgrade={() => setShowPlanSelection(true)} />
        
        {/* Mobile: Clean ride management section */}
        <div className="block md:hidden mb-4">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-primary text-sm">Your Equipment</h3>
                <p className="text-xs text-muted-foreground truncate">Add rides, stalls & equipment</p>
              </div>
              <Button 
                onClick={() => setActiveTab('rides')}
                size="sm"
                className="ml-3 flex-shrink-0"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </div>
        
        <div className="space-y-3 md:space-y-6">
          {/* Content Area - No duplicate titles */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
            {/* Mobile: Clean scrollable tabs */}
            <div className="md:hidden">
              <TooltipProvider>
                <div className="overflow-x-auto scrollbar-hide">
                  <TabsList className="flex w-max gap-1 p-1 bg-muted/20 h-auto">
                    <PlanAwareTabTrigger 
                      value="overview" 
                      icon={Plus} 
                      label="Home"
                      className="flex-shrink-0 px-3 py-2 text-xs"
                    />
                    <PlanAwareTabTrigger 
                      value="rides" 
                      icon={Settings} 
                      label="Rides"
                      className="flex-shrink-0 px-3 py-2 text-xs font-medium bg-primary/10 text-primary"
                    />
                    <PlanAwareTabTrigger 
                      value="inspections" 
                      icon={CheckSquare} 
                      label="Checks"
                      className="flex-shrink-0 px-3 py-2 text-xs"
                    />
                    <PlanAwareTabTrigger 
                      value="maintenance" 
                      icon={Wrench} 
                      label="Service"
                      className="flex-shrink-0 px-3 py-2 text-xs"
                    />
                    <PlanAwareTabTrigger 
                      value="documents" 
                      icon={Shield} 
                      label="Docs"
                      className="flex-shrink-0 px-3 py-2 text-xs"
                    />
                    <PlanAwareTabTrigger 
                      value="profile" 
                      icon={User} 
                      label="Profile"
                      className="flex-shrink-0 px-3 py-2 text-xs"
                    />
                  </TabsList>
                </div>
              </TooltipProvider>
            </div>

            {/* Desktop: Grid layout */}
            <div className="hidden md:block">
              <TooltipProvider>
                <TabsList className="grid w-full grid-cols-9 h-auto p-1 bg-muted/20">
                  <PlanAwareTabTrigger 
                    value="overview" 
                    icon={Plus} 
                    label="Overview"
                  />
                  <PlanAwareTabTrigger 
                    value="rides" 
                    icon={Settings} 
                    label="My Rides"
                  />
                  <PlanAwareTabTrigger 
                    value="calendar" 
                    icon={CalendarIcon} 
                    label="Calendar"
                    requiresAdvanced={true}
                  />
                    <PlanAwareTabTrigger 
                      value="inspections" 
                      icon={CheckSquare} 
                      label="Inspections"
                    />
                    <PlanAwareTabTrigger 
                      value="maintenance" 
                      icon={Wrench} 
                      label="Maintenance"
                    />
                    <PlanAwareTabTrigger 
                      value="documents" 
                      icon={Shield} 
                      label="Documents"
                    />
                  <PlanAwareTabTrigger 
                    value="notifications" 
                    icon={BellIcon} 
                    label="Notifications"
                    requiresAdvanced={true}
                  />
                  <PlanAwareTabTrigger 
                    value="reports" 
                    icon={FileText} 
                    label="Reports"
                    requiresAdvanced={true}
                  />
                  <PlanAwareTabTrigger 
                    value="bulletins" 
                    icon={AlertTriangle} 
                    label="Bulletins"
                    requiresAdvanced={true}
                  />
                  <PlanAwareTabTrigger 
                    value="profile" 
                    icon={User} 
                    label="Profile"
                  />
                </TabsList>
              </TooltipProvider>
            </div>

            <TabsContent value="overview">
              <DashboardOverview onNavigate={setActiveTab} />
            </TabsContent>

            <TabsContent value="rides">
              <FeatureGate requiredPlan="basic" feature="Ride Management">
                <RideManagement />
              </FeatureGate>
            </TabsContent>

            <TabsContent value="calendar">
              <FeatureGate requiredPlan="advanced" feature="Calendar & Scheduling">
                <CalendarView />
              </FeatureGate>
            </TabsContent>

            <TabsContent value="inspections">
              <FeatureGate requiredPlan="basic" feature="Inspection Management">
                <RideInspectionManager />
              </FeatureGate>
            </TabsContent>

            <TabsContent value="maintenance">
              <FeatureGate requiredPlan="basic" feature="Maintenance Management">
                <RideMaintenanceManager />
              </FeatureGate>
            </TabsContent>

            <TabsContent value="documents">
              <FeatureGate requiredPlan="basic" feature="Document Management">
                <RideDocumentManager />
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

            <TabsContent value="bulletins">
              <FeatureGate requiredPlan="advanced" feature="Technical Bulletins">
                <div className="space-y-6">
                  <Tabs defaultValue="view" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="view">View Bulletins</TabsTrigger>
                      <TabsTrigger value="manage">Manage Bulletins</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="view">
                      <TechnicalBulletinList />
                    </TabsContent>
                    
                    <TabsContent value="manage">
                      <TechnicalBulletinManager />
                    </TabsContent>
                  </Tabs>
                </div>
              </FeatureGate>
            </TabsContent>

            <TabsContent value="profile">
              {/* Profile Info */}
              {profile && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Users className="h-5 w-5" />
                        <span>Profile Information</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowProfileEdit(!showProfileEdit)}
                      >
                        {showProfileEdit ? 'Cancel' : 'Edit Profile'}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!showProfileEdit ? (
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
                    ) : (
                      <ProfileEdit profile={profile} onComplete={() => {
                        setShowProfileEdit(false);
                        loadProfile();
                      }} />
                    )}
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