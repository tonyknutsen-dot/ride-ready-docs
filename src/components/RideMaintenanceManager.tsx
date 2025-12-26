import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Ride } from '@/types/ride';
import RideSelector from './RideSelector';
import MaintenanceManager from './MaintenanceManager';

const RideMaintenanceManager = () => {
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
            <h2 className="text-2xl font-bold">{selectedRide.ride_name} - Maintenance</h2>
            <p className="text-muted-foreground">
              Manage maintenance for {selectedRide.ride_name} ({selectedRide.ride_categories.name})
            </p>
          </div>
        </div>
        
        <MaintenanceManager ride={selectedRide} />
      </div>
    );
  }

  return (
    <RideSelector
      title="Maintenance Management"
      description="Select a ride, stall, or equipment to log and track maintenance activities. Record repairs, part replacements, and regular servicing."
      actionLabel="Manage Maintenance"
      icon={({ className }) => <div className={className}>🔧</div>}
      onRideSelect={handleRideSelect}
      showAddRide={true}
      onAddRide={() => {
        console.log('Navigate to add ride');
      }}
    />
  );
};

export default RideMaintenanceManager;