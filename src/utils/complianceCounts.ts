/**
 * Shared compliance/expiry counting logic.
 *
 * SINGLE SOURCE OF TRUTH for:
 * - document expired count
 * - document expiring-soon count
 * - compliance event overdue count
 * - combined overdue/due-soon totals
 *
 * Used by:
 * - useOverviewData
 * - useOverdueCompliance
 * - RideDetail (ride-level counts)
 * - NeedsAttentionPanel
 * - NotificationCenter
 */

import { isDocExpired, isDocExpiringSoon } from './documentHelpers';

/* ─── Document expiry ─── */

export interface DocExpiryInput {
  expires_at: string | null;
}

export const countExpiredDocs = (docs: DocExpiryInput[]): number =>
  docs.filter(d => d.expires_at && isDocExpired(d.expires_at)).length;

export const countExpiringSoonDocs = (docs: DocExpiryInput[]): number =>
  docs.filter(d => d.expires_at && !isDocExpired(d.expires_at) && isDocExpiringSoon(d.expires_at)).length;

/* ─── Due-soon / overdue thresholds ─── */

export const DUE_SOON_DAYS = 30;

export const isDueSoon = (dateStr: string): boolean => {
  const today = new Date();
  const target = new Date(dateStr);
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / 86400000);
  return diffDays > 0 && diffDays <= DUE_SOON_DAYS;
};

export const isOverdue = (dateStr: string): boolean => {
  const today = new Date().toISOString().split('T')[0];
  return dateStr < today;
};

export const daysUntil = (dateStr: string): number => {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
};
