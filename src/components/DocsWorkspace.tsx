import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideSelector from './RideSelector';
import RideDocuments from './RideDocuments';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

interface DocsWorkspaceProps {
  onAddRide?: () => void;
}

const DocsWorkspace = ({ onAddRide }: DocsWorkspaceProps) => {
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);

  const handleRideSelect = (ride: Ride) => {
    setSelectedRide(ride);
  };

  const handleBack = () => {
    setSelectedRide(null);
  };

  if (!selectedRide) {
    return (
      <RideSelector
        title="Select Equipment"
        description="Choose a ride, stall, or equipment to manage its documents and certificates."
        actionLabel="Open Documents"
        icon={({ className }) => <FileText className={className} />}
        onRideSelect={handleRideSelect}
        showAddRide={true}
        onAddRide={onAddRide}
      />
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Selected Ride Header */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="pb-3 md:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBack}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-lg sm:text-xl text-primary break-words">
                    {selectedRide.ride_name}
                  </CardTitle>
                  <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 text-xs whitespace-nowrap">
                    {selectedRide.ride_categories.name}
                  </Badge>
                </div>
                
                {(selectedRide.manufacturer || selectedRide.year_manufactured) && (
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    {selectedRide.manufacturer && `${selectedRide.manufacturer}`}
                    {selectedRide.manufacturer && selectedRide.year_manufactured && ' • '}
                    {selectedRide.year_manufactured && `${selectedRide.year_manufactured}`}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Step bar */}
      <ol className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-2 md:gap-3 p-3 rounded-2xl bg-secondary">
        <li className="flex items-center gap-2">
          <span className="inline-flex w-7 h-7 sm:w-8 sm:h-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs sm:text-sm">1</span>
          <span className="text-xs sm:text-sm font-semibold break-words">Pick your ride / generator</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-flex w-7 h-7 sm:w-8 sm:h-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xs sm:text-sm">2</span>
          <span className="text-xs sm:text-sm font-semibold break-words">Add your documents</span>
        </li>
      </ol>

      {/* Documents Section */}
      <div className="space-y-4 md:space-y-6">
        <RideDocuments ride={selectedRide} />
      </div>
    </div>
  );
};

export default DocsWorkspace;
