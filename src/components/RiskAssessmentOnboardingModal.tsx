import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  ShieldCheck, 
  AlertTriangle, 
  ClipboardCheck, 
  ArrowRight, 
  ArrowLeft,
  Sparkles 
} from 'lucide-react';

const STORAGE_KEY = 'riskAssessmentOnboardingSeen';

const steps = [
  {
    icon: AlertTriangle,
    title: 'Identify Hazards',
    description: 'List potential hazards for each piece of equipment. Think about what could go wrong and who might be affected.',
    tip: 'Consider hazards during setup, operation, and takedown.',
  },
  {
    icon: ShieldCheck,
    title: 'Assess & Control Risks',
    description: 'Rate each hazard by likelihood and severity. Document the controls you have in place to reduce the risk.',
    tip: 'The risk matrix helps prioritise which hazards need urgent attention.',
  },
  {
    icon: ClipboardCheck,
    title: 'Review & Update',
    description: 'Risk assessments should be living documents. Review them regularly and update when circumstances change. Exported PDFs are saved to Documents.',
    tip: 'Downloaded or emailed assessments appear in Documents under "Risk Assessments".',
  },
];

interface RiskAssessmentOnboardingModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function RiskAssessmentOnboardingModal({ forceOpen, onClose }: RiskAssessmentOnboardingModalProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setCurrentStep(0);
      return;
    }

    const hasSeen = localStorage.getItem(STORAGE_KEY);
    if (!hasSeen) {
      setOpen(true);
    }
  }, [forceOpen]);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
    onClose?.();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-left">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-warning" />
            <DialogTitle className="text-lg">How Risk Assessments Work</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Learn how to create risk assessments in 3 simple steps
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex justify-center gap-2 py-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                index === currentStep 
                  ? 'bg-warning' 
                  : index < currentStep 
                    ? 'bg-warning/40' 
                    : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="py-4">
          <div className="flex flex-col items-center text-center mb-4">
            <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center mb-3">
              <Icon className="h-7 w-7 text-warning" />
            </div>
            <h3 className="font-semibold text-lg mb-1">
              {currentStep + 1}. {step.title}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {step.description}
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">💡 Tip:</span> {step.tip}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between gap-2">
          <Button
            variant="ghost"
            onClick={currentStep === 0 ? handleClose : handleBack}
            className="flex-1"
          >
            {currentStep === 0 ? (
              'Skip'
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </>
            )}
          </Button>
          <Button
            onClick={handleNext}
            className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground"
          >
            {isLastStep ? (
              "Let's Go!"
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
