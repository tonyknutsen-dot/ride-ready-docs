import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckSquare } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideSelector from '@/components/RideSelector';
import RideDailyChecks from '@/components/RideDailyChecks';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

const Checks = () => {
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);

  // Listen for mobile nav "start check" event
  useEffect(() => {
    const handler = () => {
      // If a ride is selected, scroll to the check form
      if (selectedRide) {
        const checkForm = document.getElementById('daily-check-form');
        if (checkForm) {
          checkForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };
    window.addEventListener("rrd:start-check", handler);
    return () => window.removeEventListener("rrd:start-check", handler);
  }, [selectedRide]);

  const handleRideSelect = (ride: Ride) => {
    setSelectedRide(ride);
  };

  const handleBack = () => {
    setSelectedRide(null);
  };

  if (!selectedRide) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-6">
        <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-lg font-bold">Daily Checks</h1>
                <p className="text-xs text-muted-foreground">Safety inspections</p>
              </div>
            </div>
          </div>
        </header>
        
        <main className="container mx-auto px-3 py-4 md:px-4 md:py-6">
          <RideSelector
            title="Select Equipment for Check"
            description="Choose which ride, stall, or equipment you want to perform a daily safety check on."
            actionLabel="Start Check"
            icon={({ className }) => <CheckSquare className={className} />}
            onRideSelect={handleRideSelect}
            showAddRide={false}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBack}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold truncate">{selectedRide.ride_name}</h1>
                  <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 text-xs">
                    {selectedRide.ride_categories.name}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Daily Safety Check</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 py-4 md:px-4 md:py-6">
        <Card className="mb-4 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Daily Check Instructions
            </CardTitle>
            <CardDescription className="text-xs">
              Complete all required items before operating this equipment
            </CardDescription>
          </CardHeader>
        </Card>

        <div id="daily-check-form">
          <RideDailyChecks ride={selectedRide} />
        </div>
      </main>
    </div>
  );
};

export default Checks;
