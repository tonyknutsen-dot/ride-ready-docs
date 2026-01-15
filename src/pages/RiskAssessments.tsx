import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import PageBreadcrumb from '@/components/PageBreadcrumb';

type Ride = Tables<'rides'> & {
  ride_categories: Tables<'ride_categories'>;
};

const RiskAssessments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);

  const handleRideSelect = (ride: Ride) => {
    setSelectedRide(ride);
  };

  const handleBack = () => {
    setSelectedRide(null);
  };

  const getBreadcrumbItems = () => {
    if (selectedRide) {
      return [
        { label: 'Risk Assessments', href: '#' },
        { label: selectedRide.ride_name }
      ];
    }
    return [{ label: 'Risk Assessments' }];
  };

  return (
    <FeatureGate requiredPlan="advanced" feature="Risk Assessments">
      <div className="container mx-auto py-8 px-4 pb-24 md:pb-8">
        {/* Back Button - show when no ride selected */}
        {!selectedRide && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/overview')}
            className="w-fit gap-1.5 -ml-2 mb-4 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        
        {selectedRide && (
          <PageBreadcrumb items={getBreadcrumbItems()} showHome />
        )}
        
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-warning/20 to-destructive/10 flex items-center justify-center shadow-sm">
              <ShieldCheck className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Risk Assessments</h1>
              <p className="text-sm text-muted-foreground">
                Identify hazards and implement controls for safe operation
              </p>
            </div>
          </div>
        </div>

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
            <Button 
              variant="ghost" 
              onClick={handleBack} 
              className="mb-4 hover:bg-warning/10 hover:text-warning"
            >
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
