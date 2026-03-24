/**
 * Shared check library taxonomy — SINGLE SOURCE OF TRUTH.
 *
 * Used by:
 * - Check Library admin page
 * - Library Intake Queue (CheckItemSubmissions)
 * - Edge function: group-similar-check-items
 * - Duplicate checker logic
 * - Any future check template builder
 *
 * DO NOT duplicate these constants elsewhere.
 */

/** Operational categories for check items */
export const CHECK_CATEGORIES = [
  'Anchorage',
  'Blower',
  'Compliance',
  'Control Systems',
  'Electrical',
  'Fuel',
  'Gas',
  'General',
  'Hydraulic/Pneumatic',
  'Hygiene',
  'Mechanical',
  'Operations',
  'Restraints',
  'Safety',
  'Safety Devices',
  'Signage',
  'Site',
  'Storage',
  'Structure',
  'Weather',
] as const;

export type CheckCategory = (typeof CHECK_CATEGORIES)[number];

/** Equipment group keys (lowercase, DB-safe) */
export const EQUIPMENT_GROUPS = [
  'rides',
  'inflatables',
  'stalls',
  'attractions',
  'food_stalls',
  'games',
  'equipment',
] as const;

export type EquipmentGroup = (typeof EQUIPMENT_GROUPS)[number];

/** Human-readable labels for equipment groups */
export const EQUIPMENT_GROUP_LABELS: Record<EquipmentGroup, string> = {
  rides: 'Rides',
  inflatables: 'Inflatables',
  stalls: 'Stalls',
  attractions: 'Attractions',
  food_stalls: 'Food Stalls',
  games: 'Games',
  equipment: 'Equipment',
};

/** Maps display-cased group name → lowercase key for interop */
export const equipmentGroupToKey = (displayName: string): EquipmentGroup => {
  const lower = displayName.toLowerCase().replace(/\s+/g, '_') as EquipmentGroup;
  return EQUIPMENT_GROUPS.includes(lower) ? lower : 'rides';
};

/** Frequency labels for check items (aligned with check_frequency enum) */
export const CHECK_FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  preopening: 'Pre-Opening',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

/** Scope type for a library item */
export type LibraryScopeType = 'general' | 'group' | 'type';
