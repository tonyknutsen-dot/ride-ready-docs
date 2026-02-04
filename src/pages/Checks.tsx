import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, HelpCircle } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideSelector from '@/components/RideSelector';
import PageHeader from '@/components/PageHeader';
import { ChecksOnboardingModal } from '@/components/ChecksOnboardingModal';
import { Button } from '@/components/ui/button';
import StaffAccountBanner from '@/components/StaffAccountBanner';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

const Checks = () => {
  const navigate = useNavigate();
  const [showGuide, setShowGuide] = useState(false);

  const handleRideSelect = (ride: Ride) => {
    // Navigate to ride detail with checks tab active
    navigate(`/rides/${ride.id}?tab=checks`);
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <StaffAccountBanner />
      <ChecksOnboardingModal forceOpen={showGuide} onClose={() => setShowGuide(false)} />
      <header className="border-b-2 border-success/30 bg-gradient-to-r from-success/5 to-transparent backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <PageHeader
            icon={<CheckSquare className="h-5 w-5 text-success" />}
            iconBgClass="from-success/20 to-success/10"
            title="Safety Checks"
            subtitle="Select equipment to perform checks"
            showBackButton
            backTo="/overview"
            actions={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGuide(true)}
                className="text-muted-foreground hover:text-foreground h-9 px-2 sm:px-3"
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
