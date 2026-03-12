import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import PageHeader from '@/components/PageHeader';
import EquipmentSelector from '@/components/EquipmentSelector';
import DefectReportForm from '@/components/DefectReportForm';
import { Skeleton } from '@/components/ui/skeleton';
import StaffAccountBanner from '@/components/StaffAccountBanner';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

const DefectReport = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();
  const [searchParams, setSearchParams] = useSearchParams();
  const rideIdFromUrl = searchParams.get('rideId');

  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(!!rideIdFromUrl);

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

  const handleDefectReported = () => {
    queryClient.invalidateQueries({ queryKey: ['defect-register'] });
    queryClient.invalidateQueries({ queryKey: ['open-critical-defects'] });
    queryClient.invalidateQueries({ queryKey: ['all-rides-critical-defects'] });
    queryClient.invalidateQueries({ queryKey: ['all-rides-open-defects'] });
    queryClient.invalidateQueries({ queryKey: ['needs-attention'] });
    navigate('/defects');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-28 md:pb-8">
        <header className="border-b-2 border-destructive/30 bg-gradient-to-r from-destructive/5 to-transparent backdrop-blur-sm sticky top-0 z-40">
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

  // Show form when a ride is selected
  if (selectedRide) {
    return (
      <div className="min-h-screen bg-background pb-28 md:pb-8">
        <StaffAccountBanner />
        <header className="border-b-2 border-destructive/30 bg-gradient-to-r from-destructive/5 to-transparent backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-4 py-3 sm:py-4">
            <PageHeader
              icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
              iconBgClass="from-destructive/20 to-destructive/10"
              title={selectedRide.ride_name}
              subtitle="Report Defect"
              showBackButton
              onBack={handleBack}
            />
          </div>
        </header>

        <main className="container mx-auto px-4 py-5 max-w-xl">
          <DefectReportForm
            rideId={selectedRide.id}
            rideName={selectedRide.ride_name}
            onDefectReported={handleDefectReported}
          />
        </main>
      </div>
    );
  }

  // Show ride selector when no ride is selected — identical layout to Maintenance
  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <StaffAccountBanner />
      <header className="border-b-2 border-destructive/30 bg-gradient-to-r from-destructive/5 to-transparent backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <PageHeader
            icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
            iconBgClass="from-destructive/20 to-destructive/10"
            title="Report Defect"
            subtitle="Select equipment to report a defect"
            showBackButton
            backTo="/defects"
          />
        </div>
      </header>

      <main className="container mx-auto px-4 py-5">
        <EquipmentSelector
          onRideSelect={handleRideSelect}
          placeholderIcon={AlertTriangle}
          emptyDescription="Add rides or equipment in the Rides section to report defects."
          showKpis={false}
          defectMode
        />
      </main>
    </div>
  );
};

export default DefectReport;
