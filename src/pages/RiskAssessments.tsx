import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { FeatureGate } from '@/components/FeatureGate';
import { RiskAssessmentManager } from '@/components/RiskAssessmentManager';
import RideSelector from '@/components/RideSelector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tables } from '@/integrations/supabase/types';

type Ride = Tables<'rides'> & {
  ride_categories: Tables<'ride_categories'>;
};

const RiskAssessments = () => {
  const { user } = useAuth();
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);

  const handleRideSelect = (ride: Ride) => {
    setSelectedRide(ride);
  };

  const handleBack = () => {
    setSelectedRide(null);
  };

  return (
    <FeatureGate requiredPlan="advanced" feature="Risk Assessments">
      <div className="container mx-auto py-8 px-4 pb-24 md:pb-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Risk Assessments</h1>
          <p className="text-muted-foreground">
            Create and manage comprehensive risk assessments for your equipment
          </p>
        </div>

        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Risk assessments help identify hazards and implement controls to ensure safe operation of your rides and equipment.
            You can download, print, or email completed assessments.
          </AlertDescription>
        </Alert>

        {!selectedRide ? (
          <RideSelector
            title="Select Equipment"
            description="Choose a ride or stall to manage its risk assessments"
            actionLabel="Manage Risk Assessments"
            icon={ShieldCheck}
            onRideSelect={handleRideSelect}
          />
        ) : (
          <div>
            <Button variant="ghost" onClick={handleBack} className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Equipment Selection
            </Button>
            <RiskAssessmentManager ride={selectedRide} />
          </div>
        )}
      </div>
    </FeatureGate>
  );
};

export default RiskAssessments;