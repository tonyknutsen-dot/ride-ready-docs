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
  Wrench, 
  FileText, 
  Calendar, 
  ArrowRight, 
  ArrowLeft,
  Sparkles 
} from 'lucide-react';

const STORAGE_KEY = 'maintenanceOnboardingSeen';

const steps = [
  {
    icon: Wrench,
    title: 'Log Maintenance Activities',
    description: 'Record repairs, servicing, and part replacements. Include costs, dates, and who performed the work.',
    tip: 'Keep detailed notes for insurance and compliance audits.',
  },
  {
    icon: Calendar,
    title: 'Schedule Future Maintenance',
    description: 'Set reminders for upcoming service. Never miss preventative maintenance or scheduled inspections.',
    tip: 'Regular maintenance extends equipment life and prevents costly breakdowns.',
  },
  {
    icon: FileText,
    title: 'Build a Service History',
    description: 'Every record builds your equipment\'s complete maintenance history. Export reports for inspections or resale.',
    tip: 'A full service history adds value to your equipment.',
  },
];

interface MaintenanceOnboardingModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function MaintenanceOnboardingModal({ forceOpen, onClose }: MaintenanceOnboardingModalProps) {
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
            <Sparkles className="h-5 w-5 text-amber-500" />
            <DialogTitle className="text-lg">How Maintenance Works</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Learn how to track maintenance in 3 simple steps
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex justify-center gap-2 py-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                index === currentStep 
                  ? 'bg-amber-500' 
                  : index < currentStep 
                    ? 'bg-amber-500/40' 
                    : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="py-4">
          <div className="flex flex-col items-center text-center mb-4">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
              <Icon className="h-7 w-7 text-amber-500" />
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
            className="flex-1 bg-amber-500 hover:bg-amber-500/90 text-white"
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
