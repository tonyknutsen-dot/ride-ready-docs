import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, TrendingDown, AlertTriangle, CheckCircle2, XCircle, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  LIKELIHOOD_SCORES, 
  SEVERITY_SCORES, 
  useRiskCalculation, 
  getRiskColor,
  getRiskBgColor,
  LikelihoodKey,
  SeverityKey
} from './RiskScoring';
import { RiskDisclaimer } from './RiskDisclaimer';
import { cn } from '@/lib/utils';

export interface RiskSettings {
  existingControlsReduction: number;
  additionalActionsReduction: number;
}

interface RiskEvaluationPanelProps {
  likelihood: string;
  severity: string;
  riskLevel: string;
  existingControls?: string;
  additionalActions?: string;
  useManualOverride: boolean;
  onLikelihoodChange: (value: string) => void;
  onSeverityChange: (value: string) => void;
  onRiskLevelChange: (value: string) => void;
  onUseManualOverrideChange: (value: boolean) => void;
  riskSettings?: RiskSettings;
  showDisclaimerLink?: boolean;
}

export function RiskEvaluationPanel({
  likelihood,
  severity,
  riskLevel,
  existingControls,
  additionalActions,
  useManualOverride,
  onLikelihoodChange,
  onSeverityChange,
  onRiskLevelChange,
  onUseManualOverrideChange,
  riskSettings,
  showDisclaimerLink = false,
}: RiskEvaluationPanelProps) {
  const existingControlsPercent = riskSettings?.existingControlsReduction ?? 20;
  const additionalActionsPercent = riskSettings?.additionalActionsReduction ?? 15;
  
  const calculation = useRiskCalculation(
    likelihood, 
    severity, 
    existingControls, 
    additionalActions,
    existingControlsPercent,
    additionalActionsPercent
  );
  
  const likelihoodInfo = LIKELIHOOD_SCORES[likelihood as LikelihoodKey] || LIKELIHOOD_SCORES.possible;
  const severityInfo = SEVERITY_SCORES[severity as SeverityKey] || SEVERITY_SCORES.moderate;

  // Check if manual override differs from calculation
  const isOverridden = useManualOverride && riskLevel !== calculation.residualLevel;

  return (
    <div className="space-y-4">
      {/* Likelihood & Severity Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Likelihood */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Likelihood</Label>
            <Badge variant="outline" className="text-xs font-mono">
              Score: {likelihoodInfo.score}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground italic">How likely is this hazard to cause harm?</p>
          <Select value={likelihood} onValueChange={onLikelihoodChange}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LIKELIHOOD_SCORES).map(([key, info]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{info.score}</span>
                    <span>{info.label}</span>
                    <span className="text-xs text-muted-foreground">- {info.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Severity */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Severity</Label>
            <Badge variant="outline" className="text-xs font-mono">
              Score: {severityInfo.score}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground italic">How serious would the injury or harm be?</p>
          <Select value={severity} onValueChange={onSeverityChange}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SEVERITY_SCORES).map(([key, info]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{info.score}</span>
                    <span>{info.label}</span>
                    <span className="text-xs text-muted-foreground">- {info.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Risk Score Calculation Display */}
      <div className={cn(
        "rounded-lg border-2 p-4 space-y-3", 
        isOverridden ? "border-warning/50 bg-warning/5" : getRiskBgColor(calculation.residualLevel)
      )}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {isOverridden ? (
              <>
                <UserCheck className="h-5 w-5 text-warning" />
                <span className="font-semibold">Professional Override Applied</span>
              </>
            ) : (
              <>
                {calculation.residualLevel === 'high' && <XCircle className="h-5 w-5 text-red-600" />}
                {calculation.residualLevel === 'medium' && <AlertTriangle className="h-5 w-5 text-orange-600" />}
                {calculation.residualLevel === 'low' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                <span className="font-semibold">Risk Calculation</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono bg-background px-2 py-1 rounded border">
              {likelihoodInfo.score} × {severityInfo.score} = {calculation.inherentScore}
            </span>
          </div>
        </div>

        {/* Override Indicator */}
        {isOverridden && (
          <Alert className="border-warning/50 bg-warning/10">
            <UserCheck className="h-4 w-4 text-warning" />
            <AlertDescription className="text-xs">
              <strong>Calculated: {calculation.residualLevel.toUpperCase()}</strong> → 
              <strong className="ml-1">Overridden to: {riskLevel.toUpperCase()}</strong>
              <p className="mt-1 text-muted-foreground">
                This risk level has been manually set based on the assessor's professional judgement, 
                overriding the calculated value.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Score Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-background rounded-lg p-3 border">
            <div className="text-xs text-muted-foreground mb-1">Inherent Risk</div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-mono">{calculation.inherentScore}</span>
              <Badge className={cn("text-xs", getRiskColor(calculation.inherentLevel))}>
                {calculation.inherentLevel.toUpperCase()}
              </Badge>
            </div>
          </div>
          
          {calculation.reductionPercent > 0 && (
            <div className="bg-background rounded-lg p-3 border">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                Control Reduction
              </div>
              <div className="text-lg font-bold font-mono text-green-600">
                -{calculation.reductionPercent}%
              </div>
            </div>
          )}
          
          <div className={cn(
            "bg-background rounded-lg p-3 border",
            isOverridden ? "border-warning/50" : "border-primary/30"
          )}>
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              {isOverridden ? 'Override' : 'Residual'} Risk
              {isOverridden && <UserCheck className="h-3 w-3 text-warning" />}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-mono">
                {isOverridden ? '—' : calculation.residualScore}
              </span>
              <Badge className={cn("text-xs", getRiskColor(isOverridden ? riskLevel as any : calculation.residualLevel))}>
                {(isOverridden ? riskLevel : calculation.residualLevel).toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>

        {/* Control Impact Info */}
        {calculation.reductionPercent > 0 && !isOverridden && (
          <div className="text-xs text-muted-foreground bg-green-50 border border-green-200 rounded p-2">
            <span className="font-medium text-green-700">Controls applied:</span>{' '}
            {existingControls && `Existing controls (-${existingControlsPercent}%)`}
            {existingControls && additionalActions && ', '}
            {additionalActions && `Additional actions (-${additionalActionsPercent}%)`}
          </div>
        )}

        {/* Risk Level Guide */}
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-4 flex-wrap">
            <span><strong>1-6:</strong> Low (acceptable)</span>
            <span><strong>7-12:</strong> Medium (action needed)</span>
            <span><strong>13-25:</strong> High (immediate action)</span>
          </div>
        </div>
      </div>

      {/* Manual Override Option */}
      <div className="border rounded-lg p-3 bg-muted/30">
        <div className="flex items-start gap-3">
          <Checkbox
            id="manual-override"
            checked={useManualOverride}
            onCheckedChange={(checked) => onUseManualOverrideChange(!!checked)}
          />
          <div className="flex-1">
            <Label htmlFor="manual-override" className="text-sm font-medium cursor-pointer">
              Override calculated risk level
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use your professional judgement to set a different risk level. Your assessment of site-specific conditions is paramount.
            </p>
          </div>
        </div>
        
        {useManualOverride && (
          <div className="mt-3 ml-6">
            <Alert className="border-warning/50 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-xs">
                <strong>Your professional opinion matters most.</strong> If you believe the calculated risk doesn't reflect the true situation based on your site knowledge and experience, override it accordingly.
              </AlertDescription>
            </Alert>
            <Select value={riskLevel} onValueChange={onRiskLevelChange}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Low - Acceptable risk with controls in place</span>
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span>Medium - Risk requires additional controls</span>
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span>High - Unacceptable risk, immediate action required</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <RiskDisclaimer variant="compact" showLink={showDisclaimerLink} />
    </div>
  );
}
