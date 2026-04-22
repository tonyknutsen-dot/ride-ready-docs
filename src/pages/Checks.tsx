import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, HelpCircle } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { ChecksOnboardingModal } from '@/components/ChecksOnboardingModal';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import EquipmentSelector from '@/components/EquipmentSelector';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

const Checks = () => {
  const navigate = useNavigate();
  const [showGuide, setShowGuide] = useState(false);

  const handleRideSelect = (ride: Ride) => {
    // Route into the canonical Equipment → Asset → Checks hub.
    // `from=checks` makes Back return to /checks instead of /rides.
    navigate(`/rides/${ride.id}?tab=checks&from=checks`);
  };

  return (
    <div className="space-y-3 px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8">
      <StaffAccountBanner />
      <ChecksOnboardingModal forceOpen={showGuide} onClose={() => setShowGuide(false)} />

      <PageHeader
        icon={<CheckSquare className="h-5 w-5 text-primary" />}
        iconBgClass="from-primary/20 to-primary/10"
        title="Checks"
        subtitle="Select equipment to view or start checks"
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

      <EquipmentSelector
        onRideSelect={handleRideSelect}
        placeholderIcon={CheckSquare}
        emptyDescription="Add equipment in the Equipment section to start running checks."
        checksMode
        showKpis={false}
      />
    </div>
  );
};

export default Checks;
