import { useNavigate } from 'react-router-dom';
import { CheckSquare } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideSelector from '@/components/RideSelector';

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
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
              <CheckSquare className="h-5 w-5 text-success" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Safety Checks</h1>
              <p className="text-xs text-muted-foreground">Select equipment to perform checks</p>
            </div>
          </div>
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