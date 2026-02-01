import { useNavigate } from 'react-router-dom';
import { CheckSquare } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideSelector from '@/components/RideSelector';
import PageHeader from '@/components/PageHeader';
import { ChecksOnboardingModal } from '@/components/ChecksOnboardingModal';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

const Checks = () => {
  const navigate = useNavigate();

  const handleRideSelect = (ride: Ride) => {
    // Navigate to ride detail with checks tab active
    navigate(`/rides/${ride.id}?tab=inspections`);
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <ChecksOnboardingModal />
      <header className="border-b-2 border-success/30 bg-gradient-to-r from-success/5 to-transparent backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <PageHeader
            icon={<CheckSquare className="h-5 w-5 text-success" />}
            iconBgClass="from-success/20 to-success/10"
            title="Safety Checks"
            subtitle="Select equipment to perform checks"
            showBackButton
            backTo="/overview"
          />
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-5">
        <RideSelector
          title="Select Equipment"
          description="Choose which ride, stall, or equipment you want to perform safety checks on."
          actionLabel="Open Checks"
          icon={({ className }) => <CheckSquare className={className} />}
          onRideSelect={handleRideSelect}
          showAddRide={false}
        />
      </main>
    </div>
  );
};

export default Checks;
