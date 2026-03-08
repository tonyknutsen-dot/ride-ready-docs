/**
 * Shared check classification helpers.
 *
 * SINGLE SOURCE OF TRUTH for:
 * - pass/fail/incomplete status
 * - linked defect lookup patterns
 * - check frequency labels
 *
 * Used by:
 * - ChecksHistory
 * - InspectionChecklist
 * - ReportGenerator
 * - NotificationCenter (failed-check action-needed)
 * - useRecentChecksSummary
 */

/* ─── Check result classification ─── */

export type CheckOutcome = 'pass' | 'fail' | 'incomplete' | 'in_progress';

export const classifyCheckStatus = (status: string): CheckOutcome => {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'pass' || s === 'passed') return 'pass';
  if (s === 'failed' || s === 'fail') return 'fail';
  if (s === 'in_progress' || s === 'pending') return 'in_progress';
  return 'incomplete';
};

export const isCheckFailed = (status: string): boolean =>
  classifyCheckStatus(status) === 'fail';

export const isCheckPassed = (status: string): boolean =>
  classifyCheckStatus(status) === 'pass';

/* ─── Check frequency labels ─── */

export const CHECK_FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  preopening: 'Pre-Opening',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  custom: 'Custom',
};

export const getCheckFrequencyLabel = (freq: string): string =>
  CHECK_FREQUENCY_LABELS[freq] || freq;

/* ─── Check action-needed logic ─── */

export const isCheckActionNeeded = (status: string): boolean =>
  isCheckFailed(status);
