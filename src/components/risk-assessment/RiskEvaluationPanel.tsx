import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, TrendingDown, AlertTriangle, CheckCircle2, XCircle, UserCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  LIKELIHOOD_SCORES,
  SEVERITY_SCORES,
  useRiskCalculation,
  LikelihoodKey,
  SeverityKey
} from './RiskScoring';
import { RiskDisclaimer } from './RiskDisclaimer';

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

// ── Severity colour mapping (standardised) ────────────────────────────────────
const LEVEL_STYLE: Record<string, { bg: string; border: string; text: string; badge: string; badgeText: string }> = {
  low:    { bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A', badge: '#DCFCE7', badgeText: '#166534' },
  medium: { bg: '#FFFBEB', border: '#FDE68A', text: '#F59E0B', badge: '#FEF3C7', badgeText: '#92400E' },
  high:   { bg: '#FEF2F2', border: '#FCA5A5', text: '#DC2626', badge: '#FEE2E2', badgeText: '#991B1B' },
};

function RiskBadge({ level }: { level: string }) {
  const s = LEVEL_STYLE[level] || LEVEL_STYLE.medium;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-bold"
      style={{ background: s.badge, color: s.badgeText }}
    >
      {level.toUpperCase()}
    </span>
  );
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
  const severityInfo   = SEVERITY_SCORES[severity as SeverityKey]       || SEVERITY_SCORES.moderate;
  const isOverridden   = useManualOverride && riskLevel !== calculation.residualLevel;
  const displayLevel   = isOverridden ? riskLevel : calculation.residualLevel;
  const levelStyle     = LEVEL_STYLE[displayLevel] || LEVEL_STYLE.medium;

  return (
    <div className="space-y-4">
      {/* ── Likelihood & Severity selects ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Likelihood */}
        <div className="bg-white border border-[#CBD5E1] rounded-xl overflow-hidden" style={{ padding: '12px' }}>
          <div className="flex items-center gap-2 mb-1">
            <Label className="text-[13px] font-semibold text-[#0F172A]">Likelihood</Label>
            <span className="inline-flex items-center font-bold rounded-lg bg-[#EEF2FF] text-[#3730A3] text-[12px]" style={{ padding: '2px 8px' }}>
              Score: {likelihoodInfo.score}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-slate-400 cursor-help ml-auto shrink-0" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>How likely is this hazard to cause harm?</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-[12px] text-slate-500 mb-2" style={{ lineHeight: '1.4', marginTop: '4px' }}>How likely is this hazard to cause harm?</p>
          <Select value={likelihood} onValueChange={onLikelihoodChange}>
            <SelectTrigger className="h-11 bg-[#F8FAFC] border-[#CBD5E1] focus:border-[#1E3A5F] rounded-[10px] text-[14px] px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LIKELIHOOD_SCORES).map(([key, info]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs bg-[#EEF2FF] text-[#3730A3] px-1.5 py-0.5 rounded font-bold shrink-0">{info.score}</span>
                    <span className="truncate">{info.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Severity */}
        <div className="bg-white border border-[#CBD5E1] rounded-xl overflow-hidden" style={{ padding: '12px' }}>
          <div className="flex items-center gap-2 mb-1">
            <Label className="text-[13px] font-semibold text-[#0F172A]">Severity</Label>
            <span className="inline-flex items-center font-bold rounded-lg bg-[#EEF2FF] text-[#3730A3] text-[12px]" style={{ padding: '2px 8px' }}>
              Score: {severityInfo.score}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-slate-400 cursor-help ml-auto shrink-0" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>How serious would the injury or harm be?</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-[12px] text-slate-500 mb-2" style={{ lineHeight: '1.4', marginTop: '4px' }}>How serious would the injury or harm be?</p>
          <Select value={severity} onValueChange={onSeverityChange}>
            <SelectTrigger className="h-11 bg-[#F8FAFC] border-[#CBD5E1] focus:border-[#1E3A5F] rounded-[10px] text-[14px] px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SEVERITY_SCORES).map(([key, info]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs bg-[#EEF2FF] text-[#3730A3] px-1.5 py-0.5 rounded font-bold shrink-0">{info.score}</span>
                    <span className="truncate">{info.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Risk Calculation panel ── */}
      <section
        className="rounded-2xl overflow-hidden shadow-sm"
        style={{ background: levelStyle.bg, border: `1px solid ${levelStyle.border}` }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between gap-3 min-w-0" style={{ borderColor: levelStyle.border }}>
          <div className="flex items-center gap-2 min-w-0">
            {isOverridden
              ? <UserCheck className="h-4 w-4 shrink-0" style={{ color: levelStyle.text }} />
              : displayLevel === 'high'
              ? <XCircle className="h-4 w-4 text-red-600 shrink-0" />
              : displayLevel === 'medium'
              ? <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              : <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            }
            <span className="text-[13px] font-bold truncate" style={{ color: levelStyle.text }}>
              Risk Calculation
            </span>
          </div>
          {/* Formula pill — clamped so it never causes overflow */}
          <div className="max-w-[45%] min-w-0 shrink-0">
            <span
              className="inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-[12px] font-bold whitespace-nowrap overflow-hidden text-ellipsis bg-white/70 border"
              style={{ color: levelStyle.text, borderColor: levelStyle.border }}
            >
              {likelihoodInfo.score} × {severityInfo.score} = {calculation.inherentScore}
            </span>
          </div>
        </div>

        {/* 3-col KPI grid — minmax(0,1fr) lets cells shrink safely */}
        <div className="px-4 py-4 min-w-0">
          <div className={`grid gap-2 min-w-0 ${calculation.reductionPercent > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}
               style={{ gridTemplateColumns: calculation.reductionPercent > 0 ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))' }}>
            {/* Inherent */}
            <div className="min-w-0 bg-white rounded-xl border p-3 overflow-hidden" style={{ borderColor: levelStyle.border }}>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 truncate">Inherent Risk</p>
              <div className="text-[18px] font-extrabold font-mono truncate" style={{ color: levelStyle.text }}>
                {calculation.inherentScore}
              </div>
              <div className="mt-1.5">
                <RiskBadge level={calculation.inherentLevel} />
              </div>
            </div>

            {/* Reduction — only when controls exist */}
            {calculation.reductionPercent > 0 && (
              <div className="min-w-0 bg-white rounded-xl border border-green-200 p-3 overflow-hidden">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1 truncate">
                  <TrendingDown className="h-3 w-3 shrink-0" /> Reduction
                </p>
                <div className="text-[18px] font-extrabold font-mono text-green-600 truncate">
                  -{calculation.reductionPercent}%
                </div>
                <div className="mt-1.5 h-5" />
              </div>
            )}

            {/* Residual */}
            <div className="min-w-0 bg-white rounded-xl border p-3 overflow-hidden" style={{ borderColor: levelStyle.border }}>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 truncate">
                {isOverridden ? 'Override' : 'Residual'} Risk
              </p>
              <div className="text-[18px] font-extrabold font-mono truncate" style={{ color: levelStyle.text }}>
                {isOverridden ? '—' : calculation.residualScore}
              </div>
              <div className="mt-1.5">
                <RiskBadge level={isOverridden ? riskLevel : calculation.residualLevel} />
              </div>
            </div>
          </div>

          {/* Controls applied note */}
          {calculation.reductionPercent > 0 && !isOverridden && (
            <p className="mt-3 text-[12px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 break-words">
              <span className="font-semibold">Controls applied: </span>
              {existingControls && `Existing controls (−${existingControlsPercent}%)`}
              {existingControls && additionalActions && ', '}
              {additionalActions && `Additional actions (−${additionalActionsPercent}%)`}
            </p>
          )}

          {/* Scale guide */}
          <p className="mt-3 text-[11px] text-slate-500 break-words leading-snug">
            <strong>1–6:</strong> Low &nbsp;·&nbsp; <strong>7–12:</strong> Medium &nbsp;·&nbsp; <strong>13–25:</strong> High
          </p>
        </div>
      </section>

      {/* ── Override toggle ── */}
      <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="manual-override"
            checked={useManualOverride}
            onCheckedChange={(c) => onUseManualOverrideChange(!!c)}
            className="mt-0.5"
            style={{ accentColor: '#1E3A5F' }}
          />
          <div className="flex-1">
            <Label htmlFor="manual-override" className="text-[13px] font-semibold text-[#0F172A] cursor-pointer">
              Override calculated risk level
            </Label>
            <p className="text-[12px] text-slate-500 mt-0.5">
              Use your professional judgement to set a different risk level. Your assessment of site-specific conditions is paramount.
            </p>
          </div>
        </div>

        {useManualOverride && (
          <div className="mt-3 ml-6 space-y-3">
            <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5">
              <p className="text-[12px] text-[#1E40AF]">
                <span className="font-bold">Your professional opinion matters most.</span> If the calculated risk doesn't reflect the true situation based on your site knowledge, override it accordingly.
              </p>
            </div>
            <Select value={riskLevel} onValueChange={onRiskLevelChange}>
              <SelectTrigger className="bg-white border-[#CBD5E1] rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Low — Acceptable risk with controls in place</span>
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>Medium — Risk requires additional controls</span>
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span>High — Unacceptable risk, immediate action required</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ── Professional judgement banner ── */}
      <RiskDisclaimer variant="compact" showLink={showDisclaimerLink} />
    </div>
  );
}
