/**
 * Centralised role-based permission checks.
 *
 * There are exactly 2 roles:
 *   controller  – account owner (implicit via organisations.owner_id)
 *   staff       – org member; can access rides, checks, maintenance only
 */

export type AppRole = 'controller' | 'staff';

/** Can create / edit / delete calendar (compliance) events */
export const can_create_calendar_event = (role: AppRole): boolean =>
  role === 'controller';

/** Can mark a *regulatory* event as complete */
export const can_complete_regulatory = (role: AppRole): boolean =>
  role === 'controller';

/** Can mark an *operational* event as complete */
export const can_complete_operational = (_role: AppRole): boolean => true;

/** Can access billing / subscription pages */
export const can_view_billing = (role: AppRole): boolean =>
  role === 'controller';

/** Can invite / remove / change staff roles */
export const can_manage_staff = (role: AppRole): boolean =>
  role === 'controller';

/** Can upload compliance documents & certificates */
export const can_upload_documents = (role: AppRole): boolean =>
  role === 'controller';

/** Can change another user's role */
export const can_change_role = (actorRole: AppRole, _targetCurrentRole?: AppRole): boolean => {
  return actorRole === 'controller';
};

/** Roles a given actor can assign to others */
export const assignable_roles = (actorRole: AppRole): AppRole[] => {
  if (actorRole === 'controller') return ['staff'];
  return [];
};

/** Role display config */
export const ROLE_CONFIG: Record<string, {
  label: string;
  description: string;
  color: string;
  bg: string;
  border: string;
}> = {
  controller: {
    label: 'Controller',
    description: 'Account owner. Full access including billing.',
    color: 'hsl(0 72% 40%)',
    bg: 'hsl(0 72% 97%)',
    border: 'hsl(0 72% 85%)',
  },
  staff: {
    label: 'Staff',
    description: 'Can access assigned rides, complete checks, and log maintenance. Cannot access controller areas.',
    color: 'hsl(213 52% 24%)',
    bg: 'hsl(214 100% 97%)',
    border: 'hsl(213 52% 80%)',
  },
};

/** Fixed staff access summary — not editable */
export const STAFF_ACCESS_SUMMARY = [
  { label: 'Access assigned rides', granted: true },
  { label: 'Complete checks', granted: true },
  { label: 'Log maintenance', granted: true },
  { label: 'Report defects', granted: true },
  { label: 'Calendar & compliance', granted: false },
  { label: 'Documents', granted: false },
  { label: 'Risk assessments', granted: false },
  { label: 'Billing & subscription', granted: false },
  { label: 'Settings', granted: false },
];

/** Permission checklist items derived from role */
export const getRolePermissions = (role: AppRole) => STAFF_ACCESS_SUMMARY;
