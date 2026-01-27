import { useMemo } from 'react';

// Risk scoring matrix based on likelihood x severity
export const LIKELIHOOD_SCORES = {
  'rare': { score: 1, label: 'Rare', description: 'Very unlikely to occur' },
  'unlikely': { score: 2, label: 'Unlikely', description: 'Could occur at some time' },
  'possible': { score: 3, label: 'Possible', description: 'May occur occasionally' },
  'likely': { score: 4, label: 'Likely', description: 'Will probably occur' },
  'certain': { score: 5, label: 'Certain', description: 'Expected to occur in most circumstances' },
} as const;

export const SEVERITY_SCORES = {
  'negligible': { score: 1, label: 'Negligible', description: 'No injury or minimal impact' },
  'minor': { score: 2, label: 'Minor', description: 'First aid treatment, minor injuries' },
  'moderate': { score: 3, label: 'Moderate', description: 'Medical attention required' },
  'major': { score: 4, label: 'Major', description: 'Serious injury or long-term health effects' },
  'catastrophic': { score: 5, label: 'Catastrophic', description: 'Death or permanent disability' },
} as const;

export type LikelihoodKey = keyof typeof LIKELIHOOD_SCORES;
export type SeverityKey = keyof typeof SEVERITY_SCORES;

export interface RiskCalculation {
  inherentScore: number;
  residualScore: number;
  inherentLevel: 'low' | 'medium' | 'high';
  residualLevel: 'low' | 'medium' | 'high';
  reduction: number;
  reductionPercent: number;
}

// Calculate risk score from likelihood and severity
export function calculateRiskScore(likelihood: LikelihoodKey, severity: SeverityKey): number {
  const likelihoodScore = LIKELIHOOD_SCORES[likelihood]?.score || 3;
  const severityScore = SEVERITY_SCORES[severity]?.score || 3;
  return likelihoodScore * severityScore;
}

// Get risk level from score
export function getRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score <= 6) return 'low';
  if (score <= 12) return 'medium';
  return 'high';
}

// Calculate control effectiveness reduction (each control reduces risk by ~15-25%)
export function calculateControlReduction(
  hasExistingControls: boolean,
  hasAdditionalActions: boolean
): number {
  let reduction = 0;
  if (hasExistingControls) reduction += 0.20; // 20% reduction for existing controls
  if (hasAdditionalActions) reduction += 0.15; // 15% reduction for additional actions
  return Math.min(reduction, 0.50); // Max 50% reduction
}

// Full risk calculation with controls
export function calculateRisk(
  likelihood: LikelihoodKey,
  severity: SeverityKey,
  existingControls: string | undefined,
  additionalActions: string | undefined
): RiskCalculation {
  const inherentScore = calculateRiskScore(likelihood, severity);
  const inherentLevel = getRiskLevel(inherentScore);
  
  const hasControls = !!(existingControls && existingControls.trim().length > 0);
  const hasActions = !!(additionalActions && additionalActions.trim().length > 0);
  
  const reductionPercent = calculateControlReduction(hasControls, hasActions);
  const reduction = inherentScore * reductionPercent;
  const residualScore = Math.max(1, Math.round(inherentScore - reduction));
  const residualLevel = getRiskLevel(residualScore);
  
  return {
    inherentScore,
    residualScore,
    inherentLevel,
    residualLevel,
    reduction,
    reductionPercent: Math.round(reductionPercent * 100),
  };
}

// Risk score badge colors
export function getRiskColor(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low': return 'bg-green-100 text-green-800 border-green-300';
    case 'medium': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'high': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

export function getRiskBgColor(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low': return 'bg-green-50';
    case 'medium': return 'bg-orange-50';
    case 'high': return 'bg-red-50';
    default: return 'bg-gray-50';
  }
}

// Hook to use risk calculation
export function useRiskCalculation(
  likelihood: string,
  severity: string,
  existingControls: string | undefined,
  additionalActions: string | undefined
) {
  return useMemo(() => {
    return calculateRisk(
      likelihood as LikelihoodKey,
      severity as SeverityKey,
      existingControls,
      additionalActions
    );
  }, [likelihood, severity, existingControls, additionalActions]);
}
