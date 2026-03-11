/**
 * Shared notification classification logic.
 * 
 * SINGLE SOURCE OF TRUTH used by:
 * - NotificationCenter component (categorisation + actionable filtering)
 * - useActionNeededCount hook (badge count)
 * 
 * DO NOT duplicate this logic elsewhere.
 */

export interface NotificationBase {
  id: string;
  title: string;
  message?: string;
  type: string;
  is_read: boolean;
  related_table?: string;
  related_id?: string;
  created_at: string;
}

export type NotificationCategory = 'compliance' | 'defects' | 'checks' | 'documents' | 'maintenance' | 'system';

/**
 * Classify a notification into a domain category.
 */
export const getNotificationCategory = (n: NotificationBase): NotificationCategory => {
  const t = n.type?.toLowerCase() ?? '';
  const title = n.title?.toLowerCase() ?? '';

  // Defects
  if (n.related_table === 'defects') return 'defects';
  if (title.includes('defect') || title.includes('stop use defect') || title.includes('unresolved defect')) return 'defects';
  if (title.includes('linked defect')) return 'defects';

  // Checks
  if (title.includes('check') && !title.includes('defect')) return 'checks';
  if (title.includes('missed check') || title.includes('failed check')) return 'checks';
  if (n.related_table === 'checks') return 'checks';

  // Documents
  if (title.includes('document') || title.includes('certificate') || title.includes('sent') || title.includes('shared') || title.includes('document pack') || n.related_table === 'documents') return 'documents';

  // Maintenance
  if (title.includes('maintenance') || title.includes('repair') || n.related_table === 'maintenance_records') return 'maintenance';

  // Compliance
  if (title.includes('inspection') || title.includes('ndt') || title.includes('expir')) return 'compliance';
  if (title.includes('wind') || title.includes('anemometer') || title.includes('pack-away') || title.includes('threshold')) return 'compliance';
  if (t === 'warning' || t === 'error') return 'compliance';

  return 'system';
};

/**
 * Determine if a notification requires user action.
 * Used for action-needed badge count AND notification centre "Action" filter.
 */
export const isNotificationActionable = (n: NotificationBase): boolean => {
  const title = n.title?.toLowerCase() ?? '';
  const t = n.type?.toLowerCase() ?? '';

  // ── Explicitly NOT actionable (passive confirmations) ──
  if (title.includes('maintenance logged') || title.includes('documents sent') || title.includes('check completed')) return false;
  if (t === 'success') return false;

  // ── Definitely actionable ──
  if (n.related_table === 'defects') return true;
  if (title.includes('defect') || title.includes('stop use')) return true;

  if (title.includes('failed check') || title.includes('check failure')) return true;

  if (title.includes('overdue') || title.includes('expired') || title.includes('expiring')) return true;
  if (title.includes('due soon') || title.includes('due in')) return true;
  if (title.includes('missing') || title.includes('missed')) return true;

  if (title.includes('unresolved') || title.includes('high priority') || title.includes('critical')) return true;

  if (title.includes('wind') && (title.includes('warning') || title.includes('threshold') || title.includes('pack-away'))) return true;

  // Pressure out-of-range
  if (title.includes('pressure') && (title.includes('out of range') || title.includes('action needed') || title.includes('failed'))) return true;

  if (title.includes('billing') || title.includes('plan') || title.includes('limit')) return true;

  if (t === 'warning' || t === 'error') return true;

  return false;
};
