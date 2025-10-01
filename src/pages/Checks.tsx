import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckSquare, Calendar, Clock } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideSelector from '@/components/RideSelector';
import InspectionChecklist from '@/components/InspectionChecklist';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

type CheckFrequency = 'daily' | 'monthly' | 'yearly';

const Checks = () => {
  const [frequency, setFrequency] = useState<CheckFrequency | null>(null);
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
    if (selectedRide) {
      setSelectedRide(null);
    } else {
      setFrequency(null);
    }
  };

  const frequencyOptions = [
    {
      value: 'daily' as CheckFrequency,
      label: 'Daily Check',
      description: 'Pre-operational safety check',
      icon: Clock,
      color: 'bg-blue-500',
    },
    {
      value: 'monthly' as CheckFrequency,
      label: 'Monthly Check',
      description: 'Thorough monthly inspection',
      icon: Calendar,
      color: 'bg-amber-500',
    },
    {
      value: 'yearly' as CheckFrequency,
      label: 'Yearly Check',
      description: 'Annual comprehensive inspection',
      icon: CheckSquare,
      color: 'bg-green-500',
    },
  ];

  // Step 1: Select frequency
  if (!frequency) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-6">
        <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-lg font-bold">Safety Checks</h1>
                <p className="text-xs text-muted-foreground">Select check type</p>
              </div>
            </div>
          </div>
        </header>
        
        <main className="container mx-auto px-3 py-4 md:px-4 md:py-6">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>What type of check do you want to perform?</CardTitle>
              <CardDescription>
                Choose the frequency that matches your inspection schedule
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-3 md:gap-4 md:grid-cols-3">
            {frequencyOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Card
                  key={option.value}
                  className="cursor-pointer hover:border-primary transition-all hover:shadow-md"
                  onClick={() => setFrequency(option.value)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`${option.color} p-2 rounded-lg`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base">{option.label}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // Step 2: Select ride
  if (!selectedRide) {
    const selectedOption = frequencyOptions.find(opt => opt.value === frequency);
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
                <div>
                  <h1 className="text-lg font-bold">{selectedOption?.label}</h1>
                  <p className="text-xs text-muted-foreground">Select equipment</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="container mx-auto px-3 py-4 md:px-4 md:py-6">
          <RideSelector
            title={`Select Equipment for ${selectedOption?.label}`}
            description={`Choose which ride, stall, or equipment you want to perform a ${frequency} safety check on.`}
            actionLabel="Start Check"
            icon={({ className }) => <CheckSquare className={className} />}
            onRideSelect={handleRideSelect}
            showAddRide={false}
          />
        </main>
      </div>
    );
  }

  // Step 3: Perform check
  const selectedOption = frequencyOptions.find(opt => opt.value === frequency);
  
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
                <p className="text-xs text-muted-foreground">{selectedOption?.label}</p>
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
              {selectedOption?.label} Instructions
            </CardTitle>
            <CardDescription className="text-xs">
              Complete all required items before operating this equipment
            </CardDescription>
          </CardHeader>
        </Card>

        <div id="daily-check-form">
          <InspectionChecklist ride={selectedRide} frequency={frequency} />
        </div>
      </main>
    </div>
  );
};

export default Checks;
