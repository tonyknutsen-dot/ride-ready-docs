import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText, CheckSquare, Wrench, Calendar, BarChart3 } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideSelector from './RideSelector';
import RideDocuments from './RideDocuments';
import InspectionManager from './InspectionManager';
import MaintenanceManager from './MaintenanceManager';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

interface RideWorkspaceProps {
  onAddRide?: () => void;
}

const RideWorkspace = ({ onAddRide }: RideWorkspaceProps) => {
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [activeTab, setActiveTab] = useState('documents');

  const handleRideSelect = (ride: Ride) => {
    setSelectedRide(ride);
    setActiveTab('documents'); // Reset to first tab when selecting a new ride
  };

  const handleBack = () => {
    setSelectedRide(null);
  };

  if (!selectedRide) {
    return (
      <RideSelector
        title="Select Equipment"
        description="Choose a ride, stall, or equipment to manage its documents, inspections, and maintenance records."
        actionLabel="Open Workspace"
        icon={({ className }) => <div className={className}>⚙️</div>}
        onRideSelect={handleRideSelect}
        showAddRide={true}
        onAddRide={onAddRide}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Selected Ride Header */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
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
                  <CardTitle className="text-xl text-primary truncate">
                    {selectedRide.ride_name}
                  </CardTitle>
                  <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                    {selectedRide.ride_categories.name}
                  </Badge>
                </div>
                
                {(selectedRide.manufacturer || selectedRide.year_manufactured) && (
                  <div className="text-sm text-muted-foreground mt-1">
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
      <ol className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-secondary mb-4">
        <li className="flex items-center gap-2">
          <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">1</span>
          <span className="font-semibold">Pick your ride / generator</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">2</span>
          <span className="font-semibold">Add your documents</span>
        </li>
      </ol>

      {/* Function Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Mobile: Horizontal scroll tabs */}
        <div className="md:hidden">
          <div className="overflow-x-auto scrollbar-hide">
            <TabsList className="flex w-max gap-1 p-1 bg-muted/20 h-auto">
              <TabsTrigger 
                value="documents" 
                className="flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap"
              >
                <FileText className="h-4 w-4" />
                Documents
              </TabsTrigger>
              <TabsTrigger 
                value="inspections" 
                className="flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap"
              >
                <CheckSquare className="h-4 w-4" />
                Inspections
              </TabsTrigger>
              <TabsTrigger 
                value="maintenance" 
                className="flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap"
              >
                <Wrench className="h-4 w-4" />
                Maintenance
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Desktop: Grid tabs */}
        <div className="hidden md:block">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/20">
            <TabsTrigger 
              value="documents" 
              className="flex flex-col items-center gap-2 py-3"
            >
              <FileText className="h-5 w-5" />
              <span className="font-medium">Documents</span>
              <span className="text-xs text-muted-foreground">Certificates & Files</span>
            </TabsTrigger>
            <TabsTrigger 
              value="inspections" 
              className="flex flex-col items-center gap-2 py-3"
            >
              <CheckSquare className="h-5 w-5" />
              <span className="font-medium">Inspections</span>
              <span className="text-xs text-muted-foreground">Daily Checks & Reports</span>
            </TabsTrigger>
            <TabsTrigger 
              value="maintenance" 
              className="flex flex-col items-center gap-2 py-3"
            >
              <Wrench className="h-5 w-5" />
              <span className="font-medium">Maintenance</span>
              <span className="text-xs text-muted-foreground">Service & Repairs</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content */}
        <TabsContent value="documents" className="space-y-6">
          <div className="text-center space-y-2 mb-6">
            <h3 className="text-lg font-semibold">Document Management</h3>
            <p className="text-sm text-muted-foreground">
              Upload and manage all documents for <strong>{selectedRide.ride_name}</strong>
            </p>
          </div>
          <RideDocuments ride={selectedRide} />
        </TabsContent>

        <TabsContent value="inspections" className="space-y-6">
          <div className="text-center space-y-2 mb-6">
            <h3 className="text-lg font-semibold">Inspection Management</h3>
            <p className="text-sm text-muted-foreground">
              Manage daily checks, annual inspections and NDT testing for <strong>{selectedRide.ride_name}</strong>
            </p>
          </div>
          <InspectionManager ride={selectedRide} />
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-6">
          <div className="text-center space-y-2 mb-6">
            <h3 className="text-lg font-semibold">Maintenance Management</h3>
            <p className="text-sm text-muted-foreground">
              Log and track all maintenance activities for <strong>{selectedRide.ride_name}</strong>
            </p>
          </div>
          <MaintenanceManager ride={selectedRide} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RideWorkspace;