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

type CheckFrequency = 'preuse' | 'daily' | 'monthly' | 'yearly';

const Checks = () => {
  const [frequency, setFrequency] = useState<CheckFrequency | null>(null);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);

  useEffect(() => {
    const handler = () => {
      if (selectedRide) {
        const checkForm = document.getElementById('inspection-checklist-form');
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
      value: 'preuse' as CheckFrequency,
      label: 'Pre-Use Check',
      description: 'Function test before public use',
      icon: CheckSquare,
      color: 'bg-purple-500',
    },
    {
      value: 'daily' as CheckFrequency,
      label: 'Daily Check',
      description: 'Visual and safety inspection',
      icon: Clock,
      color: 'bg-blue-500',
    },
    {
      value: 'monthly' as CheckFrequency,
      label: 'Monthly Check',
      description: 'Component and parts inspection',
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
      <div className="min-h-screen bg-background pb-28 md:pb-8">
        <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Safety Checks</h1>
                <p className="text-xs text-muted-foreground">Select check type</p>
              </div>
            </div>
          </div>
        </header>
        
        <main className="container mx-auto px-4 py-5">
          <Card className="mb-5 shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">What type of check?</CardTitle>
              <CardDescription className="text-sm">
                Choose the frequency that matches your inspection schedule
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-3">
            {frequencyOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Card
                  key={option.value}
                  className="cursor-pointer hover:border-primary active:scale-[0.98] transition-all shadow-card"
                  onClick={() => setFrequency(option.value)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className={`${option.color} p-3 rounded-xl`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{option.label}</h3>
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      </div>
                    </div>
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
      <div className="min-h-screen bg-background pb-28 md:pb-8">
        <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleBack}
                className="h-10 w-10 shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold">{selectedOption?.label}</h1>
                <p className="text-xs text-muted-foreground">Select equipment</p>
              </div>
            </div>
          </div>
        </header>
        
        <main className="container mx-auto px-4 py-5">
          <RideSelector
            title={`Select Equipment`}
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
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <button id="rrd-start-check" className="hidden" onClick={() => {
        const form = document.getElementById('inspection-checklist-form');
        if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }} />
      
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleBack}
              className="h-10 w-10 shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold truncate">{selectedRide.ride_name}</h1>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs">
                  {selectedRide.ride_categories.name}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{selectedOption?.label}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5">
        <Card className="mb-5 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              {selectedOption?.label} Instructions
            </CardTitle>
            <CardDescription className="text-sm">
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
