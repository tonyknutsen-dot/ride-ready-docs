import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideSelector from './RideSelector';
import RideDocuments from './RideDocuments';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

const RideDocumentManager = () => {
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
            <h2 className="text-2xl font-bold">{selectedRide.ride_name} - Documents</h2>
            <p className="text-muted-foreground">
              Manage documents for {selectedRide.ride_name} ({selectedRide.ride_categories.name})
            </p>
          </div>
        </div>
        
        <RideDocuments ride={selectedRide} />
      </div>
    );
  }

  return (
    <RideSelector
      title="Document Management"
      description="Select a ride, stall, or equipment to manage its documents. Upload certificates, manuals, inspection reports and other important files."
      actionLabel="Manage Documents"
      icon={({ className }) => <div className={className}>📄</div>}
      onRideSelect={handleRideSelect}
      showAddRide={true}
      onAddRide={() => {
        // This would typically navigate to add ride, but for now we'll just show a message
        console.log('Navigate to add ride');
      }}
    />
  );
};

export default RideDocumentManager;