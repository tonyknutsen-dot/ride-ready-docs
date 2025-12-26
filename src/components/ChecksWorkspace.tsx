import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckSquare, Wrench } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideSelector from './RideSelector';
import InspectionManager from './InspectionManager';
import MaintenanceManager from './MaintenanceManager';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

const ChecksWorkspace = () => {
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [activeTab, setActiveTab] = useState('inspections');

  const handleRideSelect = (ride: Ride) => {
    setSelectedRide(ride);
    setActiveTab('inspections');
  };

  const handleBack = () => {
    setSelectedRide(null);
  };

  if (!selectedRide) {
    return (
      <RideSelector
        title="Select Equipment"
        description="Choose a ride, stall, or equipment to perform safety checks and log maintenance."
        actionLabel="Open Checks & Maintenance"
        icon={({ className }) => <CheckSquare className={className} />}
        onRideSelect={handleRideSelect}
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
          <span className="text-xs sm:text-sm font-semibold break-words">Perform checks & log maintenance</span>
        </li>
      </ol>

      {/* Function Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
        {/* Mobile: Horizontal scroll tabs */}
        <div className="md:hidden">
          <div className="overflow-x-auto scrollbar-hide -mx-3 px-3">
            <TabsList className="flex w-max gap-1 p-1 bg-muted/20 h-auto">
              <TabsTrigger 
                value="inspections" 
                className="flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap"
              >
                <CheckSquare className="h-3 w-3" />
                Checks
              </TabsTrigger>
              <TabsTrigger 
                value="maintenance" 
                className="flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap"
              >
                <Wrench className="h-3 w-3" />
                Maint
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Desktop: Grid tabs */}
        <div className="hidden md:block">
          <TabsList className="grid w-full grid-cols-2 h-auto p-1 bg-muted/20 gap-1">
            <TabsTrigger 
              value="inspections" 
              className="flex flex-col items-center gap-1.5 py-3"
            >
              <CheckSquare className="h-5 w-5" />
              <span className="font-medium text-sm">Checks & Inspections</span>
              <span className="text-xs text-muted-foreground">Daily/Monthly/Yearly & External</span>
            </TabsTrigger>
            <TabsTrigger 
              value="maintenance" 
              className="flex flex-col items-center gap-1.5 py-3"
            >
              <Wrench className="h-5 w-5" />
              <span className="font-medium text-sm">Maintenance</span>
              <span className="text-xs text-muted-foreground">Service & Repairs</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content */}
        <TabsContent value="inspections" className="space-y-4 md:space-y-6">
          <InspectionManager ride={selectedRide} />
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4 md:space-y-6">
          <MaintenanceManager ride={selectedRide} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChecksWorkspace;
