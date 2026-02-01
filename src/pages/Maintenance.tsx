import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Wrench, ArrowLeft, HelpCircle } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import RideSelector from '@/components/RideSelector';
import PageHeader from '@/components/PageHeader';
import MaintenanceManager from '@/components/MaintenanceManager';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MaintenanceOnboardingModal } from '@/components/MaintenanceOnboardingModal';
import StaffAccountBanner from '@/components/StaffAccountBanner';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

const Maintenance = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();
  const [searchParams, setSearchParams] = useSearchParams();
  const rideIdFromUrl = searchParams.get('rideId');
  
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(!!rideIdFromUrl);
  const [showGuide, setShowGuide] = useState(false);

  // Load ride from URL param if present
  useEffect(() => {
    const loadRide = async () => {
      if (!rideIdFromUrl || !user || !effectiveUserId) {
        setLoading(false);
        return;
      }

      try {
        let query = supabase
          .from('rides')
          .select('*, ride_categories(name, description, category_group)')
          .eq('id', rideIdFromUrl);

        // Always scope to the *current operator* (effectiveUserId).
        query = query.eq('user_id', effectiveUserId);

        const { data, error } = await query.single();

        if (error) throw error;
        setSelectedRide(data as Ride);
      } catch (error) {
        console.error('Error loading ride:', error);
        // Clear invalid rideId from URL
        setSearchParams({});
      } finally {
        setLoading(false);
      }
    };

    loadRide();
  }, [rideIdFromUrl, user, isStaff, effectiveUserId, setSearchParams]);

  const handleRideSelect = (ride: Ride) => {
    setSelectedRide(ride);
    setSearchParams({ rideId: ride.id });
  };

  const handleBack = () => {
    setSelectedRide(null);
    setSearchParams({});
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-28 md:pb-8">
        <header className="border-b-2 border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-12 w-64" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-5">
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  // Show MaintenanceManager when a ride is selected
  if (selectedRide) {
    return (
      <div className="min-h-screen bg-background pb-28 md:pb-8">
        <StaffAccountBanner />
        <MaintenanceOnboardingModal forceOpen={showGuide} onClose={() => setShowGuide(false)} />
        <header className="border-b-2 border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleBack}
                className="h-10 w-10 shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <PageHeader
                  icon={<Wrench className="h-5 w-5 text-amber-600" />}
                  iconBgClass="from-amber-500/20 to-amber-500/10"
                  title={selectedRide.ride_name}
                  subtitle="Maintenance Management"
                  actions={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowGuide(true)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <HelpCircle className="h-4 w-4" />
                      <span className="hidden sm:inline ml-1">How does it work?</span>
                    </Button>
                  }
                />
              </div>
            </div>
          </div>
        </header>
        
        <main className="container mx-auto px-4 py-5">
          <MaintenanceManager ride={selectedRide} />
        </main>
      </div>
    );
  }

  // Show ride selector when no ride is selected
  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <StaffAccountBanner />
      <MaintenanceOnboardingModal forceOpen={showGuide} onClose={() => setShowGuide(false)} />
      <header className="border-b-2 border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <PageHeader
            icon={<Wrench className="h-5 w-5 text-amber-600" />}
            iconBgClass="from-amber-500/20 to-amber-500/10"
            title="Maintenance"
            subtitle="Select equipment to manage maintenance"
            showBackButton
            backTo="/overview"
            actions={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGuide(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">How does it work?</span>
              </Button>
            }
          />
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-5">
        <RideSelector
          title="Select Equipment"
          description="Choose which ride, stall, or equipment you want to log and track maintenance activities."
          actionLabel="Open Maintenance"
          icon={({ className }) => <Wrench className={className} />}
          onRideSelect={handleRideSelect}
          showAddRide={false}
        />
      </main>
    </div>
  );
};

export default Maintenance;
