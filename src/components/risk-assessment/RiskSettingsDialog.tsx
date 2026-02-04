import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Settings2, Info, RotateCcw, Scale } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface RiskSettings {
  existingControlsReduction: number;
  additionalActionsReduction: number;
}

const DEFAULT_SETTINGS: RiskSettings = {
  existingControlsReduction: 20,
  additionalActionsReduction: 15,
};

const MAX_COMBINED_REDUCTION = 50;

interface RiskSettingsDialogProps {
  settings: RiskSettings;
  onSave: (settings: RiskSettings) => void;
  saving?: boolean;
}

export function RiskSettingsDialog({ settings, onSave, saving }: RiskSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<RiskSettings>(settings);

  const combinedTotal = localSettings.existingControlsReduction + localSettings.additionalActionsReduction;
  const isOverLimit = combinedTotal > MAX_COMBINED_REDUCTION;

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setLocalSettings(settings);
    }
    setOpen(isOpen);
  };

  const handleExistingControlsChange = (value: number) => {
    // Cap to ensure combined doesn't exceed max
    const maxAllowed = MAX_COMBINED_REDUCTION - localSettings.additionalActionsReduction;
    const cappedValue = Math.min(value, maxAllowed);
    setLocalSettings(s => ({ ...s, existingControlsReduction: cappedValue }));
  };

  const handleAdditionalActionsChange = (value: number) => {
    // Cap to ensure combined doesn't exceed max
    const maxAllowed = MAX_COMBINED_REDUCTION - localSettings.existingControlsReduction;
    const cappedValue = Math.min(value, maxAllowed);
    setLocalSettings(s => ({ ...s, additionalActionsReduction: cappedValue }));
  };

  const handleSave = () => {
    // Final validation - cap values if somehow over limit
    const finalSettings = {
      existingControlsReduction: Math.min(localSettings.existingControlsReduction, MAX_COMBINED_REDUCTION - 5),
      additionalActionsReduction: Math.min(localSettings.additionalActionsReduction, MAX_COMBINED_REDUCTION - 5),
    };
    
    // Ensure combined doesn't exceed max
    if (finalSettings.existingControlsReduction + finalSettings.additionalActionsReduction > MAX_COMBINED_REDUCTION) {
      finalSettings.additionalActionsReduction = MAX_COMBINED_REDUCTION - finalSettings.existingControlsReduction;
    }
    
    onSave(finalSettings);
    setOpen(false);
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
  };

  // Calculate dynamic max for each slider
  const maxExistingControls = Math.min(40, MAX_COMBINED_REDUCTION - 5); // Min 5% for additional
  const maxAdditionalActions = Math.min(35, MAX_COMBINED_REDUCTION - localSettings.existingControlsReduction);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 shrink-0" />
            <span>Risk Calculation Settings</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Customise how control measures reduce risk scores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Explanation */}
          <Alert className="bg-info/10 border-info/30">
            <Info className="h-4 w-4 text-info shrink-0" />
            <AlertDescription className="text-xs leading-relaxed">
              These percentages determine how much existing controls and additional actions 
              reduce the inherent risk score. Combined total is capped at {MAX_COMBINED_REDUCTION}%.
            </AlertDescription>
          </Alert>

          {/* Existing Controls Reduction */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Label className="text-sm font-medium truncate">Existing Controls</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="p-0.5 -m-0.5 rounded hover:bg-muted">
                      <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="max-w-[calc(100vw-3rem)] text-sm p-3">
                    <p>Reduction applied when existing control measures are documented.</p>
                  </PopoverContent>
                </Popover>
              </div>
              <span className="text-lg font-bold font-mono text-primary shrink-0">
                {localSettings.existingControlsReduction}%
              </span>
            </div>
            <Slider
              value={[localSettings.existingControlsReduction]}
              onValueChange={([value]) => handleExistingControlsChange(value)}
              min={5}
              max={maxExistingControls}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5%</span>
              <span>{maxExistingControls}%</span>
            </div>
          </div>

          {/* Additional Actions Reduction */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Label className="text-sm font-medium truncate">Additional Actions</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="p-0.5 -m-0.5 rounded hover:bg-muted">
                      <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="max-w-[calc(100vw-3rem)] text-sm p-3">
                    <p>Reduction applied when additional control actions are planned.</p>
                  </PopoverContent>
                </Popover>
              </div>
              <span className="text-lg font-bold font-mono text-primary shrink-0">
                {localSettings.additionalActionsReduction}%
              </span>
            </div>
            <Slider
              value={[localSettings.additionalActionsReduction]}
              onValueChange={([value]) => handleAdditionalActionsChange(value)}
              min={5}
              max={maxAdditionalActions}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5%</span>
              <span>{maxAdditionalActions}%</span>
            </div>
          </div>

          {/* Combined Total Display */}
          <div className={`text-xs rounded-lg p-3 ${
            combinedTotal === MAX_COMBINED_REDUCTION 
              ? 'bg-primary/10 border border-primary/30 text-primary' 
              : 'bg-muted/50 text-muted-foreground'
          }`}>
            <p className="font-medium">
              Combined: {combinedTotal}% / {MAX_COMBINED_REDUCTION}% max
            </p>
            <p className="mt-1 text-muted-foreground">
              {combinedTotal === MAX_COMBINED_REDUCTION 
                ? 'Maximum reduction reached. Adjust one slider to increase the other.'
                : 'Risk can never be reduced by more than 50% through controls alone.'}
            </p>
          </div>

          {/* Professional Disclaimer */}
          <div className="text-xs text-muted-foreground bg-warning/10 border border-warning/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Scale className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
              <div>
                <strong className="text-foreground">Your Professional Judgement:</strong>{' '}
                These values are suggestions only. You must determine appropriate reduction percentages 
                based on your organisation's control effectiveness and risk appetite. 
                The operators of this application accept no liability for values selected.
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={handleReset} className="gap-1.5 w-full sm:w-auto">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1 sm:flex-initial">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 sm:flex-initial">Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DEFAULT_SETTINGS as DEFAULT_RISK_SETTINGS };
