import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Wrench, HelpCircle } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import PageHeader from '@/components/PageHeader';
import MaintenanceManager from '@/components/MaintenanceManager';
import MaintenanceRideSelector from '@/components/MaintenanceRideSelector';
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

        if (!isStaff) {
          query = query.eq('user_id', effectiveUserId);
        }

        const { data, error } = await query.single();

        if (error) throw error;
        setSelectedRide(data as Ride);
      } catch (error) {
        console.error('Error loading ride:', error);
        setSearchParams({});
      } finally {
        setLoading(false);
      }
    };

    loadRide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideIdFromUrl, user?.id, isStaff, effectiveUserId]);

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
      <div className="space-y-3 px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Show MaintenanceManager when a ride is selected
  if (selectedRide) {
    return (
      <div className="space-y-3 px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8">
        <StaffAccountBanner />
        <MaintenanceOnboardingModal forceOpen={showGuide} onClose={() => setShowGuide(false)} />

        <PageHeader
          icon={<Wrench className="h-5 w-5 text-amber-600" />}
          iconBgClass="from-amber-500/20 to-amber-500/10"
          title={selectedRide.ride_name}
          subtitle="Maintenance & repairs"
          showBackButton
          onBack={handleBack}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGuide(true)}
              className="text-muted-foreground hover:text-foreground h-8 px-2 sm:px-3 text-[13px]"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">How it works</span>
            </Button>
          }
        />

        <MaintenanceManager ride={selectedRide} />
      </div>
    );
  }

  // Show ride selector when no ride is selected
  return (
    <div className="space-y-3 px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8">
      <StaffAccountBanner />
      <MaintenanceOnboardingModal forceOpen={showGuide} onClose={() => setShowGuide(false)} />

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
            className="text-muted-foreground hover:text-foreground h-8 px-2 sm:px-3 text-[13px]"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">How it works</span>
          </Button>
        }
      />

      <MaintenanceRideSelector onRideSelect={handleRideSelect} />
    </div>
  );
};

export default Maintenance;
