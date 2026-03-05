import { Wrench } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import EquipmentSelector from './EquipmentSelector';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

interface MaintenanceRideSelectorProps {
  onRideSelect: (ride: Ride) => void;
}

const MaintenanceRideSelector = ({ onRideSelect }: MaintenanceRideSelectorProps) => {
  return (
    <EquipmentSelector
      onRideSelect={onRideSelect}
      placeholderIcon={Wrench}
      emptyDescription="Add rides or equipment in the Rides section to start tracking maintenance."
    />
  );
};

export default MaintenanceRideSelector;
