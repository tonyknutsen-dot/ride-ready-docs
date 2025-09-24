import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Calendar, FileText, CalendarDays, TestTube, Building } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import RideDailyChecks from './RideDailyChecks';
import DailyCheckTemplateManager from './DailyCheckTemplateManager';
import NDTScheduleManager from './NDTScheduleManager';
import AnnualInspectionManager from './AnnualInspectionManager';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

interface InspectionManagerProps {
  ride: Ride;
}

const InspectionManager = ({ ride }: InspectionManagerProps) => {
  const [activeTab, setActiveTab] = useState('daily');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Inspection Management</h3>
        <p className="text-muted-foreground">
          Manage all inspection types and schedules for {ride.ride_name}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="daily" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Daily</span>
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Monthly</span>
          </TabsTrigger>
          <TabsTrigger value="annual" className="flex items-center space-x-2">
            <CalendarDays className="h-4 w-4" />
            <span>Annual</span>
          </TabsTrigger>
          <TabsTrigger value="ndt" className="flex items-center space-x-2">
            <TestTube className="h-4 w-4" />
            <span>NDT</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center space-x-2">
            <Building className="h-4 w-4" />
            <span>In-Service</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Daily Safety Checks</span>
                </CardTitle>
                <CardDescription>
                  Perform and manage daily safety inspections for this ride
                </CardDescription>
              </CardHeader>
            </Card>
            <Tabs defaultValue="perform" className="space-y-4">
              <TabsList>
                <TabsTrigger value="perform">Perform Checks</TabsTrigger>
                <TabsTrigger value="templates">Manage Templates</TabsTrigger>
              </TabsList>
              <TabsContent value="perform">
                <RideDailyChecks ride={ride} />
              </TabsContent>
              <TabsContent value="templates">
                <DailyCheckTemplateManager ride={ride} />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="monthly">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Calendar className="mx-auto h-16 w-16 text-muted-foreground" />
                <h3 className="text-lg font-semibold mt-4">Monthly Inspections</h3>
                <p className="text-muted-foreground">
                  Monthly inspection functionality coming soon
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="annual">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <CalendarDays className="mx-auto h-16 w-16 text-muted-foreground" />
                <h3 className="text-lg font-semibold mt-4">Annual Inspections</h3>
                <p className="text-muted-foreground">
                  Annual inspection functionality coming soon
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ndt">
          <NDTScheduleManager ride={ride} />
        </TabsContent>

        <TabsContent value="reports">
          <AnnualInspectionManager ride={ride} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InspectionManager;