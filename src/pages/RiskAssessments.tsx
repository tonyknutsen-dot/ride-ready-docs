import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

import { RiskAssessmentManager } from '@/components/RiskAssessmentManager';
import RiskAssessmentSelector from '@/components/RiskAssessmentSelector';
import { Button } from '@/components/ui/button';
import { ShieldCheck, HelpCircle } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import PageHeader from '@/components/PageHeader';
import { RiskAssessmentOnboardingModal } from '@/components/RiskAssessmentOnboardingModal';
import StaffAccountBanner from '@/components/StaffAccountBanner';

type Ride = Tables<'rides'> & {
  ride_categories: Tables<'ride_categories'>;
};

const RiskAssessments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [showGuide, setShowGuide] = useState(false);

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
    <>
      <div className="min-h-screen bg-background pb-28 md:pb-8">
        <StaffAccountBanner />
        <RiskAssessmentOnboardingModal forceOpen={showGuide} onClose={() => setShowGuide(false)} />
        
        <header className="border-b-2 border-warning/30 bg-gradient-to-r from-warning/5 to-transparent backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-4 py-3 sm:py-4">
            <PageHeader
              icon={<ShieldCheck className="h-5 w-5 text-warning" />}
              iconBgClass="from-warning/20 to-destructive/10"
              title={selectedRide ? selectedRide.ride_name : "Risk Assessments"}
              subtitle={selectedRide ? "Risk Assessment Register" : "Identify hazards, evaluate risks, and implement control measures"}
              showBackButton
              backTo={selectedRide ? undefined : "/overview"}
              onBack={selectedRide ? handleBack : undefined}
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowGuide(true)}
                  className="text-muted-foreground hover:text-foreground h-9 px-2 sm:px-3"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">How does it work?</span>
                </Button>
              }
            />
          </div>
        </header>

        <main className="container mx-auto px-4 py-5">
          {selectedRide && (
            <PageBreadcrumb items={getBreadcrumbItems()} showHome />
          )}
          
          {!selectedRide ? (
            <RiskAssessmentSelector
              onRideSelect={handleRideSelect}
            />
          ) : (
            <RiskAssessmentManager ride={selectedRide} />
          )}
        </main>
      </div>
    </>
  );
};

export default RiskAssessments;
