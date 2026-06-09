import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, HelpCircle } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { ChecksOnboardingModal } from '@/components/ChecksOnboardingModal';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import EquipmentSelector from '@/components/EquipmentSelector';
import { markCheckDebug } from '@/utils/checkDebug';

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

  useEffect(() => {
    markCheckDebug('checks page mounted');
  }, []);

  const handleRideSelect = (ride: Ride) => {
    markCheckDebug('equipment selected');
    // Route into the canonical Equipment → Asset → Checks hub.
    // `from=checks` makes Back return to /checks instead of /rides.
    const debugParam = new URLSearchParams(window.location.search).get('checkDebug') === '1' ? '&checkDebug=1' : '';
    navigate(`/rides/${ride.id}?tab=checks&from=checks${debugParam}`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-3 px-4 sm:px-6 lg:px-8 py-4 md:py-6 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8">
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
