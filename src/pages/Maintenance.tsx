import { useNavigate } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideSelector from '@/components/RideSelector';
import PageHeader from '@/components/PageHeader';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

const Maintenance = () => {
  const navigate = useNavigate();

  const handleRideSelect = (ride: Ride) => {
    // Navigate to ride detail with maintenance tab active
    navigate(`/rides/${ride.id}?tab=maintenance`);
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <header className="border-b-2 border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <PageHeader
            icon={<Wrench className="h-5 w-5 text-amber-600" />}
            iconBgClass="from-amber-500/20 to-amber-500/10"
            title="Maintenance"
            subtitle="Select equipment to manage maintenance"
            showBackButton
            backTo="/overview"
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
