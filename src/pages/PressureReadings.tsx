import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gauge, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import EquipmentSelector from '@/components/EquipmentSelector';
import { PressureReadingsHelpDialog } from '@/components/PressureReadingsHelpDialog';
import { Tables } from '@/integrations/supabase/types';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

const PressureReadings = () => {
  const navigate = useNavigate();
  const [showGuide, setShowGuide] = useState(false);

  const handleRideSelect = (ride: Ride) => {
    navigate(`/pressure-readings/register?rideId=${ride.id}`);
  };

  return (
    <div className="space-y-3 px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8">
      <StaffAccountBanner />
      <PressureReadingsHelpDialog open={showGuide} onOpenChange={setShowGuide} />

      <PageHeader
        icon={<Gauge className="h-5 w-5 text-primary" />}
        iconBgClass="from-primary/20 to-primary/10"
        title="Inflatable Pressure Readings"
        subtitle="Select an inflatable to view or log pressure sessions"
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
        placeholderIcon={Gauge}
        emptyDescription="Add inflatables in the Equipment section to start logging pressure readings."
        showKpis={false}
        categoryGroupFilter="Inflatables"
      />
    </div>
  );
};

export default PressureReadings;
