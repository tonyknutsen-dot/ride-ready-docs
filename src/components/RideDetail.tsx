import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, FileText, CheckSquare, Calendar, Upload, Settings, AlertTriangle } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideDocuments from './RideDocuments';
import InspectionManager from './InspectionManager';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

interface RideDetailProps {
  ride: Ride;
  onBack: () => void;
  onUpdate: () => void;
}

const RideDetail = ({ ride, onBack, onUpdate }: RideDetailProps) => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={onBack} className="flex items-center space-x-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Rides</span>
        </Button>
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <h2 className="text-3xl font-bold">{ride.ride_name}</h2>
            <Badge variant="secondary">{ride.ride_categories.name}</Badge>
          </div>
          <p className="text-muted-foreground">
            Manage documentation and daily checks for this ride
          </p>
        </div>
      </div>

      {/* Ride Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Ride Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Category:</span>
              <p className="text-muted-foreground">{ride.ride_categories.name}</p>
            </div>
            <div>
              <span className="font-medium">Manufacturer:</span>
              <p className="text-muted-foreground">{ride.manufacturer || 'Not specified'}</p>
            </div>
            <div>
              <span className="font-medium">Year:</span>
              <p className="text-muted-foreground">{ride.year_manufactured || 'Not specified'}</p>
            </div>
            <div>
              <span className="font-medium">Serial Number:</span>
              <p className="text-muted-foreground">{ride.serial_number || 'Not specified'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center space-x-2">
            <Upload className="h-4 w-4" />
            <span>Documents</span>
          </TabsTrigger>
          <TabsTrigger value="inspections" className="flex items-center space-x-2">
            <CheckSquare className="h-4 w-4" />
            <span>Inspections</span>
          </TabsTrigger>
          <TabsTrigger value="bulletins" className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Bulletins</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span>Documents</span>
                </CardTitle>
                <CardDescription>
                  Upload and manage ride documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">0</div>
                    <p className="text-sm text-muted-foreground">Documents uploaded</p>
                  </div>
                  <Button onClick={() => setActiveTab("documents")} className="w-full">
                    Manage Documents
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckSquare className="h-5 w-5 text-accent" />
                  <span>Inspections</span>
                </CardTitle>
                <CardDescription>
                  Manage all inspection types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent">0</div>
                    <p className="text-sm text-muted-foreground">Checks completed today</p>
                  </div>
                  <Button onClick={() => setActiveTab("inspections")} variant="outline" className="w-full">
                    Start Inspections
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-secondary-foreground" />
                  <span>Technical Bulletins</span>
                </CardTitle>
                <CardDescription>
                  View relevant safety bulletins
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-secondary-foreground">0</div>
                    <p className="text-sm text-muted-foreground">New bulletins</p>
                  </div>
                  <Button onClick={() => setActiveTab("bulletins")} variant="secondary" className="w-full">
                    View Bulletins
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <RideDocuments ride={ride} />
        </TabsContent>

        <TabsContent value="inspections">
          <InspectionManager ride={ride} />
        </TabsContent>

        <TabsContent value="bulletins" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Technical Bulletins for {ride.ride_categories.name}</span>
              </CardTitle>
              <CardDescription>
                Safety bulletins and technical notices relevant to this ride category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <AlertTriangle className="mx-auto h-16 w-16 text-muted-foreground" />
                <h3 className="text-lg font-semibold mt-4">No bulletins available</h3>
                <p className="text-muted-foreground">
                  There are currently no technical bulletins for this ride category.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RideDetail;