import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Settings2, Info, RotateCcw, Scale, Shield, ClipboardList, HardHat, Lock } from 'lucide-react';
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
            Configure control effectiveness weightings for residual risk calculation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Methodology explanation */}
          <Alert className="bg-info/10 border-info/30">
            <Info className="h-4 w-4 text-info shrink-0" />
            <AlertDescription className="text-xs leading-relaxed space-y-1">
              <p>These weightings represent the <strong>effectiveness of control measures</strong> in reducing inherent risk. Reduction is applied to the combined likelihood × severity score before residual risk is recalculated.</p>
              <p className="text-muted-foreground">Combined weighting is capped at {MAX_COMBINED_REDUCTION}% — hazard elimination is required to achieve greater reductions.</p>
            </AlertDescription>
          </Alert>

          {/* Existing Controls Weighting */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Shield className="h-3.5 w-3.5 text-green-600 shrink-0" />
                <Label className="text-sm font-medium truncate">Existing Controls</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="p-0.5 -m-0.5 rounded hover:bg-muted">
                      <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="max-w-[calc(100vw-3rem)] p-3 space-y-2">
                    <p className="text-xs font-semibold text-foreground">Control effectiveness guidance:</p>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2"><span className="w-16 shrink-0 font-mono">5–10%</span><span>Administrative controls (signs, rules)</span></div>
                      <div className="flex items-center gap-2"><span className="w-16 shrink-0 font-mono">10–20%</span><span>Procedural controls (SOPs, training)</span></div>
                      <div className="flex items-center gap-2"><span className="w-16 shrink-0 font-mono">20–30%</span><span>Engineering controls (barriers, interlocks)</span></div>
                      <div className="flex items-center gap-2"><span className="w-16 shrink-0 font-mono">30–40%</span><span>Physical safeguarding (guarding, PPE)</span></div>
                    </div>
                    <p className="text-xs text-muted-foreground border-t pt-2">Applied when existing control measures are currently in place and documented.</p>
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
              <span>5% (administrative)</span>
              <span>{maxExistingControls}% (physical)</span>
            </div>
          </div>

          {/* Additional Actions Weighting */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <ClipboardList className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <Label className="text-sm font-medium truncate">Additional Actions</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="p-0.5 -m-0.5 rounded hover:bg-muted">
                      <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="max-w-[calc(100vw-3rem)] text-xs p-3">
                    <p>Weighting applied to planned improvements not yet fully implemented. These represent <em>anticipated</em> risk reduction once actions are complete.</p>
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
          <div className={`text-xs rounded-lg p-3 border ${
            combinedTotal >= MAX_COMBINED_REDUCTION
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-muted/40 border-border text-muted-foreground'
          }`}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">
                Combined weighting: <span className="font-mono">{combinedTotal}%</span>
              </p>
              <span className="text-xs text-muted-foreground font-mono">max {MAX_COMBINED_REDUCTION}%</span>
            </div>
            {combinedTotal >= MAX_COMBINED_REDUCTION ? (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Lock className="h-3 w-3 text-primary shrink-0" />
                <p className="text-primary font-medium">Maximum weighting reached. Hazard elimination required for further reduction.</p>
              </div>
            ) : (
              <p className="mt-1">
                Remaining capacity: <span className="font-mono font-medium">{MAX_COMBINED_REDUCTION - combinedTotal}%</span>
              </p>
            )}
          </div>

          {/* Professional Disclaimer */}
          <div className="text-xs text-muted-foreground bg-warning/10 border border-warning/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Scale className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
              <div className="space-y-1">
                <p><strong className="text-foreground">Professional Judgement Required:</strong>{' '}
                These weightings are guidance only. You must determine appropriate values based on your organisation's specific control effectiveness, evidence, and risk appetite.</p>
                <p>The operators of this application accept no liability for control weightings selected or residual risk determinations made.</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2">
          <div className="flex gap-2 w-full">
            <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">Save Settings</Button>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 w-full"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to defaults (20% / 15%)
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DEFAULT_SETTINGS as DEFAULT_RISK_SETTINGS };
