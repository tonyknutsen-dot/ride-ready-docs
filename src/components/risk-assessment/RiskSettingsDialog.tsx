import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Settings2, Info, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface RiskSettings {
  existingControlsReduction: number;
  additionalActionsReduction: number;
}

const DEFAULT_SETTINGS: RiskSettings = {
  existingControlsReduction: 20,
  additionalActionsReduction: 15,
};

interface RiskSettingsDialogProps {
  settings: RiskSettings;
  onSave: (settings: RiskSettings) => void;
  saving?: boolean;
}

export function RiskSettingsDialog({ settings, onSave, saving }: RiskSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<RiskSettings>(settings);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setLocalSettings(settings);
    }
    setOpen(isOpen);
  };

  const handleSave = () => {
    onSave(localSettings);
    setOpen(false);
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Risk Calculation Settings
          </DialogTitle>
          <DialogDescription>
            Customise how control measures reduce risk scores in your assessments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Explanation */}
          <Alert className="bg-info/10 border-info/30">
            <Info className="h-4 w-4 text-info" />
            <AlertDescription className="text-xs">
              These percentages determine how much existing controls and additional actions 
              reduce the inherent risk score. Adjust based on your organisation's risk appetite 
              and control effectiveness standards.
            </AlertDescription>
          </Alert>

          {/* Existing Controls Reduction */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Existing Controls Reduction</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Reduction applied when existing control measures are documented. Higher values mean controls are considered more effective.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-lg font-bold font-mono text-primary">
                {localSettings.existingControlsReduction}%
              </span>
            </div>
            <Slider
              value={[localSettings.existingControlsReduction]}
              onValueChange={([value]) => setLocalSettings(s => ({ ...s, existingControlsReduction: value }))}
              min={5}
              max={40}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5% (minimal)</span>
              <span>40% (highly effective)</span>
            </div>
          </div>

          {/* Additional Actions Reduction */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Additional Actions Reduction</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Reduction applied when additional control actions are planned. Represents the expected future reduction once actions are completed.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-lg font-bold font-mono text-primary">
                {localSettings.additionalActionsReduction}%
              </span>
            </div>
            <Slider
              value={[localSettings.additionalActionsReduction]}
              onValueChange={([value]) => setLocalSettings(s => ({ ...s, additionalActionsReduction: value }))}
              min={5}
              max={35}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5% (minor improvement)</span>
              <span>35% (major improvement)</span>
            </div>
          </div>

          {/* Max Reduction Info */}
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <strong>Combined maximum:</strong> {Math.min(localSettings.existingControlsReduction + localSettings.additionalActionsReduction, 50)}% 
            <span className="text-muted-foreground"> (capped at 50%)</span>
            <p className="mt-1">Risk can never be reduced by more than 50% through controls alone.</p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>Save Settings</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DEFAULT_SETTINGS as DEFAULT_RISK_SETTINGS };
