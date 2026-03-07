import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, HelpCircle, Plus } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { ChecksOnboardingModal } from '@/components/ChecksOnboardingModal';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import { OfflineStaleAlert } from '@/components/OfflineStaleAlert';
import EquipmentPickerDialog from '@/components/EquipmentPickerDialog';
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
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleRideSelect = (ride: Ride) => {
    navigate(`/checks/register?rideId=${ride.id}`);
  };

  const handleStartCheck = (ride: any) => {
    setPickerOpen(false);
    navigate(`/rides/${ride.id}?tab=checks`);
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

      <OfflineStaleAlert />

      {/* Primary CTA — matches Maintenance's "Log maintenance" pattern */}
      <Button
        onClick={() => setPickerOpen(true)}
        className="gap-2 h-10 min-h-[44px] w-full sm:w-auto text-[13px] font-semibold rounded-xl"
      >
        <Plus className="h-4 w-4" />
        Start Check
      </Button>

      {/* Equipment chooser — same component as Maintenance */}
      <EquipmentSelector
        onRideSelect={handleRideSelect}
        placeholderIcon={CheckSquare}
        emptyDescription="Add rides or equipment in the Rides section to start running checks."
        showKpis={false}
      />

      {/* Equipment picker dialog for "Start Check" CTA */}
      <EquipmentPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Select equipment to check"
        subtitle="Choose a ride or equipment to start a new check"
        onSelect={handleStartCheck}
      />
    </div>
  );
};

export default Checks;
