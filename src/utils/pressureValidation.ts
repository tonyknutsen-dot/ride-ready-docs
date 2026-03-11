/**
 * Pressure reading validation utilities.
 * Compares actual readings against section-level min/max/target limits.
 */

export type PressureStatus = 'within_range' | 'below_minimum' | 'above_maximum' | 'no_limits';

export interface PressureStatusResult {
  status: PressureStatus;
  label: string;
  color: 'green' | 'red' | 'grey';
}

export interface SectionLimits {
  target_pressure?: number;
  min_pressure?: number;
  max_pressure?: number;
}

/**
 * Check a single reading against section limits.
 */
export function getPressureStatus(
  value: number | null | undefined,
  limits: SectionLimits | undefined,
): PressureStatusResult {
  if (value == null) {
    return { status: 'no_limits', label: 'No reading', color: 'grey' };
  }

  const hasMin = limits?.min_pressure != null;
  const hasMax = limits?.max_pressure != null;

  if (!hasMin && !hasMax) {
    return { status: 'no_limits', label: 'No limits set', color: 'grey' };
  }

  if (hasMin && value < limits!.min_pressure!) {
    return { status: 'below_minimum', label: 'Below minimum', color: 'red' };
  }

  if (hasMax && value > limits!.max_pressure!) {
    return { status: 'above_maximum', label: 'Above maximum', color: 'red' };
  }

  return { status: 'within_range', label: 'Within range', color: 'green' };
}

export type SessionOverallStatus =
  | 'complete_in_range'
  | 'complete_with_warnings'
  | 'incomplete'
  | 'out_of_range';

export interface SessionOverallResult {
  status: SessionOverallStatus;
  label: string;
  color: 'green' | 'red' | 'yellow' | 'grey';
}

/**
 * Compute overall session status from individual line statuses.
 */
export function getSessionOverallStatus(
  lineStatuses: PressureStatusResult[],
  isComplete: boolean,
): SessionOverallResult {
  if (!isComplete) {
    return { status: 'incomplete', label: 'Incomplete', color: 'yellow' };
  }

  const hasOutOfRange = lineStatuses.some(s => s.status === 'below_minimum' || s.status === 'above_maximum');
  const allNoLimits = lineStatuses.every(s => s.status === 'no_limits');

  if (hasOutOfRange) {
    return { status: 'out_of_range', label: 'Out of range', color: 'red' };
  }

  if (allNoLimits) {
    return { status: 'complete_in_range', label: 'Complete', color: 'green' };
  }

  return { status: 'complete_in_range', label: 'Within range', color: 'green' };
}

/**
 * Find limits for a given section from section config array.
 */
export function findSectionLimits(
  sectionConfig: SectionLimits[],
  sectionIndex: number,
): SectionLimits | undefined {
  return sectionConfig[sectionIndex] || undefined;
}
