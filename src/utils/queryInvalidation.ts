/**
 * Centralised query invalidation helpers.
 *
 * SINGLE SOURCE OF TRUTH for cache invalidation after mutations.
 * Every mutation that changes operational state MUST use these helpers
 * instead of ad-hoc invalidateQueries calls.
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  Canonical Status Semantics (compliance_events.status)   │
 * │                                                          │
 * │  open       – created, not yet actioned                  │
 * │  scheduled  – legacy; treated same as 'open'             │
 * │  completed  – resolved by user action                    │
 * │  cancelled  – removed / no longer relevant               │
 * │                                                          │
 * │  Dashboard "actionable" filter:                          │
 * │    status IN ('open', 'scheduled')                       │
 * │                                                          │
 * │  Defects: open / in_progress → actionable                │
 * │           resolved → cleared                             │
 * │                                                          │
 * │  Documents: expires_at ≤ 30d AND                         │
 * │             expiry_acknowledged_at IS NULL → actionable   │
 * └──────────────────────────────────────────────────────────┘
 */

import type { QueryClient } from '@tanstack/react-query';

/* ─── Key groups ─── */

/** Keys read by the dashboard / overview surfaces */
const DASHBOARD_KEYS = [
  'overview',
  'needs-attention',
  'overdue-compliance-count',
] as const;

/** Keys read by compliance / inspection surfaces */
const COMPLIANCE_KEYS = [
  'compliance',
  'compliance-completed',
] as const;

/** Keys read by defect surfaces */
const DEFECT_KEYS = [
  'defect-register',
  'defect-summary',
  'open-critical-defects',
  'all-rides-critical-defects',
  'all-rides-open-defects',
] as const;

/** Keys read by document surfaces */
const DOCUMENT_KEYS = [
  'documents',
  'ride-documents',
] as const;

/** Keys read by maintenance surfaces */
const MAINTENANCE_KEYS = [
  'maintenance-records',
  'maintenance-summary',
] as const;

/** Keys read by pressure surfaces */
const PRESSURE_KEYS = [
  'pressure-sessions',
  'pressure-readings',
] as const;

/* ─── Invalidation helpers ─── */

function invalidateKeys(qc: QueryClient, keys: readonly string[]) {
  keys.forEach(key => qc.invalidateQueries({ queryKey: [key] }));
}

/**
 * Invalidate after completing / editing / deleting a compliance event
 * (inspection, NDT, annual, recurrence).
 */
export function invalidateComplianceQueries(qc: QueryClient) {
  invalidateKeys(qc, COMPLIANCE_KEYS);
  invalidateKeys(qc, DASHBOARD_KEYS);
}

/**
 * Invalidate after raising, updating, or closing a defect.
 */
export function invalidateDefectQueries(qc: QueryClient) {
  invalidateKeys(qc, DEFECT_KEYS);
  invalidateKeys(qc, DASHBOARD_KEYS);
}

/**
 * Invalidate after uploading, acknowledging expiry, or editing documents.
 */
export function invalidateDocumentQueries(qc: QueryClient) {
  invalidateKeys(qc, DOCUMENT_KEYS);
  invalidateKeys(qc, DASHBOARD_KEYS);
}

/**
 * Invalidate after logging maintenance.
 */
export function invalidateMaintenanceQueries(qc: QueryClient) {
  invalidateKeys(qc, MAINTENANCE_KEYS);
  invalidateKeys(qc, DASHBOARD_KEYS);
}

/**
 * Invalidate after pressure reading mutations.
 */
export function invalidatePressureQueries(qc: QueryClient) {
  invalidateKeys(qc, PRESSURE_KEYS);
  invalidateKeys(qc, DASHBOARD_KEYS);
}

/**
 * Nuclear option: invalidate everything operational.
 * Use after major state changes like user role changes, staff acceptance, etc.
 */
export function invalidateAllOperationalQueries(qc: QueryClient) {
  invalidateKeys(qc, DASHBOARD_KEYS);
  invalidateKeys(qc, COMPLIANCE_KEYS);
  invalidateKeys(qc, DEFECT_KEYS);
  invalidateKeys(qc, DOCUMENT_KEYS);
  invalidateKeys(qc, MAINTENANCE_KEYS);
  invalidateKeys(qc, PRESSURE_KEYS);
}
