import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideSelector from './RideSelector';
import InspectionManager from './InspectionManager';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

const RideInspectionManager = () => {
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);

  const handleRideSelect = (ride: Ride) => {
    setSelectedRide(ride);
  };

  const handleBack = () => {
    setSelectedRide(null);
  };

  if (selectedRide) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Selection
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{selectedRide.ride_name} - Checks & Inspections</h2>
            <p className="text-muted-foreground">
              Safety checks (by showmen) and external inspections for {selectedRide.ride_name} ({selectedRide.ride_categories.name})
            </p>
          </div>
        </div>
        
        <InspectionManager ride={selectedRide} />
      </div>
    );
  }

  return (
    <RideSelector
      title="Safety Checks & Inspections"
      description="Select equipment to manage safety checks and inspections. Daily/monthly/yearly checks are done by showmen. Annual and NDT inspections are done by independent inspection bodies."
      actionLabel="Manage Checks & Inspections"
      icon={({ className }) => <div className={className}>✅</div>}
      onRideSelect={handleRideSelect}
      showAddRide={true}
      onAddRide={() => {
        console.log('Navigate to add ride');
      }}
    />
  );
};

export default RideInspectionManager;